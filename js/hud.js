import * as THREE from 'three';
import { CATEGORIES, timeText } from './config.js';

export function createHUD(scene,board,actions,inputStatus) {
  const group=new THREE.Group();
  group.name='Proyección del pizarrón';
  group.position.set((board.min[0]+board.max[0])/2,(board.min[1]+board.max[1])/2,board.max[2]+.001);
  scene.add(group);
  const canvas=document.createElement('canvas');
  canvas.width=1800;
  canvas.height=540;
  const ctx=canvas.getContext('2d');
  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=4;
  const width=board.max[0]-board.min[0]-.16, height=board.max[1]-board.min[1]-.12;
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),
    new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  group.add(panel);

  // The visible labels and their ray targets share the same board coordinates.
  const controls=[['Comenzar','start'],['Reiniciar','reset'],['Recuperar','recover'],['Salir de VR','exit']];
  const buttonWidth=404, buttonHeight=70, buttonY=445;
  const buttonX=i=>44+i*435;
  const targetMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
  const buttons=controls.map(([,action],i)=>{
    const target=new THREE.Mesh(new THREE.PlaneGeometry(width*buttonWidth/canvas.width,height*buttonHeight/canvas.height),targetMaterial);
    target.position.set(width*((buttonX(i)+buttonWidth/2)/canvas.width-.5),
      height*(.5-(buttonY+buttonHeight/2)/canvas.height),.0005);
    target.userData.action=actions[action];
    group.add(target);
    return target;
  });
  function text(value,x,y,size,weight=500,color='#203847',maxWidth=canvas.width-x) {
    ctx.fillStyle=color;
    ctx.font=`${weight} ${size}px system-ui`;
    ctx.fillText(value,x,y,maxWidth);
  }
  let signature='';
  function update(game) {
    const input=inputStatus(), remaining=20-game.hits;
    const key=JSON.stringify([input,game.status,Math.floor(game.elapsed),game.counts,game.times,game.attempts,game.hits,game.errors,game.message,game.syncText]);
    if(signature===key)return;
    signature=key;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.textBaseline='middle';
    ctx.textAlign='left';
    text('GeoPlay VR   /   Aula Y-8',44,40,34,650);
    text(timeText(game.elapsed),1580,40,44,650);
    ctx.fillStyle='#85989b';ctx.fillRect(44,73,1709,2);
    text(`${game.hits} / 20`,44,157,110,700);
    text(remaining===1?'Falta 1 pieza':`Faltan ${remaining} piezas`,48,238,40,550);
    text(`${game.status.toUpperCase()}   ·   ${game.accuracy.toFixed(0)} % de precisión`,48,293,29);
    CATEGORIES.forEach((category,i)=>{
      const y=109+i*58, completed=game.counts[category.id];
      ctx.fillStyle=category.color;ctx.fillRect(752,y-15,9,30);
      text(category.name,779,y,32,600);
      for(let slot=0;slot<5;slot++) {
        ctx.fillStyle=slot<completed?category.color:'#c1ced0';
        ctx.fillRect(1150+slot*39,y-10,31,20);
      }
      text(`${completed} / 5`,1390,y,32,600);
      text(game.times[category.id]===null?'Pendiente':timeText(game.times[category.id]),1535,y,29);
    });
    text(game.message,46,353,33,600);
    text(`${game.attempts} intentos   ·   ${game.errors} errores${input?'   ·   '+input:''}`,46,401,28,500,'#203847',860);
    // Práctica 3.3: estado de sincronización con el servidor (pendiente, error, sesión perdida).
    if(game.syncText) text(game.syncText,930,401,26,600,/error|perdida|No se/.test(game.syncText)?'#b3261e':'#205957',830);
    controls.forEach(([caption],i)=>{
      const x=buttonX(i);
      ctx.fillStyle=i===0?'#205957':'#d7e1e1';
      ctx.fillRect(x,buttonY,buttonWidth,buttonHeight);
      ctx.textAlign='center';
      text(caption,x+buttonWidth/2,buttonY+buttonHeight/2,34,650,i===0?'#fff':'#243f48',buttonWidth-20);
    });
    tex.needsUpdate=true;
    document.getElementById('score').textContent=`${game.hits}/20 · Faltan ${remaining} · ${game.errors} errores · ${game.accuracy.toFixed(0)} % · ${timeText(game.elapsed)} · ${game.status}`;
    const sync=document.getElementById('sync'); if(sync && sync.textContent!==game.syncText) sync.textContent=game.syncText;
    document.getElementById('feedback').textContent=game.message;
  }
  return {group,panel,buttons,update};
}
