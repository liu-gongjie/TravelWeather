"""Usage: python3 scripts/import_cities.py /path/to/China-City-List-latest.csv"""
import csv,json,sys,hashlib
from pathlib import Path
p=Path(sys.argv[1]);raw=p.read_bytes();lines=raw.decode('utf-8-sig').splitlines();rows=list(csv.DictReader(lines[1:]));out=[]
for r in rows:
 out.append([r['Location_ID'],r['Location_Name_ZH'],r['Location_Name_EN'],r['Adm1_Name_ZH'],r['Adm2_Name_ZH'],r['Country_Region_ZH'],float(r['Latitude']),float(r['Longitude'])])
root=Path(__file__).resolve().parents[1]
(root/'web/china-cities.js').write_text('// Factual location index from QWeather public LocationList. See CITY-DATA.md.\nexport const chinaCities = '+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
(root/'CITY-DATA.md').write_text('# 国内城市索引\n\n来源：https://github.com/qwd/LocationList/blob/master/China-City-List-latest.csv\n\n官方说明：https://dev.qweather.com/en/docs/resource/location-list/\n\n抓取日期：2026-09-28\n\n上游版本：'+lines[0].split(',')[0]+'\n\n记录数：'+str(len(out))+'\n\n原 CSV SHA256：'+hashlib.sha256(raw).hexdigest()+'\n\n仅提取名称、拼音、省市、国家及坐标事实字段。天气依旧从 Open-Meteo 获取，国际/额外地点搜索使用 GeoNames。索引不是实时行政区划保证；上游变更后可重新运行 scripts/import_cities.py 更新。\n')
print(len(out),'locations')
