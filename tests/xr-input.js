import * as THREE from 'three';
import { createInteraction } from '../js/interaction.js';
import { Game } from '../js/game.js';
import { createPhysics, createPieces } from '../js/physics.js';

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
