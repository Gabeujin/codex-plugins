import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import net from 'node:net';

const toolRoot=process.argv[2];
if(!toolRoot)throw Error('Usage: node scripts/test-form-ten.mjs EXTERNAL_PLAYWRIGHT_TOOLS [chrome]');
const {chromium}=createRequire(path.resolve(toolRoot,'package.json'))('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const gallery=path.join(root,'examples/form-ten');
const output=await mkdtemp(path.join(tmpdir(),'form-ten-browser-'));
const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));
const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const server=spawn(process.execPath,[path.join(gallery,'server.mjs')],{env:{...process.env,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
const logs=[];server.stdout.on('data',x=>logs.push(x.toString()));server.stderr.on('data',x=>logs.push(x.toString()));
const origin=`http://127.0.0.1:${port}`;
let browser;const checks=[],errors=[];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const run=async(id,fn)=>{await fn();checks.push({id,status:'pass'});};
try{
 // 별도 포트와 외부 도구 폴더로 개인 캐시·실행 중인 전시를 건드리지 않고 검증
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await pause(100);}
 assert(ready,'loopback server ready');
 browser=await chromium.launch({headless:true,...(process.argv[3]?{channel:process.argv[3]}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const state=()=>page.evaluate(()=>window.__FORM10__.getState());
 const open=async id=>{await page.goto(`${origin}/#/${id}`);await page.waitForFunction(id=>window.__FORM10__?.getState().work===id,id);await page.evaluate(()=>document.fonts.ready);};
 const range=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('input');await page.waitForTimeout(80);};
 const expected=[60,16,24,18,36,30,30,18,24,24];
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(let n=1;n<=10;n++){
   const id=String(n).padStart(2,'0');
   await run(`work-${id}-${width}-route-seek-layout`,async()=>{
    await open(id);assert.equal((await state()).duration,expected[n-1]);
    await page.locator('[data-chapter]').last().click();assert.equal((await state()).time,expected[n-1]);assert.equal((await state()).playing,false);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
    await page.locator('#reset').click();await page.locator('#stage').screenshot({path:path.join(output,`${id}-${width}.png`)});
   });
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 await run('skip-link-preserves-current-route',async()=>{await open('09');await page.locator('.skip').focus();await page.keyboard.press('Enter');assert.equal((await state()).work,'09');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');});
 await run('palace-manual-to-timeline',async()=>{await open('01');await page.locator('[data-part="stone"]').click();await range('timeline',47);const s=await state();assert.equal(s.scene.tour,true);assert.equal(s.scene.lego,1);assert.equal((await page.evaluate(()=>window.__FORM10__.getComponents())).length,2327);await range('timeline',60);assert.equal((await state()).scene.assemble,1);});
 await run('hangul-nfc-and-recovery',async()=>{await open('02');await page.locator('#hangul-input').fill('한');assert.equal(await page.locator('#hangul-object').textContent(),'한');await page.locator('#hangul-input').fill('invalid');assert.equal(await page.locator('#hangul-object').textContent(),'한');assert((await page.locator('#hangul-error').textContent()).length>0);await page.locator('#hangul-recover').click();assert.equal(await page.locator('#hangul-input').inputValue(),'한');});
 await run('graph-keyboard-pause-delete-undo',async()=>{await open('03');await page.locator('#play').click();await page.locator('[data-node="3"]').focus();await page.keyboard.press('ArrowRight');assert.equal((await state()).playing,false);const before=(await state()).scene.nodes.length;await page.locator('#remove-node').click();assert.equal((await state()).scene.nodes.length,before-1);await page.locator('#undo-node').click();assert.equal((await state()).scene.nodes.length,before);});
 await run('type-copy-is-text-and-real-weight',async()=>{await open('04');await page.locator('#type-copy').fill('<b>한글 문장</b>');assert.equal(await page.locator('#type-specimen').textContent(),'<b>한글 문장</b>');assert.equal(await page.locator('#type-specimen b').count(),0);await range('type-weight',800);assert.equal(await page.locator('#type-specimen').evaluate(e=>getComputedStyle(e).fontWeight),'800');});
 await run('astra-range-and-dialog-focus',async()=>{await open('05');await range('astra-distance',70);const a=digest(await page.locator('#art').screenshot());await range('astra-distance',130);assert.notEqual(digest(await page.locator('#art').screenshot()),a);await page.locator('[data-concept="research"]').click();await page.locator('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('[data-concept="research"]').evaluate(e=>e===document.activeElement),true);});
 await run('sol-user-confirmation-not-playback',async()=>{await open('06');await range('timeline',30);assert.deepEqual((await state()).scene.done,[]);await page.locator('[data-confirm-step="0"]').click();assert.deepEqual((await state()).scene.done,[0]);await page.locator('#sol-undo').click();assert.deepEqual((await state()).scene.done,[]);});
 await run('webb-corners-preserve-source-center',async()=>{await open('07');await range('webb-zoom',4);for(const [x,y]of [[0,0],[0,100],[100,0],[100,100]]){await range('webb-x',x);await range('webb-y',y);assert.deepEqual((await state()).scene.lensCenter,{x:x/100,y:y/100});}});
 await run('spa-history-response-ownership-and-adoption',async()=>{
  // 이력 복귀 뒤 늦게 도착한 A가 B의 URL·입력·결과를 덮지 않는지 실제 지연 확인
  await open('08');await page.locator('#reset').click();await page.locator('#spa-query').fill('B');await page.locator('#request-send').click();await page.waitForTimeout(250);
  await page.locator('#spa-draft').fill('관찰');await page.locator('#confirm-draft').click();await page.locator('#spa-query').fill('A');await page.locator('#request-send').click();await page.goBack();await page.waitForTimeout(1100);
  assert.equal(await page.locator('#spa-query').inputValue(),'B');assert.equal((await state()).scene.query,'B');assert((await page.locator('#request-results').textContent()).includes('B —'));assert(!(await page.locator('#request-results').textContent()).includes('A —'));
  await page.locator('[data-adopt="0"]').click();assert((await page.locator('#spa-draft').inputValue()).includes('B —'));assert.equal(await page.evaluate(()=>document.activeElement.id),'spa-draft');
 });
 await run('data-missing-and-list-focus',async()=>{await open('09');await page.locator('[data-month="04"]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.dataset.month),'04');assert.equal(await page.locator('#data-total').textContent(),'17,280');assert((await page.locator('#missing-detail').textContent()).includes('북측 03월'));await page.locator('#data-table-wrap').click();assert((await page.locator('#data-table').textContent()).includes('결측'));});
 await run('material-fallback-reset',async()=>{await open('10');await page.locator('#fallback-view').click();assert.equal(await page.locator('#fallback-stage').isVisible(),true);await page.locator('#reset').click();assert.equal(await page.locator('#fallback-view').textContent(),'SVG 대체 보기');assert.equal(await page.locator('#fallback-stage').isVisible(),false);});
 await run('synthetic-persisted-lifecycle-rebind',async()=>{await open('02');await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await page.locator('#hangul-input').fill('봄');assert.equal(await page.locator('#hangul-object').textContent(),'봄');});
 await run('reduced-motion-change-pauses',async()=>{await open('03');await page.locator('#play').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);assert.equal((await state()).playing,false);});
 assert.deepEqual(errors,[]);
 const build=JSON.parse(await readFile(path.join(gallery,'build-id.json'),'utf8'));
 const report={schemaVersion:1,status:'passed',browser:browser.version(),buildId:build.buildId,checks,errors,output,limitations:['Synthetic lifecycle probe does not prove native BFCache restoration.','Seek checks do not prove real-time full playback.','No native OS IME, screen reader, physical touch or physical material simulation certification.']};
 await writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser?.close();server.kill();await writeFile(path.join(output,'server.txt'),logs.join(''));}
