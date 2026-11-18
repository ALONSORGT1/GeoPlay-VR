"""Verificación de la aplicación estática con Edge headless; sin Node/npm/build.
Requiere un servidor local activo (python serve.py).
"""
import subprocess, pathlib, tempfile, re, sys
root=pathlib.Path(__file__).resolve().parent.parent
edge=pathlib.Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
out=root/'docs'/'evidencias';out.mkdir(parents=True,exist_ok=True)
url=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8080/'
with tempfile.TemporaryDirectory(prefix='forma-lab-') as profile:
    result=subprocess.run([str(edge),'--headless=new','--no-first-run','--no-default-browser-check',f'--user-data-dir={profile}',
      '--enable-unsafe-swiftshader','--disable-gpu-sandbox','--window-size=1440,1100','--virtual-time-budget=20000','--dump-dom',url+'?test=1&autorun=1'],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=90)
    (out/'dom-tests.html').write_text(result.stdout,encoding='utf-8')
    match=re.search(r'<pre id="test-results"[^>]*>(.*?)</pre>',result.stdout,re.S)
    report=match.group(1) if match else 'NO SE EJECUTARON LAS PRUEBAS\n'+result.stderr[-1800:]
    (out/'pruebas.txt').write_text(report,encoding='utf-8');print(report)
    sys.exit(0 if 'data-test-status="passed"' in result.stdout else 1)
