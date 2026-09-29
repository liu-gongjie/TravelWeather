import {searchLocalCities} from './city-index.js';
// Independent provider adapter. No Tencent platform token or signing secret required.
export async function getJSON(url, signal, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`天气服务暂不可用 (${response.status})`);
    const data = await response.json();
    if (data.error) throw new Error(data.reason || '天气服务异常');
    return data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export async function searchCities(name, signal) {
  const text = name.trim();
  if (!text) return [];
  if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
  const local=searchLocalCities(text);
  if(local.length)return local;
  const chinese = /^[\u3400-\u9fff]+$/.test(text);
  const base = chinese ? text.replace(/[市县区]$/, '') : text.toLowerCase();
  const variants = chinese && base.length >= 2 ? [...new Set([text,base+'市',base+'县',base+'区'])] : [text];
  const responses = await Promise.allSettled(variants.map(async name => {
    const query = new URLSearchParams({ name, count: '20', language: 'zh', format: 'json' });
    return getJSON(`https://geocoding-api.open-meteo.com/v1/search?${query}`, signal);
  }));
  if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
  if(responses.every(r=>r.status==='rejected'))throw responses[0].reason;
  const unique = new Map();
  for(const r of responses) if(r.status==='fulfilled') for(const c of r.value.results || []) unique.set(String(c.id),c);
  const match = c => (chinese ? c.name.replace(/[市县区]$/, '') : c.name.toLowerCase()) === base ? 1 : 0;
  const level = c => ({PPLC:5,PPLA:4,PPLA2:3,PPLA3:2,PPLA4:1,ADM1:4,ADM2:3,ADM3:2,ADM4:1}[c.feature_code] || 0);
  return [...unique.values()].sort((a,b)=>match(b)-match(a)||level(b)-level(a)||(b.population||0)-(a.population||0))
    .slice(0,20).map(c => ({ id: String(c.id), name: c.name, lat: c.latitude, lon: c.longitude,
      region: [...new Set([c.admin1,c.admin2,c.country].filter(Boolean))].join(' · ') }));
}
export async function fetchWeather(city) {
  const query = new URLSearchParams({ latitude: city.lat, longitude: city.lon, current: 'temperature_2m,weather_code', daily: 'weather_code,temperature_2m_max,temperature_2m_min,rain_sum,showers_sum', timezone: 'auto', forecast_days: '5' });
  const data = await getJSON(`https://api.open-meteo.com/v1/forecast?${query}`);
  if (!data.daily?.time?.length) throw new Error('暂无天气数据');
  return { now: data.current, today: data.current?.time?.slice(0,10) || data.daily.time[0], days: data.daily.time.slice(0,5).map((date,i) => ({ date, code: data.daily.weather_code[i], rainMm: dailyRainTotal(data.daily.rain_sum?.[i], data.daily.showers_sum?.[i]), max: data.daily.temperature_2m_max[i], min: data.daily.temperature_2m_min[i] })), updated: Date.now() };
}
export function condition(code) {
  if (code === 0) return ['晴','sun'];
  if (code === 1 || code === 2) return ['多云','partly'];
  if (code === 3) return ['阴','cloud'];
  if (code === 45 || code === 48) return ['雾','fog'];
  if ([71,73,75,77,85,86].includes(code)) return ['雪','snow'];
  if ([95,96,97,99].includes(code)) return ['雷雨','storm'];
  const rainLabels = {51:'毛毛雨',53:'毛毛雨',55:'毛毛雨',56:'冻毛毛雨',57:'冻毛毛雨',61:'小雨',63:'中雨',65:'大雨',66:'小冻雨',67:'大冻雨',80:'小阵雨',81:'中阵雨',82:'强阵雨'};
  if (rainLabels[code]) return [rainLabels[code],'rain'];
  return ['未知','unknown'];
}
// Open-Meteo separates large-scale rain from convective showers. Missing is not zero.
export function dailyRainTotal(rain, showers) {
  return [rain,showers].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) ? rain + showers : null;
}
// Day totals use destination-local calendar days; these are forecast classifications, not alerts.
export function dailyCondition(code, rainMm) {
  const original = condition(code);
  const rainCodes = [51,53,55,61,63,65,80,81,82];
  const thunderCodes = [95,96,97,99];
  if ((!rainCodes.includes(code) && !thunderCodes.includes(code)) || typeof rainMm !== 'number' || !Number.isFinite(rainMm) || rainMm <= 0) return original;
  let label = rainMm >= 250 ? '特大暴雨' : rainMm >= 100 ? '大暴雨' : rainMm >= 50 ? '暴雨' : rainMm >= 25 ? '大雨' : rainMm >= 10 ? '中雨' : '小雨';
  if (thunderCodes.includes(code) && rainMm < 50) label = '雷雨';
  return [label,original[1]];
}
export function icon(code, rainMm) {
  const [label, type] = dailyCondition(code, rainMm);
  const rainLines = label.includes('暴雨') ? 4 : ['大雨','大冻雨','强阵雨'].includes(label) ? 3 : ['中雨','中阵雨'].includes(label) ? 2 : 1;
  const sun = '<circle cx="32" cy="30" r="12" fill="#FBBF24" stroke="#D97706" stroke-width="2.5"/><path d="M32 8v5m0 34v5M10 30h5m34 0h5M16 14l4 4m24 24 4 4m0-32-4 4M20 42l-4 4" stroke="#D97706" stroke-width="2.5"/>';
  const cloud = '<path d="M16 44a10 10 0 0 1-1-20 15 15 0 0 1 28-3 12 12 0 1 1 5 23Z" fill="#CBD5E0" stroke="#64748B" stroke-width="2.5"/>';
  let content = type === 'sun' ? sun : type === 'partly' ? sun + cloud : cloud;
  // Keep the slanted drops centered under the cloud, with a fixed spacing.
  // A thunderstorm graded as a rainstorm uses the same four drops plus its lightning.
  if (type === 'rain' || (type === 'storm' && label.includes('暴雨'))) {
    const lines = Array.from({length: rainLines}, (_,i) => {
      const x = 33.5 + (i - (rainLines - 1) / 2) * 10;
      return `<path class="rain-line" d="M${x} 49l-3 7" stroke="#6366F1" stroke-width="3" stroke-linecap="round"/>`;
    }).join('');
    content += lines;
  }
  if (type === 'storm') content += '<path d="m34 36-9 15h8l-5 11 16-19h-9l5-7" fill="#FBBF24"/>';
  if (type === 'snow') content += '<path d="M20 49v10m-5-5h10m16-5v10m-5-5h10" stroke="#60A5FA" stroke-width="2.5"/>';
  if (type === 'fog') content += '<path d="M14 50h36M18 56h28" stroke="#94A3B8" stroke-width="3"/>';
  if (type === 'unknown') content = '<text x="25" y="43" font-size="32" fill="#94A3B8">?</text>';
  return `<svg class="weather-icon" viewBox="0 0 64 64" aria-hidden="true">${content}</svg>`;
}
