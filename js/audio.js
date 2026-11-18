let context;
export function unlockAudio() { try { context ??= new (window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{}); } catch {} }
export function feedbackSound(type) {
  if(!context || context.state!=='running')return;
  const notes=type==='error'?[190,145]:type==='complete'?[523,659,784,1047]:[600,840];
  notes.forEach((freq,i)=>{const osc=context.createOscillator(),gain=context.createGain(),t=context.currentTime+i*.13;osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.07,t+.015);gain.gain.exponentialRampToValueAtTime(.001,t+.18);osc.connect(gain).connect(context.destination);osc.start(t);osc.stop(t+.2);});
}
