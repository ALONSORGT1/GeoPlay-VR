import * as THREE from 'three';
import { CATEGORIES, STATIONS, stationPoint, SETTINGS } from './config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { addStaticCollider } from './physics.js';
export function label(text,width=.7,height=.11,color='#183b4e',bg='#f5f1e8') {
  const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=Math.round(1024*height/width);
  const ctx=canvas.getContext('2d'); ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=color;ctx.font=`600 ${Math.round(canvas.height*.48)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,canvas.height/2,980);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
}
export async function createEnvironment(scene,world) {
  const [{scene: model}, plateMap] = await Promise.all([
    new GLTFLoader().loadAsync(new URL('../assets/salon.glb', import.meta.url).href),
    new THREE.TextureLoader().loadAsync(new URL('../assets/placa-y8.png', import.meta.url).href)
  ]);
  scene.add(model);
  const room = model.getObjectByName('Salon');
  const {solids, floorSize} = room.userData;
  const board = solids.find(s=>s.name==='pizarron_sur');
  const lintel = solids.find(s=>s.name==='remate_madera_puerta');
  const upperDoor = solids.find(s=>s.name==='puerta_oeste' && s.max[1]===lintel.min[1] && s.min[1]>0);
  plateMap.colorSpace=THREE.SRGBColorSpace;
  plateMap.anisotropy=4;
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(.48,.278),
    new THREE.MeshStandardMaterial({map:plateMap,alphaTest:.45,roughness:.75}));
  plate.name='Placa Y-8';
  plate.rotation.y=-Math.PI/2;
  plate.position.set(upperDoor.min[0]-.001,(upperDoor.min[1]+upperDoor.max[1])/2,(upperDoor.min[2]+upperDoor.max[2])/2);
  plate.receiveShadow=true;
  scene.add(plate);
  const bins = [], occluders = [];
  room.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.receiveShadow = true;
    mesh.castShadow = !mesh.material.transparent;
    if (mesh.material.map) mesh.material.map.anisotropy = 4;
    occluders.push(mesh);
  });
  // Un sólido por pieza de carpintería, paño de vidrio o tramo de muro.
  for (const {name, min, max} of solids) {
    const size = max.map((v,i) => v-min[i]);
    const center = min.map((v,i) => (v+max[i])/2);
    addStaticCollider(world, ...size, new THREE.Vector3(...center), 0, {name});
  }
  addStaticCollider(world,floorSize[0],.1,floorSize[2],{x:0,y:-.05,z:0},0,{name:'piso'});
  world.roomHalfSize = {x:floorSize[0]/2,z:floorSize[2]/2};
  scene.background = new THREE.Color('#cee3ed');
  scene.add(new THREE.HemisphereLight('#f3f8ff','#bdaba0',1.8));
  const sun = new THREE.DirectionalLight('#fff3df',2.2);
  sun.position.set(-7,4.3,2.4);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.2,far:17});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias=.006;
  scene.add(sun);
  // Draw all table and bin parts together, retaining a separate contact body per part.
  const furniture=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),
    new THREE.MeshStandardMaterial({roughness:.72}),STATIONS.length*10);
  const part=new THREE.Object3D(), tint=new THREE.Color();
  let instance=0;
  furniture.castShadow=furniture.receiveShadow=true;
  scene.add(furniture);
  occluders.push(furniture);
  STATIONS.forEach((s,index)=>{
    function box(w,h,d,x,y,z,color,meta={}) {
      part.position.copy(stationPoint(index,x,y,z));
      part.rotation.y=s.angle;
      part.scale.set(w,h,d);
      part.updateMatrix();
      furniture.setMatrixAt(instance,part.matrix);
      furniture.setColorAt(instance++,tint.set(color));
      addStaticCollider(world,w,h,d,part.position,s.angle,meta);
    }
    const {tableTop,binBottom,binTop,binHalf} = SETTINGS;
    const topThickness=.075, legHeight=tableTop-topThickness;
    box(.86,topThickness,.94,0,tableTop-topThickness/2,.215,'#b98e62');
    for(const x of [-.36,.36]) for(const z of [-.18,.60])
      box(.05,legHeight,.05,x,legHeight/2,z,'#344854');
    const cat=CATEGORIES[index], meta={binIndex:index};
    const wall=.035, width=2*(binHalf+wall), height=binTop-binBottom, mid=(binTop+binBottom)/2;
    box(width,wall,width,0,binBottom-wall/2,-.02,cat.color,meta);
    for(const side of [-1,1]) {
      box(wall,height,width,side*(binHalf+wall/2),mid,-.02,cat.color,meta);
      box(2*binHalf,height,wall,0,mid,-.02+side*(binHalf+wall/2),cat.color,meta);
    }
    const tag=label(`${cat.symbol}  ${cat.name}`, .42,.082,'#ffffff','#183b4e');
    tag.position.copy(stationPoint(index,0,mid,binHalf+wall-.018));tag.rotation.y=s.angle;scene.add(tag);
    const number=label(`0${index+1} / MESA`,.30,.06);
    number.position.copy(stationPoint(index,0,tableTop-topThickness/2,.687));number.rotation.y=s.angle;scene.add(number);
    bins.push({index,category:cat.id});
  });
  return {bins,occluders,board};
}
