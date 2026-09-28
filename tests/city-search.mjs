import assert from 'node:assert/strict';
import {chinaCities} from '../web/china-cities.js';
import {searchLocalCities,sameCity,normalizeCity} from '../web/city-index.js';
import {searchCities} from '../web/weather.js';
let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('offline')};
for(const name of ['河池','贺州','桂林','河池市','Hechi']){const c=(await searchCities(name))[0];assert(c&&c.province.includes('广西'),name);}
assert.equal(calls,0);
const idSet=new Set();
for(const [id,name,,province,,country,lat,lon] of chinaCities){
 assert(!idSet.has(id));idSet.add(id);assert(province&&country);assert(Number.isFinite(lat)&&Math.abs(lat)<=90);assert(Number.isFinite(lon)&&Math.abs(lon)<=180);
 for(const q of [name,normalizeCity(name)+'市',normalizeCity(name)+'县',normalizeCity(name)+'区'])assert(searchLocalCities(q,Infinity).some(c=>c.id==='qw:'+id),`${id} not searchable by ${q}`);
}
assert(sameCity({id:'old',name:'北京市',lat:39.90,lon:116.41},searchLocalCities('北京')[0]));
assert(!sameCity({id:'other',name:'朝阳',lat:40,lon:120},{id:'another',name:'朝阳',lat:30,lon:110}));
await assert.rejects(searchCities('London'));
console.log(`PASS ${chinaCities.length} entries: IDs, coordinates, every name and suffix alias; Guangxi cases offline; old saved-city deduplication`);
