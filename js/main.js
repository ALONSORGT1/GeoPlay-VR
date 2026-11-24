import * as THREE from 'three';
import { Body } from 'cannon-es';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { SETTINGS, STATIONS, stationPoint, TABLE_SLOTS } from './config.js';
import { advancePhysics, createPhysics, createPieces, redistribute, place, sync, updateRecoveryState } from './physics.js';
import { createEnvironment } from './environment.js';
import { createInteraction } from './interaction.js';
import { Game, aboveOpening } from './game.js';
import { createHUD } from './hud.js';
import { feedbackSound, unlockAudio } from './audio.js';

export async function initLab() {
  const container=document.getElementById('viewport'),scene=new THREE.Scene();
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.xr.enabled=true;
  renderer.shadowMap.autoUpdate=false;
  renderer.xr.setReferenceSpaceType('local-floor');renderer.setClearColor('#b5d7e4');container.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(56,1,.025,35);
  function desktopCamera(view='overview') {
    if(view==='front'){camera.position.set(0,1.65,.1);camera.lookAt(0,1,-1.4);}
    else {camera.position.set(2.25,2.55,3.55);camera.lookAt(0,1.12,-.9);}
  }
  desktopCamera();
  const world=createPhysics(),{bins,occluders}=await createEnvironment(scene,world),items=createPieces(world,scene);
  const game=new Game((type,item)=>{
    feedbackSound(type);
    if(item){item.malla.material.emissive.set(type==='error'?'#e75454':'#5cebc0');item.malla.material.emissiveIntensity=.45;}
  });
  let interaction;
  function reset(){interaction?.releaseAll();game.reset();redistribute(items);hud.update(game);}
  function recover(){
    const obstacles=items.filter(i=>i.estado!=='recuperable' && i.estado!=='error');let recovered=0;
    for(const item of items) {
      if(item.holder || !['recuperable','error'].includes(item.estado))continue;
      let free=null;
      for(const s of [item.mesaOrigen,...STATIONS.map((_,i)=>i).filter(i=>i!==item.mesaOrigen)]) {
        for(const [x,z] of TABLE_SLOTS) {
          const p=stationPoint(s,x,SETTINGS.tableTop,z);
          if(!free && obstacles.every(other=>Math.hypot(other.cuerpoFisico.position.x-p.x,other.cuerpoFisico.position.z-p.z)>other.radius+item.radius+.004 || other.cuerpoFisico.position.y>1.1))free=p;
        }
      }
      if(free){place(item,free);item.estado='disponible';item.confirmed=false;item.stable=0;item.entered=null;item.recipiente=null;item.malla.material.emissiveIntensity=0;obstacles.push(item);recovered++;}
    }
    game.message=recovered?`${recovered} pieza(s) recuperada(s) · sin cambiar puntuación`:'No hay piezas caídas o erróneas para recuperar';hud.update(game);
  }
  const start=()=>{unlockAudio();game.start();hud.update(game);};
  const exit=()=>renderer.xr.getSession()?.end().catch(showError);
  const hud=createHUD(scene,{start,reset,recover,exit},()=>interaction?.inputStatus() || '');
  interaction=createInteraction({scene,renderer,camera,items,bins,buttons:hud.buttons,occluders,game,canvas:renderer.domElement});reset();
  const vr=VRButton.createButton(renderer,{optionalFeatures:['hand-tracking']});document.getElementById('vr-entry').appendChild(vr);
  renderer.xr.addEventListener('sessionstart',()=>{
    interaction.releaseAll();camera.position.set(0,0,0);camera.quaternion.identity();document.body.classList.add('in-vr');
    const session=renderer.xr.getSession();session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible'){interaction.releaseAll();game.pause();}});
    session.addEventListener('reset',()=>{interaction.releaseAll();game.pause();});
    renderer.xr.getReferenceSpace()?.addEventListener('reset',()=>{interaction.releaseAll();game.pause();});
  });
  renderer.xr.addEventListener('sessionend',()=>{interaction.releaseAll();game.pause();desktopCamera();document.body.classList.remove('in-vr');});
  // En el visor la sesión XR controla la visibilidad, aunque la pestaña 2D pierda el foco.
  function pauseDesktop() {
    if (renderer.xr.isPresenting) return;
    interaction.releaseAll();
    game.pause();
    hud.update(game);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden) pauseDesktop();});
  window.addEventListener('blur',pauseDesktop);
  document.getElementById('start').onclick=start;document.getElementById('reset').onclick=reset;document.getElementById('recover').onclick=recover;document.getElementById('pause').onclick=()=>{interaction.releaseAll();game.pause();};
  document.getElementById('view').onclick=()=>{desktopCamera(camera.position.y>2?'front':'overview');};
  function resize(){const r=container.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(container);resize();
  let last=performance.now(),accumulator=0;
  function renderFrame(now,frame) {
    const realDelta=Math.max((now-last)/1000,0),dt=Math.min(realDelta,SETTINGS.maxDelta);last=now;
    if(game.status==='jugando') game.elapsed+=realDelta;
    scene.updateMatrixWorld(true);interaction.update(realDelta,frame);
    const paused=game.status==='pausado';
    if(!paused && items.some(item=>item.cuerpoFisico.sleepState!==Body.SLEEPING))
      renderer.shadowMap.needsUpdate=true;
    if(!paused){accumulator+=dt;
      while(accumulator>=SETTINGS.step){
        advancePhysics(world,items,SETTINGS.step,substep=>{
          for(const item of items) {
            if(item.holder) {
              for(const bin of bins) if(aboveOpening(item,bin)) item.holder.entered=bin.index;
            }
            updateRecoveryState(item,interaction.release);
          }
          game.update(substep,items,bins,world.contacts,false);
        });
        accumulator-=SETTINGS.step;
      }
    } else accumulator=0;
    sync(items);
    hud.update(game);
    renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(renderFrame);
  const capability=document.getElementById('capability');
  capability.textContent=await navigator.xr?.isSessionSupported('immersive-vr')?'WebXR disponible · activa seguimiento de manos':'Vista de escritorio · abre esta URL en Meta Quest Browser para entrar a VR';
  // Solo presente con ?test=1; el modo de pruebas no altera partidas normales.
  if(new URLSearchParams(location.search).has('test')) {
    const {runTests}=await import('../tests/suite.js');
    document.getElementById('run-tests').hidden=false;
    document.getElementById('run-tests').onclick=()=>runTests({world,items,bins,game,reset,interaction,scene,camera,occluders,renderer,hud,renderFrame});
    if(new URLSearchParams(location.search).has('autorun')) setTimeout(()=>document.getElementById('run-tests').click(),700);
  }
  document.getElementById('loading').hidden=true;
  return {world,items,bins,game,renderer};
}
export function showError(error){console.error(error);const el=document.getElementById('error');el.hidden=false;el.textContent=`No se pudo completar la acción: ${error.message||error}. Comprueba tu conexión y recarga la página.`;}
