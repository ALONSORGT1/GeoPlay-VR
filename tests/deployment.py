"""Espera la publicación actual y compara módulos públicos con los archivos locales."""
import pathlib, urllib.request, json, time, subprocess, hashlib, sys
root=pathlib.Path(__file__).resolve().parent.parent
site='https://alonsorgt1.github.io/GeoPlay-VR/'
repo='https://api.github.com/repos/ALONSORGT1/GeoPlay-VR'
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
files=['index.html','js/main.js','js/physics.js','js/game.js','js/interaction.js','tests/suite.js','css/style.css','assets/favicon.svg','assets/salon.glb','assets/placa-y8.png','js/environment.js','js/hud.js','README.md']
def digest(data,path):
    if path.endswith(('.js','.html','.css','.svg','.md')):
        data=data.replace(b'\r\n',b'\n')
    return hashlib.sha256(data).hexdigest()
for attempt in range(30):
    matches=[]
    for f in files:
        try:
            response=urllib.request.urlopen(site+f,timeout=15)
            matches.append({'path':f,'http':response.status,'hashMatches':digest(response.read(),f)==digest((root/f).read_bytes(),f)})
        except Exception as e:matches.append({'path':f,'error':str(e),'hashMatches':False})
    if all(m['hashMatches'] for m in matches):break
    if attempt==0:print('Esperando módulos de la versión publicada...',flush=True)
    time.sleep(4)
else:print('La publicación no coincidió dentro del límite.');sys.exit(1)
try:
    runs=json.load(urllib.request.urlopen(repo+'/actions/runs?per_page=3'))['workflow_runs']
    runs=[{k:r[k] for k in ['head_sha','name','status','conclusion','html_url']} for r in runs]
except Exception as e:runs=[{'error':str(e)}]
result={'verifiedAtUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sourceCommit':sha,'url':site,'files':matches,'workflows':runs}
out=root/'docs'/'evidencias'/'despliegue.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
