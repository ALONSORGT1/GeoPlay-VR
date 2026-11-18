// Evolución del agarre físico, offset de pose y pinza/raycast de la práctica 3.1.
import * as THREE from 'three';
import { createXRInput } from './xr-input.js';
import { unlockAudio } from './audio.js';
export function createInteraction({scene,renderer,camera,items,buttons,occluders,game,canvas}) {
  const raycaster=new THREE.Raycaster(),mat=new THREE.Matrix4(),target=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  const objects=[...items.map(i=>i.malla),...buttons,...occluders];
  function press(state,object,holder) {
    unlockAudio();
    if(object.userData.action) {object.userData.action();return;}
    const item=object.userData.item;
    if(!item || item.holder || item.estado==='clasificado' || state.held || game.status!=='jugando')return;
    holder.updateWorldMatrix(true,false);item.malla.updateWorldMatrix(true,false);
    state.offset=new THREE.Matrix4().copy(holder.matrixWorld).invert().multiply(item.malla.matrixWorld);
    state.held=item;state.holder=holder;state.motion=[];item.holder=state;item.estado='sujeto';item.stable=0;
    game.grabbed(item);
    item.cuerpoFisico.wakeUp();
  }
  function release(state,safe=false) {
    if(!state.held)return;
    const item=state.held,b=item.cuerpoFisico;
    // Control por velocidad de un cuerpo dinámico: equivalente al arrastre, conserva contactos estáticos.
    if(safe) {b.velocity.setZero();b.angularVelocity.setZero();}
    else if(state.motion.length) {
      b.velocity.setZero();b.angularVelocity.setZero();
      state.motion.forEach(m=>{b.velocity.addScaledVector(1/state.motion.length,m.v,b.velocity);b.angularVelocity.addScaledVector(1/state.motion.length,m.w,b.angularVelocity);});
    }
    b.mass=.14;b.updateMassProperties();b.wakeUp();item.holder=null;game.released(item);
    // Al soltar ya dentro de la boca se conserva evidencia de la trayectoria física del agarre.
    item.entered=state.entered ?? null;state.entered=null;state.held=null;state.holder=null;state.motion=[];
  }
  function hitFrom(holder) {
    holder.updateWorldMatrix(true,false);mat.extractRotation(holder.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(holder.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(mat);
    raycaster.far=3;return raycaster.intersectObjects(objects,false)[0];
  }
  const xrInput=createXRInput({scene,hitFrom,press,release});
  renderer.xr.addEventListener('sessionstart',()=>xrInput.attach(renderer.xr.getSession()));
  renderer.xr.addEventListener('sessionend',()=>xrInput.attach(null));
  const desktopAnchor=new THREE.Object3D();
  const desktop={held:null,motion:[],holder:null,entered:null};scene.add(desktopAnchor);
  canvas.addEventListener('pointerdown',e=>{
    if(renderer.xr.isPresenting)return;
    const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
    const hit=raycaster.intersectObjects(objects,false)[0];if(!hit)return;
    if(hit.object.userData.action){unlockAudio();hit.object.userData.action();return;}
    desktop.depth=hit.distance;desktopAnchor.position.copy(raycaster.ray.at(hit.distance,new THREE.Vector3()));desktopAnchor.quaternion.copy(camera.quaternion);
    press(desktop,hit.object,desktopAnchor);canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!desktop.held)return;const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
    desktop.holder.position.copy(raycaster.ray.at(desktop.depth,new THREE.Vector3()));
  });
  canvas.addEventListener('wheel',e=>{if(desktop.held){e.preventDefault();desktop.depth=THREE.MathUtils.clamp(desktop.depth+e.deltaY*.002,.4,5);desktop.holder.position.copy(raycaster.ray.at(desktop.depth,new THREE.Vector3()));}},{passive:false});
  canvas.addEventListener('pointerup',()=>release(desktop));canvas.addEventListener('pointercancel',()=>release(desktop,true));
  function update(dt,frame) {
    if (renderer.xr.isPresenting) xrInput.update(frame,renderer.xr.getReferenceSpace());
    for(const state of [...xrInput.sources.values(),desktop]) {
      const item=state.held;if(!item)continue;
      const b=item.cuerpoFisico;
      state.holder.updateWorldMatrix(true,false);target.multiplyMatrices(state.holder.matrixWorld,state.offset);target.decompose(p,q,scale);
      const distance=p.distanceTo(b.position);
      if(distance>.85 || !Number.isFinite(distance)){release(state,true);continue;}
      const v=p.clone().sub(b.position).multiplyScalar(18);if(v.length()>1.8)v.setLength(1.8);b.velocity.copy(v);
      const rot=q.clone().multiply(new THREE.Quaternion().copy(b.quaternion).invert()).normalize();if(rot.w<0)rot.set(-rot.x,-rot.y,-rot.z,-rot.w);
      const sin=Math.hypot(rot.x,rot.y,rot.z),angle=2*Math.acos(THREE.MathUtils.clamp(rot.w,-1,1)),k=sin>1e-6?Math.min(angle*18,6)/sin:0;
      b.angularVelocity.set(rot.x*k,rot.y*k,rot.z*k);b.wakeUp();
      state.motion.push({v:b.velocity.clone(),w:b.angularVelocity.clone(),dt});
      while(state.motion.length>1 && state.motion.reduce((sum,m)=>sum+m.dt,0)>.09)state.motion.shift();
    }
  }
  return {update,press,release,inputStatus:xrInput.status,releaseAll(){
    for(const state of [...xrInput.sources.values(),desktop]) release(state,true);
  }};
}
