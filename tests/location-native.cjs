const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let positionFails=true, addressFails=false, weatherFails=false;
 const freshRequests=[];
 await page.route('https://appassets.androidplatform.net/**',async r=>{
  const u=new URL(r.request().url());
  if(u.pathname==='/location'){
   freshRequests.push(u.searchParams.get('fresh'));
   return r.fulfill({json:positionFails?{error:true,reason:'请开启手机系统定位'}:{latitude:28,longitude:112,accuracy:1200,approximate:true}});
  }
  if(u.pathname==='/reverse-geocode')return r.fulfill({status:addressFails?503:200,json:{name:'岳麓区',key:'CN/湖南/长沙/岳麓'}});
  const file=path.join(__dirname,'../web',u.pathname==='/'?'index.html':u.pathname);
  return r.fulfill({body:await fs.readFile(file),contentType:u.pathname.endsWith('.js')?'application/javascript':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.png')?'image/png':'text/html'});
 });
 await page.route('https://api.open-meteo.com/**',r=>weatherFails?r.abort():r.fulfill({json:{current:{time:'2026-09-29T12:00',temperature_2m:24,weather_code:3},daily:{time:['2026-09-29'],weather_code:[3],temperature_2m_max:[28],temperature_2m_min:[20]}}}));
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
 await page.goto('https://appassets.androidplatform.net/index.html');await ready();
 assert((await page.locator('#location').innerText()).includes('无法获取当前位置和天气'));
 assert((await page.locator('#location').innerText()).includes('请开启手机系统定位'));
 assert.equal(await page.locator('#add + #lastUpdated').count(),1);
 assert(!(await page.locator('#lastUpdated').innerText()).includes('暂无'));
 // Coordinate succeeds but address service fails: show weather, not total location failure.
 positionFails=false;addressFails=true;
 await page.getByRole('button',{name:'重新定位',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#location strong')?.textContent==='24°');
 assert.equal(freshRequests.at(-1),'1');
 assert((await page.locator('#location').innerText()).includes('位置名称暂不可用'));
 assert((await page.locator('#location').innerText()).includes('已获取坐标'));
 addressFails=false;
 await page.getByRole('button',{name:'定位未更新，点击重试'}).click();
 await page.waitForFunction(()=>document.querySelector('#location > p')?.textContent==='⌖ 岳麓区');
 assert((await page.locator('#location').innerText()).includes('大致位置'));
 const before=(await page.locator('#lastUpdated').innerText()).split('（')[0];
 weatherFails=true;
 await page.locator('#refresh').click();await ready();
 assert.equal((await page.locator('#lastUpdated').innerText()).split('（')[0],before);
 assert((await page.locator('#lastUpdated').innerText()).includes('部分城市更新失败'));
 await page.reload();await ready();
 assert.equal((await page.locator('#lastUpdated').innerText()).split('（')[0],before);
 assert((await page.locator('#location').innerText()).includes('岳麓区'));
 // Browser preview fallback retries with high accuracy only for recoverable failures.
 const preview=await browser.newPage();
 await preview.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:8765');
 const opts=await preview.evaluate(async()=>{
  const options=[];
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,fail,opt){options.push(opt);if(options.length===1)fail({code:3});else ok({coords:{latitude:1,longitude:2}});}}});
  await (await import('./location.js')).acquireLocation(true);return options;
 });
 assert.equal(opts.length,2);assert.equal(opts[0].maximumAge,0);assert.equal(opts[1].enableHighAccuracy,true);
 console.log('PASS: native route errors, fresh retry, address-only failure weather fallback, approximate notice, successful update time persistence, failed update does not advance time, browser high-accuracy retry');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
