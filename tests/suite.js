import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { testXRInput } from './xr-input.js';
import { CATEGORIES, SETTINGS, stationPoint } from '../js/config.js';
import { Game } from '../js/game.js';
import { place, sync, updateRecoveryState } from '../js/physics.js';
export function runTests({world,items,bins,game,reset,interaction,renderer}) {
  const output=document.getElementById('test-results');output.hidden=false;const lines=[], results=[];
  function check(name,test){try{test();lines.push(`APROBADO · ${name}`);results.push({name,pass:true});}catch(e){lines.push(`FALLÓ · ${name}: ${e.message}`);results.push({name,pass:false});}}
  function assert(value,message='resultado inesperado'){if(!value)throw Error(message);}
  function advance(seconds,score=game){for(let i=0;i<seconds*120;i++){world.step(1/120);score.update(1/120,items,bins,world.contacts);}sync(items);}
  function drop(item,bin,x=0,z=0){game.released(item);place(item,stationPoint(bin.index,x,1.48,z-.02));}
  interaction.releaseAll();reset();
  check('Entradas XR simuladas: gatillo, pinza, cambio de fuente y pérdida de pose',()=>testXRInput(assert));
  check('20 cuerpos, 5 por categoría y 5 por mesa',()=>{
    assert(items.length===20);for(const c of CATEGORIES)assert(items.filter(i=>i.categoria===c.id).length===5);
    for(let i=0;i<4;i++)assert(items.filter(p=>p.mesaOrigen===i).length===5);
  });
  check('Cuatro mesas con colisionadores y cuatro botes sin techo',()=>{
    const statics=world.bodies.filter(b=>b.mass===0);for(let i=0;i<4;i++)assert(statics.filter(b=>b.userData?.binIndex===i).length===5);
    assert(statics.filter(b=>b.shapes.some(s=>s instanceof CANNON.Box && Math.abs(s.halfExtents.y-.0375)<.0001)).length===4);
  });
  check('Reinicio distinto, mezcla garantizada y sin solapamientos',()=>{
    const previous=items.map(i=>`${i.mesaOrigen}:${i.cuerpoFisico.position.x}`);reset();assert(items.some((p,i)=>`${p.mesaOrigen}:${p.cuerpoFisico.position.x}`!==previous[i]));
    for(let s=0;s<4;s++)assert(new Set(items.filter(i=>i.mesaOrigen===s).map(i=>i.categoria)).size===4);
    for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)assert(items[i].cuerpoFisico.position.distanceTo(items[j].cuerpoFisico.position)>items[i].radius+items[j].radius);
    for(const p of items){p.cuerpoFisico.updateAABB();assert(Math.abs(p.cuerpoFisico.aabb.lowerBound.y-SETTINGS.tableTop)<.003);}
  });
  check('Las veinte piezas se asientan físicamente sobre las mesas',()=>{
    advance(2);for(const p of items){p.cuerpoFisico.updateAABB();assert(Math.abs(p.cuerpoFisico.aabb.lowerBound.y-SETTINGS.tableTop)<.015,`${p.id}: pos=${p.cuerpoFisico.position.toString()}, y=${p.cuerpoFisico.aabb.lowerBound.y}, v=${p.cuerpoFisico.velocity.toString()}`);}
  });
  check('Gravedad, rebote y reposo sobre suelo',()=>{
    const p=items[0],b=p.cuerpoFisico;place(p,{x:3,y:.8,z:1});const initial=b.position.y;advance(.1);assert(b.position.y<initial);
    let bounce=false;for(let i=0;i<200;i++){world.step(1/120);if(b.velocity.y>.1)bounce=true;}assert(bounce,'no hubo rebote');advance(2);b.updateAABB();assert(b.aabb.lowerBound.y>-.01 && b.aabb.lowerBound.y<.015);
  });
  check('Choque real entre piezas transmite impulso',()=>{
    const a=items[0].cuerpoFisico,b=items[1].cuerpoFisico;place(items[0],{x:3,y:.001,z:2});place(items[1],{x:3.19,y:.001,z:2});a.velocity.set(1.5,0,0);
    let impulse=false;for(let i=0;i<40;i++){world.step(1/120);if(b.velocity.x>.05)impulse=true;}assert(impulse);
  });
  reset();game.start();
  check('Agarrar bloquea doble selección y libera con cuerpo dinámico',()=>{
    const p=items[0],h=new THREE.Object3D();h.position.copy(p.cuerpoFisico.position);h.updateMatrixWorld(true);sync(items);
    const a={},b={};interaction.press(a,p.malla,h);interaction.press(b,p.malla,h);
    assert(a.held===p && !b.held && p.estado==='sujeto');interaction.release(a);assert(p.cuerpoFisico.type===CANNON.Body.DYNAMIC && p.cuerpoFisico.mass===.14 && p.estado==='liberado');
  });
  reset();game.start();
  check('Recuperar una pieza caída conserva inventario y puntuación',()=>{
    // Repetir con las veinte piezas cubre ambas filas, categorías y mesas.
    for(const p of items){
      reset();game.start();game.released(p);place(p,{x:3,y:.5,z:1});advance(2);updateRecoveryState(p);
      assert(p.estado==='recuperable',`${p.id}: no se detectó caída`);const score=[game.hits,game.errors,game.attempts].join(',');document.getElementById('recover').click();
      p.cuerpoFisico.updateAABB();assert(p.estado==='disponible' && Math.abs(p.cuerpoFisico.aabb.lowerBound.y-SETTINGS.tableTop)<.003,`${p.id}: no se recuperó`);
      assert(items.length===20 && score===[game.hits,game.errors,game.attempts].join(','));
    }
  });
  reset();game.start();
  check('Tres depósitos erróneos: exactamente 3 errores / 3 intentos',()=>{
    const p=items[0],wrong=bins.find(b=>b.category!==p.categoria);
    for(let n=0;n<3;n++){drop(p,wrong);advance(5);assert(game.errors===n+1,`intento ${n+1}: ${game.errors} errores; estado ${p.estado}, inside=${game.inside(p,wrong)}, entered=${p.entered}, stable=${p.stable}, pos=${p.cuerpoFisico.position.toString()}, v=${p.cuerpoFisico.velocity.toString()}, w=${p.cuerpoFisico.angularVelocity.toString()}`);advance(1);assert(game.errors===n+1);}
    assert(game.hits===0 && game.attempts===3 && game.accuracy===0);
  });
  check('No cuenta borde, vuelo ni entrada sin trayectoria por boca',()=>{
    const p=items[1],bin=bins[0],before=game.attempts;
    drop(p,bin,.21,0);advance(3);assert(game.attempts===before);
    place(p,stationPoint(bin.index,0,SETTINGS.binBottom,-.02));game.released(p);advance(3);assert(game.attempts===before);
  });
  reset();game.start();
  check('20 depósitos correctos reales, sin duplicados, cinco por bote',()=>{
    for(const bin of bins){const group=items.filter(p=>p.categoria===bin.category);
      const slots=[[-.12,-.10],[0,-.10],[.12,-.10],[-.065,.07],[.065,.07]];
      group.forEach((p,i)=>{drop(p,bin,...slots[i]);advance(5);assert(p.estado==='clasificado',`${p.id}: ${p.estado}, inside=${game.inside(p,bin)}, entered=${p.entered}, pos=${p.cuerpoFisico.position.toString()}, estable=${p.stable.toFixed(2)}, v=${p.cuerpoFisico.velocity.toString()}, w=${p.cuerpoFisico.angularVelocity.toString()}`);});
    }
    assert(game.hits===20 && game.attempts===20);for(const c of CATEGORIES)assert(game.counts[c.id]===5);
  });
  check('Tiempos por bote desde inicio y cronómetro final detenido',()=>{
    assert(game.status==='completado');const times=Object.values(game.times);assert(times.every(t=>t>0 && t<=game.elapsed));assert(times[3]>times[0]);
    const t=game.elapsed;advance(2);assert(game.elapsed===t && game.hits===20);
  });
  check('Precisión verificada y pausa no suma tiempo',()=>{
    const g=new Game();assert(g.accuracy===0);g.hits=2;g.attempts=5;assert(g.accuracy===40);g.start();g.update(1,[],[],[]);g.pause();g.update(20,[],[],[]);assert(g.elapsed===1);
  });
  check('Clasificados no se pueden agarrar',()=>{const p=items[0],s={},h=new THREE.Object3D();interaction.press(s,p.malla,h);assert(!s.held);});
  check('Reiniciar restaura estados y no crea bodies huérfanos',()=>{
    const count=world.bodies.length;for(let n=0;n<10;n++)reset();assert(world.bodies.length===count);assert(game.hits===0 && game.attempts===0 && game.errors===0 && game.elapsed===0);
    assert(items.every(i=>i.estado==='disponible' && !i.holder && !i.eventos.length));
  });
  const pass=results.filter(r=>r.pass).length;lines.push(`\n${pass}/${results.length} pruebas aprobadas. WebGL: ${renderer.capabilities.isWebGL2?'2':'disponible'}.`);
  lines.push('NO PROBADO EN VISOR: tracking real, ergonomía, frecuencia XR y audio espacial.');
  output.textContent=lines.join('\n');document.documentElement.dataset.testStatus=pass===results.length?'passed':'failed';
  console.log(output.textContent);reset();return results;
}
