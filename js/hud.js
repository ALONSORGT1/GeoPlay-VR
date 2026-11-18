import * as THREE from 'three';
import { CATEGORIES, timeText } from './config.js';
import { label } from './environment.js';
export function createHUD(scene,actions,inputStatus) {
  const group=new THREE.Group();group.position.set(0,1.83,-1.65);scene.add(group);
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=650;const ctx=canvas.getContext('2d');
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.635),new THREE.MeshBasicMaterial({map:tex}));group.add(panel);
  const buttons=[];
  [['Comenzar','start'],['Reiniciar','reset'],['Recuperar','recover'],['Salir de VR','exit']].forEach(([text,action],i)=>{
    const mesh=label(text,.29,.078,'#ffffff',i===3?'#71565d':'#246b6b');mesh.position.set((i-1.5)*.31,-.38,.005);group.add(mesh);mesh.userData.action=actions[action];buttons.push(mesh);
  });
  let signature='';
  function update(game) {
    const input=inputStatus();
    const key=JSON.stringify([input,game.status,Math.floor(game.elapsed),game.hits,game.errors,game.message]);if(signature===key)return;signature=key;
    ctx.fillStyle='#183b4e';ctx.fillRect(0,0,1280,650);ctx.textBaseline='middle';ctx.textAlign='left';
    ctx.fillStyle='#8fe1d2';ctx.font='500 25px system-ui';ctx.fillText('FORMA / LAB    ·    CLASIFICACIÓN GEOMÉTRICA',44,43);
    ctx.fillStyle='#ffffff';ctx.font='600 88px system-ui';ctx.fillText(`${game.hits} / 20`,44,123);
    ctx.font='500 42px system-ui';ctx.fillText(timeText(game.elapsed),1000,117);
    ctx.font='400 25px system-ui';ctx.fillStyle='#c1d8df';ctx.fillText(`${game.status.toUpperCase()}   ·   ${game.attempts} intentos   ·   ${game.errors} errores   ·   ${game.accuracy.toFixed(0)} % precisión`,44,195);
    CATEGORIES.forEach((c,i)=>{
      const y=265+i*68;ctx.fillStyle=c.color;ctx.fillRect(44,y-20,6,43);ctx.font='500 28px system-ui';ctx.fillText(c.name,70,y);
      ctx.fillStyle='#fff';ctx.fillText(`${game.counts[c.id]} / 5`,620,y);ctx.fillStyle='#bfd2d9';ctx.fillText(game.times[c.id]===null?'Pendiente':timeText(game.times[c.id]),910,y);
    });
    ctx.fillStyle=game.status==='completado'?'#8fe1d2':'#fff1cc';ctx.font='400 25px system-ui';ctx.fillText(game.message,44,558,1192);
    ctx.fillStyle='#bdd3d9';ctx.font='400 21px system-ui';ctx.fillText(input || 'Alonso Ramírez Gutiérrez   ·   Recuperar devuelve piezas caídas a una mesa',44,610);
    tex.needsUpdate=true;
    document.getElementById('score').textContent=`${game.hits}/20 · ${game.errors} errores · ${game.accuracy.toFixed(0)} % · ${timeText(game.elapsed)} · ${game.status}`;
    document.getElementById('feedback').textContent=game.message;
  }
  return {group,buttons,update};
}
