import assert from 'node:assert/strict';
import {condition,dailyCondition,dailyRainTotal,fetchWeather,icon} from '../web/weather.js';
for(const [mm,label] of [[0.1,'小雨'],[9.9,'小雨'],[10,'中雨'],[24.9,'中雨'],[25,'大雨'],[49.9,'大雨'],[50,'暴雨'],[99.9,'暴雨'],[100,'大暴雨'],[249.9,'大暴雨'],[250,'特大暴雨']])assert.equal(dailyCondition(61,mm)[0],label);
assert.equal(condition(61)[0],'小雨');assert.equal(condition(63)[0],'中雨');assert.equal(condition(65)[0],'大雨');assert.equal(condition(82)[0],'强阵雨');
for(const value of [undefined,null,NaN,-1,0])assert.equal(dailyCondition(65,value)[0],'大雨');
assert.equal(dailyCondition(95,50)[0],'暴雨');assert.equal(dailyCondition(95,50)[1],'storm');assert.equal(dailyCondition(95,20)[0],'雷雨');
assert.equal(dailyCondition(71,60)[0],'雪');assert.equal(dailyCondition(66,60)[0],'小冻雨');
assert.equal(dailyRainTotal(30,20),50);assert.equal(dailyRainTotal(null,20),null);assert.equal(dailyRainTotal(0,0),0);
globalThis.fetch=async url=>{assert.match(url,/rain_sum/);assert.match(url,/showers_sum/);return {ok:true,json:async()=>({daily:{time:['2026-09-28'],weather_code:[61],temperature_2m_max:[20],temperature_2m_min:[10],rain_sum:[30],showers_sum:[20]}})}};
assert.equal((await fetchWeather({lat:1,lon:2})).days[0].rainMm,50);
console.log('PASS rain boundaries, missing data fallback, thunder/snow/freezing distinctions, provider totals');

const drops = (code, mm) => (icon(code,mm).match(/class="rain-line"/g)||[]).length;
for(const [mm,n] of [[1,1],[10,2],[25,3],[50,4],[100,4],[250,4]]) assert.equal(drops(61,mm),n);
for(const [code,n] of [[61,1],[63,2],[65,3],[80,1],[81,2],[82,3]]) assert.equal(drops(code),n);
assert.equal(drops(95,50),4);assert.equal(drops(0),0);assert.equal(drops(71),0);
console.log('PASS rain icons: 1/2/3/4 centered drops, current-code fallback, thunderstorm and non-rain cases');
