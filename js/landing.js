let ready;
document.getElementById('preview').addEventListener('click',async()=>{
  document.getElementById('laboratory').hidden=false;document.getElementById('laboratory').scrollIntoView({behavior:'smooth'});
  if(ready)return;
  ready=true;
  try {const {initLab}=await import('./main.js');await initLab();} catch(error){console.error(error);document.getElementById('loading').textContent='No se pudo cargar el laboratorio. Verifica la conexión a los CDN y recarga.';document.getElementById('error').hidden=false;document.getElementById('error').textContent=error.message;ready=false;}
});
{const q=new URLSearchParams(location.search);if(q.has('test')||q.has('synctest')) document.getElementById('preview').click();}
