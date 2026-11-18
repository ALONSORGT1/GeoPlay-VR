import { CATEGORIES, SETTINGS, localPoint } from './config.js';
import * as CANNON from 'cannon-es';
export class Game {
  constructor(feedback = () => {}) { this.feedback = feedback; this.reset(); }
  reset() {
    this.status='preparado'; this.elapsed=0; this.hits=0; this.errors=0; this.attempts=0;
    this.counts=Object.fromEntries(CATEGORIES.map(c=>[c.id,0]));
    this.times=Object.fromEntries(CATEGORIES.map(c=>[c.id,null])); this.message='Pulsa Comenzar para iniciar';
  }
  start() { if (['preparado','pausado'].includes(this.status)) { this.status='jugando'; this.message='Apunta · pellizca · mueve · suelta'; } }
  pause() { if(this.status==='jugando') { this.status='pausado'; this.message='En pausa · pulsa Comenzar para continuar'; } }
  get accuracy() { return this.attempts ? this.hits/this.attempts*100 : 0; }
  released(item) {
    item.estado='liberado'; item.attempt++; item.confirmed=false; item.stable=0;
    item.candidate=null; item.entered=null; item.supportBin=null;
  }
  update(dt, items, bins, contacts, advanceClock=true) {
    if(this.status!=='jugando') return;
    if(advanceClock) this.elapsed+=dt;
    for(const item of items) {
      if(item.holder || ['clasificado','disponible','recuperable'].includes(item.estado)) continue;
      const b=item.cuerpoFisico;
      // Entrada real: debe estar encima de la boca y después pasar al interior.
      for(const bin of bins) {
        const p=localPoint(bin.index,b.position);
        if(Math.abs(p.x)<SETTINGS.binHalf && Math.abs(p.z+.02)<SETTINGS.binHalf && p.y>=SETTINGS.binTop+item.radius*.35) item.entered=bin.index;
      }
      const bin=bins.find(bin=>this.inside(item,bin));
      if(!bin) { item.stable=0; item.candidate=null; if(!item.confirmed) item.estado='liberado'; continue; }
      if(item.confirmed || item.entered!==bin.index) continue;
      const touching=contacts.some(c=>c.enabled && (c.bi===b || c.bj===b) && (()=>{
        const other=c.bi===b?c.bj:c.bi;
        return other.userData?.binIndex===bin.index || (other.userData?.item?.recipiente===bin.index && other.userData.item.estado==='clasificado');
      })());
      if(touching) item.supportBin=bin.index;
      const supported=touching || (b.sleepState===CANNON.Body.SLEEPING && item.supportBin===bin.index);
      if(!supported || b.velocity.length()>SETTINGS.linearThreshold || b.angularVelocity.length()>SETTINGS.angularThreshold) { item.stable=0; continue; }
      if(item.candidate!==bin.index) {item.candidate=bin.index; item.stable=0;}
      item.estado='estabilizandose'; item.stable+=dt;
      if(item.stable>=SETTINGS.stableSeconds) this.confirm(item,bin);
    }
  }
  inside(item,bin) {
    // Tolerancia milimétrica del solver: tocar la pared interior sí es un depósito válido.
    const b=item.cuerpoFisico,s=b.shapes[0],limit=SETTINGS.binHalf+.002;
    if(s instanceof CANNON.Sphere){const p=localPoint(bin.index,b.position);return Math.abs(p.x)+s.radius<=limit && Math.abs(p.z+.02)+s.radius<=limit && p.y-s.radius>=SETTINGS.binBottom-.012 && p.y+s.radius<SETTINGS.binTop-.008;}
    let vertices=s.vertices;
    if(s instanceof CANNON.Box){vertices=[];const h=s.halfExtents;for(const x of [-h.x,h.x])for(const y of [-h.y,h.y])for(const z of [-h.z,h.z])vertices.push(new CANNON.Vec3(x,y,z));}
    return vertices.every(v=>{const w=b.quaternion.vmult(v);w.vadd(b.position,w);const p=localPoint(bin.index,w);return Math.abs(p.x)<=limit && Math.abs(p.z+.02)<=limit && p.y>=SETTINGS.binBottom-.012 && p.y<SETTINGS.binTop-.008;});
  }
  confirm(item,bin) {
    if(item.confirmed || item.estado==='clasificado') return;
    item.confirmed=true; this.attempts++;
    const correct=item.categoria===bin.category;
    item.eventos.push({ intento:item.attempt, recipiente:bin.index, correcto:correct, tiempo:this.elapsed });
    item.recipiente=bin.index;
    if(correct) {
      item.estado='clasificado'; this.hits++; this.counts[item.categoria]++;
      if(this.counts[item.categoria]===5) this.times[item.categoria]=this.elapsed;
      this.message=`¡Correcto! ${this.hits} de 20`; this.feedback('correct',item,bin);
      if(this.hits===20) { this.status='completado'; this.message='¡Laboratorio completado!'; this.feedback('complete'); }
    } else { item.estado='error'; this.errors++; this.message='Recipiente incorrecto · retira la pieza y vuelve a intentar'; this.feedback('error',item,bin); }
  }
}
