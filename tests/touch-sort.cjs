const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{current:{time:'2026-09-27T12:00',temperature_2m:24,weather_code:61},daily:{time:['2026-09-27'],weather_code:[61],temperature_2m_max:[27],temperature_2m_min:[18]}}}));
await page.goto('http://127.0.0.1:8765');
await page.evaluate(()=>{localStorage.setItem('travelweather-v1-cities',JSON.stringify(['北京','上海','深圳','长沙','广州','杭州'].map((name,i)=>({id:String(i),name,lat:30,lon:120}))));});
await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.days').length===6);
assert.equal(await page.locator('[data-action="up"],[data-action="down"]').count(),0);
const cdp=await page.context().newCDPSession(page);
const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y}],modifiers:0});
const order=()=>page.locator('.city-title h2').allTextContents();
const initial=await order();
// Immediate movement scrolls instead of starting a reorder.
await touch('touchStart',200,650);await touch('touchMove',200,500);await touch('touchMove',200,350);await touch('touchEnd');
await page.waitForTimeout(250);assert(await page.evaluate(()=>scrollY)>0);assert.deepEqual(await order(),initial);
await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.days').length===6);await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);
let rect=await page.locator('.card').nth(1).boundingBox();
await touch('touchStart',200,rect.y+50);await page.waitForTimeout(500);assert.equal(await page.locator('.sort-ghost').count(),1);
const target=await page.locator('.card').first().boundingBox();await touch('touchMove',200,Math.max(85,target.y+30));await touch('touchEnd');assert.equal((await order())[0],'上海');
await page.reload();await page.locator('.days').first().waitFor();assert.equal((await order())[0],'上海');
// Drag down past the viewport; auto scrolling exposes later cities.
rect=await page.locator('.card').first().boundingBox();await touch('touchStart',200,rect.y+50);await page.waitForTimeout(500);await touch('touchMove',200,830);await page.waitForTimeout(1100);assert(await page.evaluate(()=>scrollY)>200);await touch('touchEnd');assert.notEqual((await order())[0],'上海');
// Cancellation restores persisted order, including after DOM reordering.
await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);const before=await order();rect=await page.locator('.card').first().boundingBox();await touch('touchStart',200,rect.y+50);await page.waitForTimeout(500);await touch('touchMove',200,700);await touch('touchCancel');assert.deepEqual(await order(),before);assert.equal(await page.locator('.sort-ghost').count(),0);
console.log('PASS: native touch scroll, long press drag, persistence, edge auto scroll, cancellation, no arrow buttons');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
