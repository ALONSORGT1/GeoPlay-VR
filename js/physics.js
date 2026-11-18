import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CATEGORIES, SETTINGS, stationPoint, STATIONS } from './config.js';
export function createPhysics() {
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:true});
  world.solver.iterations=24; world.broadphase=new CANNON.SAPBroadphase(world);
  world.defaultContactMaterial.friction=.55; world.defaultContactMaterial.restitution=.16;
  const floor=new CANNON.Body({mass:0,shape:new CANNON.Plane()}); floor.quaternion.setFromEuler(-Math.PI/2,0,0); floor.aabbNeedsUpdate=true; world.addBody(floor);
  return world;
}
export function staticBox(world,scene,w,h,d,p,color,angle=0,meta={}) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.72}));
  mesh.position.copy(p); mesh.rotation.y=angle; mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  const body=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))});
  body.position.copy(p); body.quaternion.setFromEuler(0,angle,0); body.aabbNeedsUpdate=true; body.userData=meta; world.addBody(body);
  mesh.userData.collider=body; return mesh;
}
function convex(geometry) {
  const pos=geometry.attributes.position, vertices=[], map=new Map(), ids=[];
  for(let i=0;i<pos.count;i++) {
    const v=[pos.getX(i),pos.getY(i),pos.getZ(i)], key=v.map(n=>n.toFixed(6)).join(',');
    if(!map.has(key)) { map.set(key,vertices.length); vertices.push(new CANNON.Vec3(...v)); }
    ids.push(map.get(key));
  }
  const idx=geometry.index?.array || Array.from({length:pos.count},(_,i)=>i), faces=[];
  for(let i=0;i<idx.length;i+=3) { const f=[ids[idx[i]],ids[idx[i+1]],ids[idx[i+2]]]; if(new Set(f).size===3) faces.push(f); }
  return new CANNON.ConvexPolyhedron({vertices,faces});
}
export function createPieces(world,scene) {
  const r=SETTINGS.size;
  const geometries=[new THREE.SphereGeometry(r,20,14),new THREE.BoxGeometry(r*1.6,r*1.6,r*1.6),new THREE.ConeGeometry(r*1.23,r*1.9,4,1),new THREE.CylinderGeometry(r,r,r*1.6,6,1)];
  // Cannon almacena vértices transformados en cada forma convexa: no compartir colisionadores.
  const shapes=[()=>new CANNON.Sphere(r),()=>new CANNON.Box(new CANNON.Vec3(r*.8,r*.8,r*.8)),()=>convex(geometries[2]),()=>convex(geometries[3])];
  return CATEGORIES.flatMap((category,k)=>Array.from({length:5},(_,n)=>{
    const mesh=new THREE.Mesh(geometries[k],new THREE.MeshStandardMaterial({color:category.color,metalness:.18,roughness:.32}));
    mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
    geometries[k].computeBoundingSphere();
    const body=new CANNON.Body({mass:.14,shape:shapes[k](),linearDamping:.12,angularDamping:.4,sleepSpeedLimit:.06,sleepTimeLimit:.7}); world.addBody(body);
    const item={id:`${category.id}-${n+1}`,categoria:category.id,mesaOrigen:0,malla:mesh,cuerpoFisico:body,estado:'disponible',holder:null,eventos:[],attempt:0,confirmed:false,stable:0,entered:null,radius:geometries[k].boundingSphere.radius};
    body.userData={item}; mesh.userData.item=item; return item;
  }));
}
function shuffle(a) { for(let i=a.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
export function place(item,p,yaw=Math.random()*Math.PI*2) {
  const b=item.cuerpoFisico;
  b.type=CANNON.Body.DYNAMIC; b.mass=.14; b.updateMassProperties();
  b.quaternion.setFromEuler(0,yaw,0); b.position.set(p.x,0,p.z); b.updateAABB();
  b.position.y=p.y-b.aabb.lowerBound.y+.001; b.velocity.setZero(); b.angularVelocity.setZero(); b.force.setZero(); b.torque.setZero();
  b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); b.previousQuaternion.copy(b.quaternion); b.interpolatedQuaternion.copy(b.quaternion);
  b.aabbNeedsUpdate=true; b.wakeUp(); item.malla.position.copy(b.position); item.malla.quaternion.copy(b.quaternion);
}
export function redistribute(items) {
  // Cada mesa recibe las cuatro clases y una extra: mezcla garantizada, 5/clase global.
  const extras=shuffle([0,1,2,3]), pools=CATEGORIES.map(c=>shuffle(items.filter(i=>i.categoria===c.id)));
  STATIONS.forEach((_,s)=>{
    const group=shuffle([...pools.map(pool=>pool.pop()),pools[extras[s]].pop()]);
    const slots=shuffle([[-.25,.29],[0,.29],[.25,.29],[-.13,.48],[.13,.48]]);
    group.forEach((item,k)=>{
      item.mesaOrigen=s; item.estado='disponible'; item.holder=null; item.eventos=[]; item.attempt=0; item.confirmed=false; item.stable=0; item.entered=null; item.candidate=null; item.recipiente=null;item.supportBin=null;
      const [x,z]=slots[k]; place(item,stationPoint(s,x+(Math.random()-.5)*.025,SETTINGS.tableTop,z+(Math.random()-.5)*.025));
      item.malla.material.emissive.set(0x000000); item.malla.material.emissiveIntensity=0;
    });
  });
}
export function sync(items) { items.forEach(i=>{i.malla.position.copy(i.cuerpoFisico.position);i.malla.quaternion.copy(i.cuerpoFisico.quaternion);}); }
