import * as THREE from 'three';
import { createInteraction } from '../js/interaction.js';
import { Game, aboveOpening } from '../js/game.js';
import { createPhysics, createPieces, advancePhysics, place, sync } from '../js/physics.js';
import { SETTINGS, STATIONS, stationPoint } from '../js/config.js';

// Use the same held-body and release paths as a controller, including contact with a lower layer.
export function testPackedBin({world,items,bins,scene,game},assert) {
  const bin=bins.find(b=>b.category==='cubo'), cubes=items.filter(i=>i.categoria==='cubo');
  const yaw=STATIONS[bin.index].angle;
  function tick() {
    advancePhysics(world,items,SETTINGS.step,dt=>{
      for(const cube of cubes) if(cube.holder && aboveOpening(cube,bin)) cube.holder.entered=bin.index;
      game.update(dt,items,bins,world.contacts);
    });
    sync(items);
  }
  for(let i=0;i<4;i++){
    const cube=cubes[i];
    place(cube,stationPoint(bin.index,i%2?.045:-.045,1.2,(i<2?-.045:.045)-.02),yaw);
    game.released(cube);
    for(let n=0;n<240;n++) tick();
    assert(cube.estado==='clasificado','capa inferior del recipiente');
  }
  const last=cubes[4], b=last.cuerpoFisico;
  place(last,stationPoint(bin.index,0,1.22,-.02),yaw);
  const pos={x:b.position.x,y:b.position.y,z:b.position.z+1.3};
  const top=pos.y, source={targetRayMode:'tracked-pointer',targetRaySpace:{}};
  const session=Object.assign(new EventTarget(),{inputSources:[source],visibilityState:'visible'});
  const xr=Object.assign(new THREE.EventDispatcher(),{isPresenting:true,getSession:()=>session,getReferenceSpace:()=>({})});
  const aim={transform:{position:pos,orientation:{x:0,y:0,z:0,w:1}},linearVelocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0}};
  const frame={getPose:()=>aim};
  const input=createInteraction({scene,renderer:{xr},camera:new THREE.PerspectiveCamera(),items,bins,
    occluders:[],buttons:[],game,canvas:document.createElement('canvas')});
  const select=type=>session.dispatchEvent(Object.assign(new Event(type),{inputSource:source,frame}));
  xr.dispatchEvent({type:'sessionstart'});
  try {
    scene.updateMatrixWorld(true);input.update(1/60,frame);select('selectstart');
    assert(last.holder,'selección del quinto cubo');
    for(let n=0;n<100;n++){
      pos.y=Math.max(SETTINGS.binBottom,top-n*.008);
      input.update(1/60,frame);tick();tick();
    }
    // A wrist turn over a 1.3 m ray must not propel a cube resting on the other four.
    aim.angularVelocity.x=3.2;
    const height=b.position.y;
    select('selectend');
    let peak=height;
    for(let n=0;n<360;n++){tick();peak=Math.max(peak,b.position.y);}
    assert(peak-height<.02,`el quinto cubo se elevó ${(peak-height).toFixed(3)} m al soltar`);
    assert(game.counts.cubo===5 && cubes.every(c=>game.inside(c,bin)),'cinco cubos dentro y contados');
  } finally {xr.dispatchEvent({type:'sessionend'});}
}

export function testXRInput(assert) {
  const scene = new THREE.Scene();
  const game = new Game();
  const [piece] = createPieces(createPhysics(), scene);
  piece.cuerpoFisico.position.set(0, 0, -1);
  piece.malla.position.copy(piece.cuerpoFisico.position);
  const start = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3));
  start.position.set(1, 0, -1);
  start.userData.action = () => game.start();
  scene.add(start);
  scene.updateMatrixWorld(true);
  const session = new EventTarget();
  session.visibilityState = 'visible';
  const controller = {handedness:'right', targetRayMode:'tracked-pointer', targetRaySpace:{}};
  session.inputSources = [controller];
  const xr = Object.assign(new THREE.EventDispatcher(), {
    isPresenting:true, getSession:()=>session, getReferenceSpace:()=>({})
  });
  const interaction = createInteraction({scene, renderer:{xr}, camera:new THREE.PerspectiveCamera(),
    items:[piece], buttons:[start], occluders:[], game, canvas:document.createElement('canvas')});
  let aimX = 1, fingerGap = .04, tracking = true;
  const pose = x => ({transform:{position:{x,y:0,z:0}, orientation:{x:0,y:0,z:0,w:1}}});
  let velocities={};
  const frame = {getPose:()=>tracking ? {...pose(aimX),...velocities} : null, getJointPose:joint=>pose(joint==='index' ? fingerGap : 0)};
  const tick = () => interaction.update(1/90, frame);
  const emit = (type, details) => session.dispatchEvent(Object.assign(new Event(type),details));
  xr.dispatchEvent({type:'sessionstart'});
  tick();
  assert(interaction.inputStatus().includes('Mando der. activo'));
  emit('selectstart',{inputSource:controller});
  emit('selectend',{inputSource:controller});
  assert(game.status==='jugando','gatillo en Comenzar');
  aimX=0; tick();
  emit('selectstart',{inputSource:controller});
  assert(piece.estado==='sujeto','agarre con mando');
  velocities={linearVelocity:{x:4,y:1,z:0},angularVelocity:{x:0,y:2,z:0}};
  tick();
  emit('selectend',{inputSource:controller});
  assert(piece.estado==='liberado','soltar gatillo');
  // The piece is 1 m in front of the pivot. Rotation contributes -2 m/s along X.
  assert(piece.cuerpoFisico.velocity.almostEquals({x:2,y:1,z:0}) &&
    piece.cuerpoFisico.angularVelocity.y===2,'velocidad XR y brazo de palanca al soltar');
  velocities={};
  const hand = {handedness:'left', targetRayMode:'tracked-pointer', targetRaySpace:{},
    hand:new Map([['index-finger-tip','index'],['thumb-tip','thumb']])};
  emit('inputsourceschange',{added:[hand],removed:[controller]});
  tick();
  assert(interaction.inputStatus().includes('Mano izq. activo'));
  fingerGap=.009; tick();
  assert(piece.estado==='sujeto','agarre con pinza');
  aimX=.05;tick();aimX=.10;tick();aimX=.15;tick();
  fingerGap=.041; tick();
  assert(piece.estado==='liberado','abrir pinza');
  assert(Math.abs(piece.cuerpoFisico.velocity.x-4.5)<.001,'velocidad estimada a partir de poses');
  aimX=0;
  fingerGap=.009; tick(); tracking=false; tick();
  assert(!piece.holder && interaction.inputStatus().includes('sin seguimiento'),'pérdida de pose');
  emit('inputsourceschange',{added:[],removed:[hand]});
  assert(interaction.inputStatus().includes('Sin entradas XR'));
  xr.dispatchEvent({type:'sessionend'});
  assert(interaction.inputStatus()==='');
}
