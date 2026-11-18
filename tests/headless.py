"""QA opcional sin interfaz, con Python Playwright y Edge instalado. Sin npm/build."""
from playwright.sync_api import sync_playwright
import pathlib,sys,json
root=pathlib.Path(__file__).resolve().parent.parent
url=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8080/'
out=root/'docs'/'evidencias'
if not url.startswith('http://localhost'):out=out/'publico'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True,args=['--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('response',lambda r:requests.append({'url':r.url,'status':r.status}))
    page.goto(url,wait_until='networkidle');page.screenshot(path=str(out/'portada.png'),full_page=True)
    page.goto(url+'?test=1',wait_until='networkidle')
    page.locator('#run-tests').wait_for(state='visible',timeout=45000)
    page.locator('#loading').wait_for(state='hidden')
    page.locator('#viewport').scroll_into_view_if_needed();page.screenshot(path=str(out/'laboratorio.png'))
    page.locator('#run-tests').click(timeout=60000)
    report=page.locator('#test-results').inner_text();print(report)
    status=page.locator('html').get_attribute('data-test-status')
    page.locator('#test-results').scroll_into_view_if_needed();page.screenshot(path=str(out/'pruebas.png'))
    (out/'pruebas.txt').write_text(report,encoding='utf-8')
    page.set_viewport_size({'width':390,'height':844});page.goto(url,wait_until='networkidle');page.screenshot(path=str(out/'movil.png'),full_page=True)
    overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
    (out/'navegador.json').write_text(json.dumps({'url':url,'errors':errors,'requests':requests,'mobileOverflow':overflow,'testStatus':status},ensure_ascii=False,indent=2),encoding='utf-8')
    browser.close();sys.exit(0 if status=='passed' and not errors and not overflow else 1)
