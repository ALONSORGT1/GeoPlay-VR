// Pruebas de la cola de sincronización (Node ≥ 18):  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, SyncSession, nuevoUUID } from '../js/api.js';

/** Servidor simulado con la semántica de los SP (idempotencia por UUID, pieza ya acertada). */
function servidor({ fallarRed = 0, perderRespuesta = 0 } = {}) {
  const s = { eventos: [], llamadas: [], fallarRed, perderRespuesta, estado: 'EN_CURSO', token: 'f'.repeat(64) };
  const tipo = { ESF: 1, CUB: 2, PIR: 3, HEX: 4 };
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
  s.fetch = async (url, init) => {
    const path = url.replace('http://api', '');
    s.llamadas.push(`${init.method} ${path}`);
    if (s.fallarRed > 0) { s.fallarRed--; throw new TypeError('Failed to fetch'); }
    const auth = init.headers.Authorization === `Bearer ${s.token}`;
    if (init.method === 'POST' && path === '/intentos') return json(201, { id_intento: 7, token: s.token });
    if (init.method === 'GET') {
      const aciertos = s.eventos.filter((e) => e.es_correcto).length;
      return json(200, { resumen: { id_intento: 7, aciertos, errores: s.eventos.length - aciertos, estado: s.estado }, contenedores: [] });
    }
    if (!auth) return json(403, { detail: 'Token inválido', codigo: 'token_invalido' });
    if (path.endsWith('/eventos')) {
      const b = JSON.parse(init.body);
      let e = s.eventos.find((x) => x.clave_evento === b.clave_evento);
      if (!e) {
        if (s.estado !== 'EN_CURSO') return json(409, { detail: 'Intento cerrado', codigo: 'intento_cerrado' });
        if (s.eventos.some((x) => x.codigo === b.codigo && x.es_correcto)) return json(409, { detail: 'Objeto ya clasificado', codigo: 'objeto_ya_clasificado' });
        e = { id_evento: s.eventos.length + 1, codigo: b.codigo, clave_evento: b.clave_evento, es_correcto: tipo[b.codigo.slice(0, 3)] === b.id_contenedor };
        s.eventos.push(e);
      }
      if (s.perderRespuesta > 0) { s.perderRespuesta--; throw new TypeError('respuesta perdida'); }
      return json(201, e);
    }
    if (path.endsWith('/finalizar')) {
      if (s.eventos.filter((e) => e.es_correcto).length !== 20) return json(409, { detail: 'Faltan objetos', codigo: 'faltan_objetos' });
      s.estado = 'FINALIZADO'; return json(200, { estado: 'FINALIZADO' });
    }
    if (path.endsWith('/cancelar')) { s.estado = 'CANCELADO'; return json(200, { estado: 'CANCELADO' }); }
    return json(404, { detail: 'no', codigo: 'x' });
  };
  return s;
}

function sesion(s, cb = {}) {
  const registro = { confirmados: [], rechazados: [], resumenes: [], perdida: null, fin: null };
  const ses = new SyncSession(new ApiClient('http://api', { fetchImpl: s.fetch }), {
    onConfirmed: (e) => registro.confirmados.push(e), onRejected: (e) => registro.rechazados.push(e.codigo),
    onSummary: (d) => registro.resumenes.push(d.resumen), onLost: (e) => { registro.perdida = e; },
    onFinished: (r, t) => { registro.fin = t; }, ...cb,
  }, { baseDelayMs: 5, maxDelayMs: 20, random: () => 0 });
  return { ses, registro };
}

const vaciar = (ses) => new Promise((r) => { const t = setInterval(() => { if (!ses.pendientes && !ses.busy) { clearInterval(t); r(); } }, 2); });

test('uuid v4 válido (también con el respaldo getRandomValues)', () => {
  assert.match(nuevoUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('token solo en memoria y orden serial de eventos', async () => {
  const s = servidor(); const { ses, registro } = sesion(s);
  assert.equal(await ses.iniciar(), 7);
  ses.clasificar('ESF-01', 1); ses.clasificar('CUB-01', 3); ses.clasificar('PIR-01', 3);
  assert.equal(ses.pendientes, 3);
  await vaciar(ses);
  assert.deepEqual(registro.confirmados.map((e) => [e.codigo, e.es_correcto]), [['ESF-01', true], ['CUB-01', false], ['PIR-01', true]]);
  assert.deepEqual(s.llamadas.filter((l) => l.startsWith('POST /intentos/')).length, 3);
  assert.equal(registro.resumenes.at(-1).aciertos, 2);
});

test('fallo de red: reintenta con el MISMO UUID y espera creciente', async () => {
  const s = servidor(); const { ses, registro } = sesion(s);
  await ses.iniciar(); s.fallarRed = 2;
  const tarea = ses.clasificar('ESF-01', 1);
  await new Promise((r) => setTimeout(r, 1));
  assert.match(ses.describir(), /reintento/);
  await vaciar(ses);
  assert.equal(tarea.intentos, 3);
  assert.equal(s.eventos.length, 1); assert.equal(s.eventos[0].clave_evento, tarea.clave);
  assert.equal(registro.confirmados.length, 1);
});

test('respuesta perdida tras el COMMIT: el reintento es idempotente y no suma dos veces', async () => {
  const s = servidor(); const { ses, registro } = sesion(s);
  await ses.iniciar(); s.perderRespuesta = 1;
  ses.clasificar('ESF-01', 1);
  await vaciar(ses);
  assert.equal(s.eventos.length, 1);
  assert.equal(registro.confirmados.length, 1);
  assert.equal(registro.resumenes.at(-1).aciertos, 1);
});

test('pieza ya acertada con otro UUID: rechazo definitivo, la cola continúa', async () => {
  const s = servidor(); const { ses, registro } = sesion(s);
  await ses.iniciar();
  ses.clasificar('ESF-01', 1); ses.clasificar('ESF-01', 1); ses.clasificar('CUB-01', 2);
  await vaciar(ses);
  assert.deepEqual(registro.rechazados, ['objeto_ya_clasificado']);
  assert.equal(registro.confirmados.length, 2);
});

test('sesión perdida (403): se avisa y se descartan pendientes', async () => {
  const s = servidor(); const { ses, registro } = sesion(s);
  await ses.iniciar(); s.token = '0'.repeat(64);
  ses.clasificar('ESF-01', 1); ses.clasificar('ESF-02', 1);
  await vaciar(ses);
  assert.equal(ses.estado, 'perdido'); assert.equal(registro.perdida.status, 403);
  assert.equal(ses.pendientes, 0); assert.equal(ses.token, null);
  assert.throws(() => ses.clasificar('ESF-03', 1));
});

test('finalizar tras 20/20 y cancelar con la cola vacía', async () => {
  const s = servidor(); const { ses, registro } = sesion(s);
  await ses.iniciar();
  for (const p of ['ESF', 'CUB', 'PIR', 'HEX']) for (let n = 1; n <= 5; n++) ses.clasificar(`${p}-0${n}`, { ESF: 1, CUB: 2, PIR: 3, HEX: 4 }[p]);
  await vaciar(ses);
  await ses.finalizar();
  assert.equal(ses.estado, 'finalizado'); assert.equal(registro.fin, 'finalizar'); assert.equal(ses.token, null);
  const otra = sesion(servidor());
  await otra.ses.iniciar(); otra.ses.clasificar('ESF-01', 1);
  await otra.ses.cancelar(); // espera a que la cola (evento + cancelar) termine en orden
  assert.equal(otra.ses.estado, 'cancelado'); assert.equal(otra.registro.confirmados.length, 1);
});

test('el cliente nunca envía es_correcto ni posiciones', async () => {
  const cuerpos = []; const s = servidor();
  const fetchEspia = (url, init) => { if (init.body) cuerpos.push(JSON.parse(init.body)); return s.fetch(url, init); };
  const ses = new SyncSession(new ApiClient('http://api', { fetchImpl: fetchEspia }), {}, { baseDelayMs: 1 });
  await ses.iniciar(); ses.clasificar('HEX-02', 4); await vaciar(ses);
  assert.deepEqual(Object.keys(cuerpos[0]).sort(), ['clave_evento', 'codigo', 'id_contenedor']);
});
