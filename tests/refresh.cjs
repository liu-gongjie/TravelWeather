const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'), path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  let calls=0, release=null, hold=false;
  await page.route('https://appassets.androidplatform.net/**',async r=>{
   const u=new URL(r.request().url());
   if(u.pathname==='/location')return r.fulfill({json:{error:true,reason:'测试定位不可用'}});
   const file=path.join(__dirname,'../web',u.pathname==='/'?'index.html':u.pathname);
   return r.fulfill({body:await fs.readFile(file),contentType:u.pathname.endsWith('.js')?'application/javascript':u.pathname.endsWith('.css')?'text/css':'text/html'});
  });
  await page.route('https://api.open-meteo.com/**',async r=>{
   calls++;if(hold)await new Promise(ok=>release=ok);
   return r.fulfill({json:{current:{time:'2026-09-30T12:00',temperature_2m:24,weather_code:2},daily:{time:['2026-09-30'],weather_code:[2],temperature_2m_max:[27],temperature_2m_min:[18]}}});
  });
  const ready=()=>page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  await page.goto('https://appassets.androidplatform.net/');await ready();
  hold=true;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#refresh').classList.contains('refreshing'));
  assert.equal(await page.locator('#refresh').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('.refresh-arrow').evaluate(e=>getComputedStyle(e).animationName),'refresh-spin');
  assert.equal(await page.locator('#refresh').evaluate(e=>getComputedStyle(e).opacity),'1');
  await page.waitForFunction(()=>document.querySelector('.card'));while(!release)await page.waitForTimeout(10);
  hold=false;release();await ready();assert.equal(await page.locator('#refresh').getAttribute('aria-busy'),'false');
  const cdp=await page.context().newCDPSession(page);
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y}]});
  const pull=async(distance,end='touchEnd')=>{await touch('touchStart',180,80);await touch('touchMove',180,100);await touch('touchMove',180,80+distance);await touch(end);};
  let before=calls;await pull(130);await ready();assert.equal(calls,before+1);
  before=calls;await pull(45);await page.waitForTimeout(100);assert.equal(calls,before);
  await pull(130,'touchCancel');await page.waitForTimeout(100);assert.equal(calls,before);
  await page.evaluate(()=>{document.body.style.minHeight='2500px';scrollTo(0,200)});await page.waitForTimeout(50);
  await pull(130);await page.waitForTimeout(100);assert.equal(calls,before);
  await page.evaluate(()=>scrollTo(0,0));await page.locator('#add').click();await pull(130);await page.waitForTimeout(100);assert.equal(calls,before);
  console.log('PASS: visible rotating arrow, completion reset, pull refresh, short/cancelled/scrolled/dialog gestures ignored');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
