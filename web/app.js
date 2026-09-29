import {acquireLocation} from './location.js';
import {sameCity} from './city-index.js';
import { createCardSorter } from './sortable.js';
import { getJSON, searchCities, fetchWeather, condition, dailyCondition, icon } from './weather.js';
const $ = id => document.getElementById(id);
const CITY_KEY = 'travelweather-v1-cities';
const CACHE_KEY = 'travelweather-v1-cache';
const defaultCity = { id: '1816670', name: '北京', lat: 39.9042, lon: 116.4074, region: '中国' };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch { toast('无法保存设置，请检查存储空间'); } };
const validCity = c => c && typeof c.id === 'string' && typeof c.name === 'string' && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lon));
let cities = read(CITY_KEY,[defaultCity]);
if (!Array.isArray(cities) || !cities.length || !cities.every(validCity)) cities = [defaultCity];
cities = cities.slice(0,10);
let cache = read(CACHE_KEY,{}); if (!cache || typeof cache !== 'object' || Array.isArray(cache)) cache = {};
const states = new Map();
const LOCATION_KEY='travelweather-last-location';
let located=read(LOCATION_KEY,null);
if(!validCity(located)||!located.regionKey)located=null;
let locationProblem=false, locationHint='';
let refreshing = false, toastTimer, searchTimer, searchAbort, searchVersion = 0;
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const temp = n => n == null || !Number.isFinite(Number(n)) ? '—' : Math.round(n) + '°';
function toast(message) { $('toast').textContent=message; $('toast').style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').style.display='none',3000); }
function applyTheme() { const dark=read('travelweather-theme','light') === 'dark'; document.documentElement.classList.toggle('dark',dark); $('theme').textContent=dark?'☀':'☾'; }
$('theme').onclick=()=>{write('travelweather-theme',document.documentElement.classList.contains('dark')?'light':'dark');applyTheme();};
const sorter = createCardSorter($('cards'), {
  onCommit(ids) { const byId = new Map(cities.map(c=>[c.id,c])); if(ids.length===cities.length && ids.every(id=>byId.has(id))) { cities=ids.map(id=>byId.get(id));write(CITY_KEY,cities); } },
  onFinish() { render(); }
});
function renderCard(city, index, removable=true) {
  const state=states.get(city.id)||{}; const data=state.data||cache[city.id];
  const article=document.createElement('article'); article.className='card'; article.dataset.city=city.id; article.draggable=false; if(removable) { article.dataset.sortable='true'; article.style.webkitUserSelect='none'; }
  const controls=removable?`<div class="controls"><button data-action="remove" aria-label="删除${escape(city.name)}">×</button></div>`:'';
  const now=data?.now?`<div class="now">${icon(data.now.weather_code)}<span>${condition(data.now.weather_code)[0]}</span><strong>${temp(data.now.temperature_2m)}</strong></div>`:'';
  let body='';
  if (data?.days?.length) body=`<div class="days">${data.days.map(d=>`<div class="day"><span>${d.date===data.today?'今天 ':''}${Number(d.date.slice(5,7))}/${Number(d.date.slice(8,10))}</span>${icon(d.code,d.rainMm)}<span>${dailyCondition(d.code,d.rainMm)[0]}</span><strong>${temp(d.max)} <span class="low">${temp(d.min)}</span></strong></div>`).join('')}</div>`;
  else body=`<p class="message ${state.error?'error':''}">${state.loading?'正在获取天气…':escape(state.error||'暂无天气数据')}</p>`;
  article.innerHTML=`<div class="card-head"><div class="city-title"><h2>${escape(city.name)}</h2>${controls}</div>${now}</div>${body}`;
  article.onclick=e=>{if(e.target.closest('[data-action]')?.dataset.action!=='remove')return;if(cities.length===1)return toast('至少保留一个城市');cities=cities.filter(c=>c.id!==city.id);delete cache[city.id];write(CACHE_KEY,cache);write(CITY_KEY,cities);render();};
  return article;
}
function renderUpdateTime(){
  const visible=[...cities,...(located?[located]:[])];
  const times=visible.map(c=>(states.get(c.id)?.data||cache[c.id])?.updated).filter(t=>Number.isFinite(t)&&t>0);
  const latest=times.length?Math.max(...times):0;
  const partial=visible.some(c=>states.get(c.id)?.error);
  $('lastUpdated').textContent=latest?`最新更新时间：${new Date(latest).toLocaleString('zh-CN',{hour12:false})}${partial?'（部分城市更新失败）':''}`:'最新更新时间：暂无';
}
function render(){ renderUpdateTime();if(sorter.isBusy())return; $('cards').replaceChildren(...(located?[renderCard(located,0,false)]:[]),...cities.map((c,i)=>renderCard(c,i)));$('add').disabled=cities.length>=10; }
async function load(city){
  if(states.get(city.id)?.loading)return;
  states.set(city.id,{...states.get(city.id),loading:true,error:''});render();
  try{const data=await fetchWeather(city);states.set(city.id,{data,loading:false,error:''});if(cities.some(c=>c.id===city.id)||located?.id===city.id){cache[city.id]=data;write(CACHE_KEY,cache);}if(located?.id===city.id)renderLocation();}
  catch(error){if(cache[city.id])toast(`${city.name}更新失败，保留上次天气`);states.set(city.id,{...states.get(city.id),loading:false,error:error.name==='AbortError'?'请求超时，请检查网络后刷新':error.message||'获取天气失败'});}
  render();
}
let lastRefreshAttempt=0;
async function refresh(){
  if(refreshing)return;refreshing=true;lastRefreshAttempt=Date.now();$('refresh').disabled=true;
  try{
    const cachedWeatherPromise=located?load(located):null;
    await Promise.all([...cities.map(load),cachedWeatherPromise,locate({cachedWeatherPromise})]);
  }finally{refreshing=false;$('refresh').disabled=false;}
}
$('refresh').onclick=refresh;
$('add').onclick=()=>{ $('searchDialog').showModal();$('search').value='';$('results').textContent='输入城市名搜索';$('search').focus(); };
$('searchDialog').addEventListener('close',()=>{clearTimeout(searchTimer);searchAbort?.abort();searchVersion++;});
let composingCity = false;
$('search').addEventListener('compositionstart',()=>{composingCity=true;clearTimeout(searchTimer);searchAbort?.abort();searchVersion++;});
$('search').addEventListener('compositionend',()=>{composingCity=false;searchCityInput();});
$('search').addEventListener('input',e=>{if(!composingCity && !e.isComposing)searchCityInput();});
$('search').closest('form').addEventListener('submit',e=>{if(e.submitter?.tagName==='BUTTON')return;e.preventDefault();if(!composingCity)searchCityInput();});
function searchCityInput(){clearTimeout(searchTimer);searchAbort?.abort();const version=++searchVersion;const name=$('search').value.trim();if(!name){$('results').textContent='输入城市名搜索';return;}$('results').textContent='搜索中…';searchTimer=setTimeout(async()=>{searchAbort=new AbortController();try{const results=await searchCities(name,searchAbort.signal);if(version!==searchVersion)return;$('results').replaceChildren();if(!results.length)$('results').textContent='未找到相关城市，可尝试拼音或英文名';for(const city of results){const b=document.createElement('button');b.className='result';b.innerHTML=`<strong>${escape(city.name)}</strong><small>${escape(city.region)}</small>`;b.onclick=()=>{if(cities.some(c=>sameCity(c,city)))return toast('城市已存在');if(cities.length>=10)return toast('最多添加10个城市');cities.push(city);write(CITY_KEY,cities);$('searchDialog').close();render();load(city);};$('results').append(b);}}catch(error){if(version===searchVersion)$('results').textContent='城市搜索失败，请检查网络后重试';}},300);};
let locating = false;
function renderLocation(){
  const data=located&&(states.get(located.id)?.data||cache[located.id]);
  if(located&&data?.now){
    $('location').innerHTML=`<p>⌖ ${escape(located.name)}</p><div class="hero">${icon(data.now.weather_code)}<div><strong>${temp(data.now.temperature_2m)}</strong><p>${condition(data.now.weather_code)[0]}</p></div></div>`;
    if(locationProblem){const retry=document.createElement('button');retry.textContent='定位未更新，点击重试';retry.onclick=()=>locate({fresh:true});$('location').append(retry);}
  } else if(locationProblem){$('location').innerHTML='<p>无法获取当前位置和天气</p><button id="locate">重新定位</button>';$('locate').onclick=()=>locate({fresh:true});}
  else $('location').innerHTML='<p>定位中…</p>';
  if(locationHint){const hint=document.createElement('small');hint.className='location-hint';hint.textContent=locationHint;$('location').append(hint);}
  if(locating){for(const b of $('location').querySelectorAll('button')){b.disabled=true;b.textContent='正在重新定位…';}}
}
async function locate({cachedWeatherPromise=null,fresh=false}={}){
  if(locating)return;
  locating=true;renderLocation();
  try{
    const pos=await acquireLocation(fresh);
    const lat=pos.coords.latitude,lon=pos.coords.longitude;
    let address, addressFailed=false;
    try {
      address=await getJSON(`/reverse-geocode?${new URLSearchParams({lat,lon})}`);
      if(typeof address.name!=='string'||!address.name.trim())throw new Error('No district');
    } catch {
      // A valid coordinate is sufficient for weather even when the device's address service fails.
      // Keep a known district only when the new fix is very close to its saved coordinate.
      const nearby=located && Math.hypot((lat-Number(located.lat))*111,(lon-Number(located.lon))*111*Math.cos(lat*Math.PI/180))<1;
      address=nearby?{name:located.name,key:located.regionKey}:{name:'位置名称暂不可用',key:`coordinates:${lat.toFixed(3)},${lon.toFixed(3)}`};
      addressFailed=true;
    }
    const regionKey=address.key||address.name;
    const unchanged=located?.regionKey===regionKey;
    locationProblem=addressFailed;
    locationHint=addressFailed?'已获取坐标，区县名称暂时解析失败，可重试':pos.coords.approximate?'当前为大致位置，区县边界附近可开启精确位置后重试':'';
    if(unchanged){
      // Reuse district identity/coordinates, but refresh weather on every entry and manual refresh.
      await (cachedWeatherPromise || load(located));
      renderLocation();
      return;
    }
    const city={id:'located:'+regionKey,name:address.name,regionKey,lat,lon};
    // Fetch before swapping so a moved/failed location cannot display the old area's weather.
    const data=await fetchWeather(city);
    const previous=located?.id;
    located=city;states.set(city.id,{data,loading:false,error:''});cache[city.id]=data;
    if(previous&&previous!==city.id){delete cache[previous];states.delete(previous);}
    write(CACHE_KEY,cache);write(LOCATION_KEY,city);renderLocation();render();
  }catch(error){
    locationHint=error.message||'定位暂未成功，请检查系统定位与位置权限后重试';
    if(located)await (cachedWeatherPromise || load(located));
    locationProblem=true;renderLocation();
  }finally{locating=false;renderLocation();}
}
function autoLocate(){if(!document.hidden && Date.now()-lastRefreshAttempt>1500)refresh();}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoLocate();});
window.addEventListener('travelweather-resume',autoLocate);
applyTheme();render();renderLocation();refresh();
