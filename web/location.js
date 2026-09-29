import {getJSON} from './weather.js';

export async function acquireLocation(fresh = false) {
  if (location.protocol === 'https:' && location.hostname === 'appassets.androidplatform.net') {
    const data = await getJSON(`/location?fresh=${fresh ? 1 : 0}`, undefined, 80000);
    if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)
        || Math.abs(data.latitude)>90 || Math.abs(data.longitude)>180) throw new Error('定位结果无效，请重试');
    return {coords:data};
  }
  if (!navigator.geolocation) throw new Error('设备不支持定位');
  const once = options => new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,options));
  try {
    return await once({timeout:12000,maximumAge:fresh?0:60000,enableHighAccuracy:false});
  } catch (error) {
    if (error.code===1) throw new Error('请在应用权限中允许使用位置信息');
    return once({timeout:25000,maximumAge:0,enableHighAccuracy:true});
  }
}
