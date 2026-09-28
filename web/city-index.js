import {chinaCities} from './china-cities.js';
export const normalizeCity = text => text.trim().toLowerCase().replace(/[\s·-]/g,'').replace(/(?:壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|自治县|自治州|地区|市|县|区)$/,'');
const entries=chinaCities.map(([id,name,pinyin,province,city,country,lat,lon])=>{
 const c={id:'qw:'+id,name,pinyin,province,city,country,lat,lon,region:[...new Set([province,city,country].filter(Boolean))].join(' · ')};
 const n=normalizeCity(name),py=normalizeCity(pinyin),parent=normalizeCity(city),prov=normalizeCity(province);
 return {c,n,py,full:prov+parent+n,cityName:parent+n,capital:n===parent};
});
export function searchLocalCities(query, limit=30){
  const raw=query.trim(),q=normalizeCity(query);if(!q)return [];
  return entries.map(e=>{
    const rank=e.c.name===raw?0:e.n===q||e.py===q?1:e.n.startsWith(q)||e.py.startsWith(q)?2:e.full.includes(q)||e.cityName.includes(q)||e.n.includes(q)?3:99;
    return {e,rank};
  }).filter(x=>x.rank<99).sort((a,b)=>a.rank-b.rank || Number(b.e.capital)-Number(a.e.capital) || a.e.c.id.localeCompare(b.e.c.id)).slice(0,limit).map(x=>x.e.c);
}
export function sameCity(a,b){
 return a.id===b.id || (normalizeCity(a.name)===normalizeCity(b.name) && Math.abs(Number(a.lat)-Number(b.lat))<0.15 && Math.abs(Number(a.lon)-Number(b.lon))<0.15);
}
