// Prueba de extremo a extremo (Práctica 3.3): física real del aula → API → MySQL.
// Requiere el backend local en marcha. Abrir: ?synctest=1&autorun=1
import { ApiClient } from '../js/api.js';
import { API_CONFIG, SETTINGS, stationPoint } from '../js/config.js';
import { place, sync } from '../js/physics.js';

export async function runSyncTests({ world, items, bins, game, session, start, reset, interaction }) {
  const output = document.getElementById('test-results');
  output.hidden = false;
  const lines = [];
  let fallos = 0;
  const api = new ApiClient(API_CONFIG.API_BASE);
  const assert = (v, m = 'resultado inesperado') => { if (!v) throw Error(m); };
  const until = async (cond, ms = 15000, msg = 'tiempo agotado') => {
    const t0 = performance.now();
    while (!cond()) { if (performance.now() - t0 > ms) throw Error(msg); await new Promise((r) => setTimeout(r, 50)); }
  };
  // El aula pausa al perder el foco (comportamiento 3.2); la prueba reanuda antes de simular.
  const advance = (seconds) => { if (game.status === 'pausado') game.start(); for (let i = 0; i < seconds * 120; i++) { world.step(1 / 120); game.update(1 / 120, items, bins, world.contacts); } sync(items); };
  const drop = (item, bin, x = 0, z = 0) => { game.released(item); place(item, stationPoint(bin.index, x, 1.48, z - 0.02)); };
  const slots = [[-.12, -.10], [0, -.10], [.12, -.10], [-.065, .07], [.065, .07]];
  const binOf = (cat) => bins.find((b) => b.category === cat);
  const dashboard = async () => (await api.request('GET', `/intentos/${session.id}/dashboard`)).data;
  async function check(nombre, fn) {
    try { await fn(); lines.push(`APROBADO · ${nombre}`); }
    catch (e) { fallos++; lines.push(`FALLÓ · ${nombre}: ${e.message}`); }
    output.textContent = lines.join('\n');
  }

  const esferas = items.filter((p) => p.categoria === 'esfera');
  let primerId = null;

  await check('Comenzar crea el intento en el servidor; el token solo vive en memoria', async () => {
    await start();
    assert(session.activo && session.id > 0 && game.status === 'jugando', `estado ${session.estado}`);
    primerId = session.id;
    const token = session.token;
    assert(/^[0-9a-f]{64}$/.test(token));
    const persistido = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie + location.href;
    assert(!persistido.includes(token), 'token persistido fuera de memoria');
    assert(items.map((i) => i.codigo).sort().join() === ['ESF', 'CUB', 'PIR', 'HEX'].flatMap((p) => [1, 2, 3, 4, 5].map((n) => `${p}-0${n}`)).sort().join());
  });

  await check('Tres depósitos erróneos: un evento por depósito estable, error decidido por RDS', async () => {
    const p = esferas[4], cubos = binOf('cubo');
    for (let n = 1; n <= 3; n++) {
      drop(p, cubos); advance(5);
      assert(['sincronizando', 'error'].includes(p.estado), `estado ${p.estado}`);
      await until(() => session.pendientes === 0 && p.estado === 'error');
      assert(game.errors === n && game.hits === 0, `errores ${game.errors}`);
    }
    const d = await dashboard();
    assert(d.resumen.errores === 3 && d.resumen.aciertos === 0, JSON.stringify(d.resumen));
    place(p, stationPoint(p.mesaOrigen, 0, SETTINGS.tableTop, .32)); // devolver a la mesa
    p.estado = 'disponible'; p.confirmed = false; p.malla.material.emissiveIntensity = 0;
  });

  await check('Reinicio bloqueado mientras hay un evento pendiente; la pieza pendiente no se puede agarrar', async () => {
    const q = esferas[0];
    drop(q, binOf('esfera'), ...slots[0]); advance(5);
    assert(q.estado === 'sincronizando' && session.pendientes === 1, `estado ${q.estado}`);
    const mano = {};
    interaction.press(mano, q.malla, null);
    assert(!mano.held && !q.holder, 'se pudo agarrar una pieza pendiente de confirmar');
    const idAntes = session.id;
    reset();
    assert(/bloqueado/.test(game.message) && session.id === idAntes && q.estado === 'sincronizando', game.message);
    await until(() => session.pendientes === 0);
    assert(q.estado === 'clasificado' && game.hits === 1);
  });

  await check('Respuesta perdida después del COMMIT: reintento con el mismo UUID, sin doble conteo', async () => {
    const real = session.client.fetch;
    let perder = true;
    session.client.fetch = async (url, init) => {
      const r = await real(url, init);
      if (perder && init.method === 'POST' && url.endsWith('/eventos')) { perder = false; throw new TypeError('respuesta perdida'); }
      return r;
    };
    try {
      const q = esferas[1];
      drop(q, binOf('esfera'), ...slots[1]); advance(5);
      await until(() => session.reintentoEn !== null, 3000, 'no entró en reintento');
      assert(/reintento/.test(session.describir()));
      await until(() => session.pendientes === 0 && q.estado === 'clasificado', 10000);
    } finally { session.client.fetch = real; }
    const eventos = (await api.request('GET', `/intentos/${session.id}/eventos`)).data;
    assert(eventos.length === 5 && game.hits === 2, `eventos ${eventos.length}, aciertos ${game.hits}`);
  });

  await check('Los 20 aciertos se confirman en RDS y el intento se finaliza solo (20/20 → PUT /finalizar)', async () => {
    for (const bin of bins) {
      items.filter((p) => p.categoria === bin.category).forEach((p, i) => {
        if (p.estado === 'clasificado') return;
        drop(p, bin, ...slots[i]); advance(5);
      });
    }
    await until(() => session.estado === 'finalizado', 30000, `estado ${session.estado}, aciertos ${game.hits}, pendientes ${session.pendientes}`);
    const d = await dashboard();
    assert(d.resumen.estado === 'FINALIZADO' && d.resumen.aciertos === 20 && d.resumen.errores === 3, JSON.stringify(d.resumen));
    assert(d.contenedores.every((c) => c.aciertos === 5 && c.tiempo_finalizacion_ms !== null));
    assert(game.hits === 20 && game.errors === 3 && game.status === 'completado');
    assert(Object.values(game.times).every((t) => t > 0), 'tiempos por recipiente');
    assert(session.token === null, 'el token debe descartarse al finalizar');
  });

  await check('Reiniciar tras finalizar no cancela; un intento nuevo y su cancelación se registran', async () => {
    await reset();
    assert(session.estado === 'inactivo' && game.hits === 0);
    assert((await api.request('GET', `/intentos/${primerId}/dashboard`)).data.resumen.estado === 'FINALIZADO');
    await start();
    const nuevo = session.id;
    assert(nuevo > primerId, 'nuevo ID');
    await reset(); // intento activo sin pendientes → PUT /cancelar
    const r = (await api.request('GET', `/intentos/${nuevo}/dashboard`)).data.resumen;
    assert(r.estado === 'CANCELADO', r.estado);
    const ultimos = (await api.request('GET', '/intentos/ultimos')).data;
    assert(ultimos[0].id_intento === nuevo && ultimos.some((u) => u.id_intento === primerId));
  });

  lines.push('', `${lines.length - fallos}/${lines.length} pruebas de sincronización aprobadas contra ${API_CONFIG.API_BASE}.`);
  output.textContent = lines.join('\n');
  document.documentElement.dataset.syncTestStatus = fallos ? 'failed' : 'passed';
}
