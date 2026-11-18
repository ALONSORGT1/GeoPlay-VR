import * as THREE from 'three';
import { CATEGORIES, STATIONS, stationPoint, SETTINGS } from './config.js';
import { staticBox } from './physics.js';
export function label(text,width=.7,height=.11,color='#183b4e',bg='#f5f1e8') {
  const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=Math.round(1024*height/width);
  const ctx=canvas.getContext('2d'); ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=color;ctx.font=`600 ${Math.round(canvas.height*.48)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,canvas.height/2,980);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
}
export function createEnvironment(scene,world) {
  scene.background=new THREE.Color('#b5d7e4');scene.fog=new THREE.Fog('#b5d7e4',9,24);
  scene.add(new THREE.HemisphereLight('#e5f5ff','#b59b7e',2.6));
  const sun=new THREE.DirectionalLight('#fff0d4',3);sun.position.set(-3,7,4);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,far:18});sun.shadow.bias=-.0005;scene.add(sun);
  const tile=document.createElement('canvas');tile.width=tile.height=128;const ctx=tile.getContext('2d');
  ctx.fillStyle='#e6e1d7';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#d5d1c8';ctx.strokeRect(0,0,128,128);
  for(let i=0;i<800;i++){ctx.fillStyle=i%2?'#ddd9d0':'#ece8df';ctx.fillRect(Math.random()*128,Math.random()*128,1,1);}
  const tex=new THREE.CanvasTexture(tile);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(12,12);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,16),new THREE.MeshStandardMaterial({map:tex,roughness:.92}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  staticBox(world,scene,12,3.6,.18,{x:0,y:1.8,z:-4},'#e9e4d9');
  staticBox(world,scene,.16,3.6,8,{x:-6,y:1.8,z:0},'#d2c4b0');staticBox(world,scene,.16,3.6,8,{x:6,y:1.8,z:0},'#d2c4b0');
  staticBox(world,scene,12,.25,.2,{x:0,y:.125,z:4},'#183b4e');
  // Frisos y vigas al fondo, fuera del volumen de trabajo.
  for(let x=-5.6;x<6;x+=.45) staticBox(world,scene,.075,2.3,.10,{x,y:1.6,z:-3.84},'#c5a47e');
  for(const x of [-5.8,5.8]) staticBox(world,scene,.22,3.8,.22,{x,y:1.9,z:-2},'#183b4e');
  for(const z of [-3.5,0,3.5]) staticBox(world,scene,12,.16,.12,{x:0,y:3.7,z},'#c5a47e');
  const title=label('FORMA / LAB',3.4,.43);title.position.set(0,2.7,-3.7);scene.add(title);
  const subtitle=label('OBSERVA  ·  EXPLORA  ·  CLASIFICA',3,.18);subtitle.position.set(0,2.32,-3.7);scene.add(subtitle);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.30,.31,64),new THREE.MeshBasicMaterial({color:'#39b8ac',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.003;scene.add(ring);
  const bins=[],occluders=[];
  STATIONS.forEach((s,index)=>{
    const box=(w,h,d,x,y,z,color,meta={})=>{ const m=staticBox(world,scene,w,h,d,stationPoint(index,x,y,z),color,s.angle,meta);occluders.push(m);return m; };
    box(.76,.075,.82,0,SETTINGS.tableTop-.0375,.22,'#c5a47e');
    for(const x of [-.30,.30]) for(const z of [-.08,.52]) box(.055,.745,.055,x,.3725,z,'#183b4e');
    const cat=CATEGORIES[index], meta={binIndex:index};
    box(.45,.035,.45,0,SETTINGS.binBottom-.0175,-.02,cat.color,meta);
    box(.035,.28,.45,-.2075,.99,-.02,cat.color,meta);box(.035,.28,.45,.2075,.99,-.02,cat.color,meta);
    box(.38,.28,.035,0,.99,-.2275,cat.color,meta);box(.38,.28,.035,0,.99,.1875,cat.color,meta);
    const tag=label(`${cat.symbol}  ${cat.name}`, .42,.082,'#ffffff','#183b4e');
    tag.position.copy(stationPoint(index,0,1.015,.208));tag.rotation.y=s.angle;scene.add(tag);
    const number=label(`0${index+1} / MESA`,.30,.06);number.position.copy(stationPoint(index,0,.77,.64));number.rotation.y=s.angle;scene.add(number);
    bins.push({index,category:cat.id});
  });
  return {bins,occluders};
}
