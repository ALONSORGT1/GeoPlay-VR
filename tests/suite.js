import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { testXRInput, testPackedBin } from './xr-input.js';
import { CATEGORIES, SETTINGS, STATIONS, stationPoint, localPoint } from '../js/config.js';
import { Game } from '../js/game.js';
import { advancePhysics, place, sync, updateRecoveryState } from '../js/physics.js';
export function runTests({world,items,bins,game,reset,interaction,renderer,hud,renderFrame,scene,camera,occluders}) {
  const output=document.getElementById('test-results');output.hidden=false;const lines=[], results=[];
  function check(name,test){try{test();lines.push(`APROBADO · ${name}`);results.push({name,pass:true});}catch(e){lines.push(`FALLÓ · ${name}: ${e.message}`);results.push({name,pass:false});}}
  function assert(value,message='resultado inesperado'){if(!value)throw Error(message);}
  function advance(seconds,score=game){for(let i=0;i<seconds*120;i++){world.step(1/120);score.update(1/120,items,bins,world.contacts);}sync(items);}
  function drop(item,bin,x=0,z=0){game.released(item);place(item,stationPoint(bin.index,x,1.48,z-.02));}
  interaction.releaseAll();reset();
  check('El HUD 3D avanza al soltar en la boca y vuelve a cero al reiniciar',()=>{
    const item=items.find(p=>p.categoria==='esfera');
    const bin=bins.find(b=>b.category===item.categoria);
    const map=hud.panel.material.map;
    const ctx=map.image.getContext('2d');
    const segment=()=>Array.from(ctx.getImageData(1160,109,1,1).data).join(',');
    const empty=segment();
    const tick=()=>renderFrame(performance.now());
    hud.buttons[0].userData.action();
    const holder=new THREE.Object3D(), state={};
    holder.position.copy(item.cuerpoFisico.position);
    interaction.press(state,item.malla,holder);
    tick();
    assert(document.getElementById('feedback').textContent.includes('en mano'));
    // El centro ya está bajo el borde y solo sobresale la parte superior de la esfera.
    place(item,stationPoint(bin.index,0,SETTINGS.binTop-2*item.radius+.007,-.02));
    interaction.release(state);
    advance(.4);tick();
    assert(game.hits===0 && segment()===empty,'acierto antes del reposo');
    const before=map.version;
    advance(2);tick();
    assert(game.hits===1 && game.counts.esfera===1,'depósito a ras de la boca');
    assert(map.version>before && segment()!==empty,'la textura inmersiva no cambió');
    assert(document.getElementById('score').textContent.includes('1/20 · Faltan 19'));
    reset();assert(segment()===empty && game.elapsed===0,'barra residual al reiniciar');
  });
  reset();
  check('Salón 1:1, piso en Y=0, vanos, trabe y espacio central de interacción',()=>{
    const room=scene.getObjectByName('Salon');
    const bounds=new THREE.Box3().setFromObject(room,true);
    const size=bounds.getSize(new THREE.Vector3());
    assert(size.distanceTo(new THREE.Vector3(7.50,3.30,8.60))<.0001 && Math.abs(bounds.min.y)<.0001);
    const overview=camera.position.y>2;
    if(overview) document.getElementById('view').click();
    assert(camera.position.y===1.65 && camera.getWorldScale(new THREE.Vector3()).distanceTo(new THREE.Vector3(1,1,1))<1e-6,'altura y escala de usuario');
    if(overview) document.getElementById('view').click();
    const named=name=>world.bodies.filter(b=>b.userData?.name===name);
    const beam=named('trabe_central')[0];beam.updateAABB();assert(Math.abs(beam.aabb.lowerBound.y-2.80)<.0001);
    assert(named('ventana_este_sur').length===13 && named('ventana_este_norte').length===13);
    assert(named('puerta_oeste').length===6);
    for(const [i] of STATIONS.entries()) for(const x of [-.43,.43]) for(const z of [-.255,.685]){
      const p=stationPoint(i,x,SETTINGS.tableTop,z);
      assert(Math.abs(p.x)<3.55-.90 && Math.abs(p.z)<4.10-.90,'pasillo perimetral');
      assert(Math.hypot(p.x,p.z)<3,'alcance del rayo');
    }
    assert(STATIONS.every(s=>Math.hypot(s.x,s.z)-.685>1),'radio central libre');
  });
  check('Las veinte piezas y los cuatro botones son accesibles desde el centro',()=>{
    scene.updateMatrixWorld(true);
    const targets=[...items.map(item=>item.malla),...hud.buttons];
    const board=scene.getObjectByName('Salon').userData.solids.find(part=>part.name==='pizarron_sur');
    const panelBounds=new THREE.Box3().setFromObject(hud.panel);
    assert(panelBounds.min.z>board.max[2] && panelBounds.min.z-board.max[2]<.002,'marcador fuera de la superficie');
    assert(panelBounds.min.x>=board.min[0] && panelBounds.max.x<=board.max[0] &&
      panelBounds.min.y>=board.min[1] && panelBounds.max.y<=board.max[1],'la proyección rebasa el pizarrón');
    const holder=new THREE.Object3D(), point=new THREE.Vector3();
    holder.position.set(0,1.35,0);
    for(const mesh of targets){
      const direction=mesh.getWorldPosition(point).sub(holder.position).normalize();
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),direction);
      assert(interaction.hitFrom(holder)?.object===mesh,'rayo obstruido');
    }
  });
  check('El rayo llega también al texto y a los bordes visibles del pizarrón',()=>{
    scene.updateMatrixWorld(true);
    const board=scene.getObjectByName('Salon').userData.solids.find(part=>part.name==='pizarron_sur');
    const ray=new THREE.Object3D(),forward=new THREE.Vector3(0,0,-1);
    for(const x of [-.7,0,.7]){
      ray.position.set(x,1.4,.2);
      for(const u of [.02,.5,.98]){
        const target=new THREE.Vector3(THREE.MathUtils.lerp(board.min[0],board.max[0],u),1.7,board.max[2]);
        ray.quaternion.setFromUnitVectors(forward,target.clone().sub(ray.position).normalize());
        const hit=interaction.hitFrom(ray);
        assert(hit && hit.point.distanceTo(target)<.005,'el puntero se cortó antes del pizarrón');
      }
    }
  });
  reset();game.start();
  check('El quinto cubo se deposita sobre cuatro ya clasificados con el mando XR',()=>{
    testPackedBin({world,items,bins,scene,game},assert);
  });
  reset();
  check('Lanzamientos rápidos de las cuatro formas contra vidrio, puerta, mesa, caja y piso',()=>{
    const glass=world.bodies.find(b=>b.userData?.name==='ventana_este_sur' && b.shapes[0].halfExtents.x<.004);
    const door=world.bodies.find(b=>b.userData?.name==='puerta_oeste');
    const walls=world.bodies.filter(b=>b.userData?.name==='pared_sur');
    function fire(item,p,v,test,label){
      place(item,p,0);
      item.cuerpoFisico.velocity.copy(v);item.cuerpoFisico.angularVelocity.set(12,21,-7);
      for(let i=0;i<5;i++) advancePhysics(world,[item],1/120,()=>{
        assert(test(item.cuerpoFisico.position),item.id+' / '+label);
      });
    }
    for(const category of CATEGORIES){
      const item=items.find(i=>i.categoria===category.id);
      for(const [body,axis,dir] of [[glass,'x',-1],[door,'x',1],[walls[0],'z',-1]]){
        const p=body.position.clone();p[axis]-=dir*.32;
        const v=new CANNON.Vec3();v[axis]=dir*32;
        fire(item,p,v,pos=>dir*(pos[axis]-body.position[axis])<0,body.userData.name);
      }
      fire(item,{x:2.8,y:.40,z:2},{x:0,y:-36,z:0},p=>p.y>0,'piso');
      fire(item,stationPoint(0,0,1.15,.42),{x:0,y:-32,z:0},p=>p.y>SETTINGS.tableTop-.03,'mesa');
      const s=STATIONS[0],v={x:Math.cos(s.angle)*27,y:0,z:-Math.sin(s.angle)*27};
      fire(item,stationPoint(0,0,SETTINGS.binBottom+.06,-.02),v,
        p=>localPoint(0,p).x<SETTINGS.binHalf+.0175,'caja');
      reset();
    }
  });
  reset();
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
  check('Caída libre y reposo de las cuatro formas sin rebotes amplificados',()=>{
    assert(world.gravity.almostEquals(new CANNON.Vec3(0,-9.81,0)));
    const p=items[0],b=p.cuerpoFisico;place(p,{x:3,y:.8,z:1});const initial=b.position.y;advance(.1);
    assert(Math.abs(initial-b.position.y-.5*9.81*.1**2)<.006,'distancia de caída en 100 ms');
    for(const [k,category] of CATEGORIES.entries()){
      const piece=items.find(item=>item.categoria===category.id), body=piece.cuerpoFisico;
      for(const height of [.15,.80,1.20]){
        place(piece,{x:2.7,y:height,z:.5+k*.4},.71);
        let landed=false,peak=0;
        for(let tick=0;tick<180;tick++) advancePhysics(world,items,1/120,()=>{
          if(world.contacts.some(c=>(c.bi===body && c.bj.userData?.name==='piso') ||
            (c.bj===body && c.bi.userData?.name==='piso'))) landed=true;
          if(landed){body.updateAABB();peak=Math.max(peak,body.aabb.lowerBound.y);}
        });
        assert(landed && peak<.005,`${category.name}, caída de ${height} m: rebote de ${peak} m`);
        assert(Math.abs(body.aabb.lowerBound.y)<.002 && body.velocity.length()<.02,'reposo sobre el piso');
      }
    }
  });
  check('El cubo se desliza, gira y pierde velocidad por contacto con el piso',()=>{
    const cube=items.find(p=>p.categoria==='cubo'),b=cube.cuerpoFisico;
    place(cube,{x:0,y:.001,z:2.4},0);
    b.velocity.set(1.7,0,0);b.angularVelocity.set(0,5,0);
    advance(.10);
    assert(b.position.x>.06 && Math.abs(b.quaternion.y)>.015,'desplazamiento y giro');
    assert(b.velocity.x>0 && b.velocity.x<1.65,'fricción al deslizar');
    advance(2);
    assert(b.velocity.length()<.02 && b.angularVelocity.length()<.05,'reposo final');
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
