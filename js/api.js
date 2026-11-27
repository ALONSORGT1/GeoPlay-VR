// Práctica 3.3 · Sincronización del aula con el backend (FastAPI → RDS).
// Módulo ES sin dependencias del DOM: también se prueba en Node (tests/api.test.mjs).
//
// Reglas:
//  · El token del intento vive SOLO en memoria (nunca localStorage/cookies/URL).
//  · Un depósito estable = un evento con crypto.randomUUID(); el mismo UUID en cada reintento.
//  · Cola serial: un evento a la vez, en orden; reintento con espera creciente + jitter.
//  · El servidor decide acierto/error; el aula solo refleja lo confirmado.

export class ApiError extends Error {
  constructor(message, status = 0, codigo = 'red') {
    super(message);
    this.status = status;   // 0 = sin respuesta (red, CORS, tiempo agotado)
    this.codigo = codigo;
  }
  get reintentable() { return this.status === 0 || this.status === 429 || this.status >= 500; }
}

export class ApiClient {
  constructor(baseUrl, { fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 10000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(method, path, { token, body, keepalive = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store', keepalive, signal: controller.signal,
      });
    } catch (error) {
      throw new ApiError(error?.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Sin conexión con el servidor');
    } finally {
      clearTimeout(timer);
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(data?.detail || `HTTP ${response.status}`, response.status, data?.codigo || 'http');
    return { status: response.status, data };
  }
}

const SESION_PERDIDA = new Set([401, 403, 404]);

/** UUID v4. randomUUID exige contexto seguro (HTTPS o localhost); si falta, usa getRandomValues. */
export function nuevoUUID() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Sesión de un intento. Eventos de salida (callbacks opcionales):
 *  onChange(sesion)                → cambió estado/pendientes (para HUD)
 *  onConfirmed(evento, tarea)      → clasificación confirmada por RDS (evento del histórico)
 *  onRejected(error, tarea)        → el servidor rechazó definitivamente la tarea (409/422)
 *  onSummary(dashboard)            → {resumen, contenedores} leído tras confirmar
 *  onFinished(resumen, tipo)       → intento finalizado/cancelado
 *  onLost(error)                   → token/intento ya no válidos
 */
export class SyncSession {
  constructor(client, callbacks = {}, { baseDelayMs = 1000, maxDelayMs = 30000, random = Math.random,
    uuid = nuevoUUID } = {}) {
    this.client = client;
    this.cb = callbacks;
    this.baseDelay = baseDelayMs;
    this.maxDelay = maxDelayMs;
    this.random = random;
    this.uuid = uuid;
    this.reset();
  }

  reset() {
    clearTimeout(this._timer);
    this.id = null;
    this.token = null;           // solo en memoria
    this.estado = 'inactivo';    // inactivo|iniciando|activo|finalizado|cancelado|perdido
    this.queue = [];
    this.busy = false;
    this.fallos = 0;
    this.reintentoEn = null;     // timestamp (ms) del próximo reintento
    this.ultimoError = null;
    this._timer = null;
    this._esperas = [];
    this._emit();
  }

  get activo() { return this.estado === 'activo'; }
  get pendientes() { return this.queue.length; }

  _emit() { this._call('onChange', this); }

  _call(nombre, ...args) {
    try { this.cb[nombre]?.(...args); } catch (error) { console.error(`SyncSession.${nombre}`, error); }
  }

  async iniciar() {
    if (this.estado === 'iniciando') throw new ApiError('Ya se está creando un intento', 0, 'ocupado');
    this.estado = 'iniciando';
    this._emit();
    try {
      const { data } = await this.client.request('POST', '/intentos');
      this.id = data.id_intento;
      this.token = data.token;
      this.estado = 'activo';
      this.ultimoError = null;
      return this.id;
    } catch (error) {
      this.estado = 'inactivo';
      this.ultimoError = error;
      throw error;
    } finally {
      this._emit();
    }
  }

  /** Encola una clasificación (un depósito estable). Devuelve la tarea con su UUID fijo. */
  clasificar(codigo, idContenedor, meta = {}) {
    if (!this.activo) throw new ApiError('No hay un intento activo', 0, 'sin_intento');
    const tarea = { tipo: 'evento', clave: this.uuid(), codigo, id_contenedor: idContenedor, meta, intentos: 0 };
    this.queue.push(tarea);
    this._emit();
    this._pump();
    return tarea;
  }

  /** Encola PUT /finalizar (tras 20/20 confirmados). */
  finalizar() { return this._cerrar('finalizar'); }

  /** Cancela un intento activo. Requiere cola vacía (el aula bloquea el reinicio hasta entonces). */
  cancelar() { return this._cerrar('cancelar'); }

  _cerrar(tipo) {
    if (this.estado !== 'activo') return Promise.resolve(null);
    if (this.queue.some((t) => t.tipo === tipo)) return this._esperar();
    this.queue.push({ tipo, intentos: 0 });
    this._emit();
    const promesa = this._esperar();
    this._pump();
    return promesa;
  }

  /** Promesa que se resuelve cuando la cola queda vacía (o se rechaza si la sesión se pierde). */
  _esperar() {
    if (!this.queue.length) return Promise.resolve(null);
    return new Promise((resolve, reject) => this._esperas.push({ resolve, reject }));
  }

  /** Al cerrar la pestaña con un intento activo: cancelación best-effort (keepalive). */
  cancelarAlSalir() {
    if (!this.activo || !this.token) return;
    this.client.request('PUT', `/intentos/${this.id}/cancelar`, { token: this.token, keepalive: true }).catch(() => {});
  }

  /** Fuerza un reintento inmediato (p. ej. al volver la red). */
  reintentarYa() {
    if (!this.queue.length || this.busy) return;
    clearTimeout(this._timer);
    this.reintentoEn = null;
    this._pump();
  }

  _espera() {
    const base = Math.min(this.maxDelay, this.baseDelay * 2 ** Math.max(0, this.fallos - 1));
    return Math.round(base * (0.5 + this.random() * 0.5));
  }

  async _pump() {
    if (this.busy || this.reintentoEn !== null) return;
    this.busy = true;
    try {
      while (this.queue.length && (this.estado === 'activo')) {
        const tarea = this.queue[0];
        tarea.intentos++;
        try {
          await this._enviar(tarea);
          this.queue.shift();
          this.fallos = 0;
          this.ultimoError = null;
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          this.ultimoError = error;
          if (error.reintentable) {
            this.fallos++;
            const espera = this._espera();
            this.reintentoEn = Date.now() + espera;
            this._timer = setTimeout(() => { this.reintentoEn = null; this._pump(); }, espera);
            return;
          }
          if (SESION_PERDIDA.has(error.status) || error.codigo === 'intento_cerrado') {
            this._perder(error);
            return;
          }
          // Rechazo definitivo (409/422): se descarta la tarea y se informa.
          this.queue.shift();
          this._call('onRejected', error, tarea);
        } finally {
          this._emit();
        }
      }
    } finally {
      this.busy = false;
      if (!this.queue.length) this._resolverEsperas();
      this._emit();
    }
  }

  async _enviar(tarea) {
    const ruta = `/intentos/${this.id}`;
    if (tarea.tipo === 'evento') {
      const { data } = await this.client.request('POST', `${ruta}/eventos`, {
        token: this.token, body: { codigo: tarea.codigo, id_contenedor: tarea.id_contenedor, clave_evento: tarea.clave },
      });
      this._call('onConfirmed', data, tarea);
      await this.refrescar();
      return;
    }
    const { data } = await this.client.request('PUT', `${ruta}/${tarea.tipo}`, { token: this.token });
    this.estado = tarea.tipo === 'finalizar' ? 'finalizado' : 'cancelado';
    this.token = null; // ya no se necesita
    this._call('onFinished', data, tarea.tipo);
  }

  /** Lectura del resumen confirmado (no reintenta: el siguiente evento vuelve a sincronizar). */
  async refrescar() {
    try {
      const { data } = await this.client.request('GET', `/intentos/${this.id}/dashboard`);
      this._call('onSummary', data);
    } catch { /* el evento ya se confirmó; el contador se actualiza con el propio evento */ }
  }

  _perder(error) {
    this.estado = 'perdido';
    const descartadas = this.queue.splice(0);
    this.token = null;
    clearTimeout(this._timer);
    this.reintentoEn = null;
    this._call('onLost', error, descartadas);
    for (const { reject } of this._esperas.splice(0)) reject(error);
  }

  _resolverEsperas() {
    for (const { resolve } of this._esperas.splice(0)) resolve(null);
  }

  /** Texto breve para HUD / DOM. */
  describir(ahora = Date.now()) {
    switch (this.estado) {
      case 'inactivo': return this.ultimoError ? `Servidor: ${this.ultimoError.message}` : 'Servidor: sin intento';
      case 'iniciando': return 'Servidor: creando intento…';
      case 'perdido': return 'Servidor: sesión perdida · pulsa Reiniciar';
      case 'finalizado': return `Servidor: intento #${this.id} finalizado`;
      case 'cancelado': return `Servidor: intento #${this.id} cancelado`;
      default: {
        if (this.reintentoEn !== null) {
          const s = Math.max(1, Math.ceil((this.reintentoEn - ahora) / 1000));
          return `Servidor: error de sincronización · reintento en ${s} s (${this.pendientes} pendiente${this.pendientes === 1 ? '' : 's'})`;
        }
        if (this.pendientes) return `Servidor: #${this.id} · confirmando ${this.pendientes} pendiente${this.pendientes === 1 ? '' : 's'}…`;
        return `Servidor: #${this.id} · sincronizado`;
      }
    }
  }
}
