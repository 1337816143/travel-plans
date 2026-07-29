import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT=process.cwd();
const DIR=path.join(ROOT,'src-v2/data/generated');
const VERSION='2.5.1',VALIDATED_FOR='2026-07-29-v2.5.1';
const FILES={POINTS:'points.js',SCHEDULES:'schedules.js',HOTELS:'hotels.js',BOOKINGS:'bookings.js',SOURCES:'sources.js',RECOMMENDED:'recommendations.js',GIRLFRIEND_WISHLIST:'wishlist.js'};
const TRIP_DATES=new Set(Array.from({length:8},(_,i)=>`08-${String(i+9).padStart(2,'0')}`));
const REQUIRED_ATTRACTIONS=['wish-zhanqiao','wish-badaguan','wish-laoshan','wish-mayfourth','wish-signal','wish-xiaoqingdao','wish-beer','wish-golden','wish-qinyu','wish-yanerdao','wish-sculpture','wish-xiaomai','wish-sealove','wish-xiaoyushan','wish-shilaoren','wish-yumingzui','wish-ferry'];
const REQUIRED_FOOD=['food-wanhechun','food-wangjie','food-gaojia','food-qianhaiyan','food-lizhizha','drink-laoshan-cola','drink-snakegrass','food-fried-sea-intestine','food-clams','food-swimming-crab','food-xiaomujia','food-yunnan-rice-noodle'];
function binding(name,file){const code=fs.readFileSync(path.join(DIR,file),'utf8'),sandbox={};vm.createContext(sandbox);vm.runInContext(`${code}\nthis.__value=${name};`,sandbox,{filename:file});return structuredClone(sandbox.__value)}
function text(value){return typeof value==='string'&&value.trim().length>0}
function url(value){try{const parsed=new URL(value);return parsed.protocol==='http:'||parsed.protocol==='https:'}catch{return false}}
const data=Object.fromEntries(Object.entries(FILES).map(([name,file])=>[name,binding(name,file)]));
const errors=[],warnings=[],pointIds=new Set(),points=new Map();
for(const [index,p] of data.POINTS.entries()){const ref=p.id||`POINTS[${index}]`;if(!text(p.id))errors.push(`${ref} 缺少 id`);else if(pointIds.has(p.id))errors.push(`点位 ID 重复：${p.id}`);else{pointIds.add(p.id);points.set(p.id,p)}if(!text(p.name))errors.push(`${ref} 缺少 name`);if(!Number.isFinite(p.lat)||p.lat<-90||p.lat>90)errors.push(`${ref} 纬度非法`);if(!Number.isFinite(p.lng)||p.lng<-180||p.lng>180)errors.push(`${ref} 经度非法`);for(const date of p.days||[])if(!TRIP_DATES.has(date))errors.push(`${ref} 日期超出旅行范围：${date}`);if(!text(p.source))errors.push(`${ref} 必填来源为空`);for(const key of ['sourceUrl','mapUrl'])if(p[key]&&!url(p[key]))errors.push(`${ref}.${key} URL 非法`)}
const scheduleDates=new Set();for(const [index,d] of data.SCHEDULES.entries()){const ref=d.date||`SCHEDULES[${index}]`;if(!TRIP_DATES.has(d.date))errors.push(`${ref} 不在 08-09 至 08-16`);if(scheduleDates.has(d.date))errors.push(`日程日期重复：${d.date}`);scheduleDates.add(d.date);if(!text(d.title))errors.push(`${ref} 缺少标题`);if(!Array.isArray(d.route))errors.push(`${ref}.route 必须是数组`);else for(let i=0;i<d.route.length;i++){if(!(i in d.route))errors.push(`${ref} 路线序号存在空洞：${i+1}`);if(!points.has(d.route[i]))errors.push(`${ref} 路线引用不存在点位：${d.route[i]}`)}if(!Array.isArray(d.items))errors.push(`${ref}.items 必须是数组`)}
if(data.SCHEDULES.length!==8)warnings.push(`日程数量为 ${data.SCHEDULES.length}，计划范围应为 8 天`);
const bookingIds=new Set();for(const [index,b] of data.BOOKINGS.entries()){const ref=b.id||`BOOKINGS[${index}]`;if(!text(b.id))errors.push(`${ref} 缺少 id`);else if(bookingIds.has(b.id))errors.push(`预约 ID 重复：${b.id}`);else bookingIds.add(b.id);if(!text(b.name))errors.push(`${ref} 缺少名称`);for(const date of b.dates||[])if(!TRIP_DATES.has(date))errors.push(`${ref} 日期超出旅行范围：${date}`);for(const id of b.pointIds||[])if(!points.has(id))errors.push(`${ref} 引用不存在点位：${id}`);for(const [channelIndex,c] of (b.channels||[]).entries())if(c.kind==='url'&&!url(c.url))errors.push(`${ref}.channels[${channelIndex}] URL 非法`)}
for(const [index,s] of data.SOURCES.entries()){if(!text(s.name))errors.push(`SOURCES[${index}] 缺少名称`);if(!url(s.url))errors.push(`SOURCES[${index}] URL 非法`);if(!text(s.note))warnings.push(`SOURCES[${index}] 说明为空`)}for(const id of data.RECOMMENDED)if(!points.has(id))errors.push(`RECOMMENDED 引用不存在点位：${id}`);if(!data.HOTELS.length)warnings.push('HOTELS 为空');

const wishlist=data.GIRLFRIEND_WISHLIST||{},attractions=Array.isArray(wishlist.attractions)?wishlist.attractions:[],food=Array.isArray(wishlist.food)?wishlist.food:[];
if(!text(wishlist.title))errors.push('GIRLFRIEND_WISHLIST 缺少标题');
const attractionIds=new Set(),foodIds=new Set(),allRoutes=new Set(data.SCHEDULES.flatMap(day=>day.route||[])),scheduleText=JSON.stringify(data.SCHEDULES);
for(const [index,item] of attractions.entries()){
  const ref=item.id||`wishlist.attractions[${index}]`;
  if(!text(item.id))errors.push(`${ref} 缺少 id`);else if(attractionIds.has(item.id))errors.push(`愿望景点 ID 重复：${item.id}`);else attractionIds.add(item.id);
  if(!text(item.name))errors.push(`${ref} 缺少名称`);
  if(!text(item.pointId)||!points.has(item.pointId))errors.push(`${ref} 引用不存在点位：${item.pointId||'(空)'}`);
  if(!['scheduled','conditional'].includes(item.coverage))errors.push(`${ref} coverage 必须为 scheduled/conditional`);
  if(item.date&&!TRIP_DATES.has(item.date))errors.push(`${ref} 日期超出旅行范围：${item.date}`);
  if(item.coverage==='scheduled'&&!allRoutes.has(item.pointId))errors.push(`${ref} 未进入任何正式路线：${item.pointId}`);
  if(item.coverage==='conditional'&&!allRoutes.has(item.pointId)&&!scheduleText.includes(item.name)&&!(item.aliases||[]).some(alias=>scheduleText.includes(alias)))errors.push(`${ref} 条件项目未在行程说明中出现`);
  if(item.pointId==='xiaoqingdao'&&!(item.aliases||[]).includes('小青岛公园'))errors.push('小青岛必须保留“小青岛公园”别名');
  if(item.pointId==='sculpture'&&!(item.aliases||[]).includes('雕塑岛（日出）'))errors.push('雕塑园必须保留用户原话“雕塑岛（日出）”');
  if(item.pointId==='golden'&&!(item.aliases||[]).includes('黄岛金沙滩'))errors.push('金沙滩必须保留“黄岛金沙滩”别名');
}
for(const id of REQUIRED_ATTRACTIONS)if(!attractionIds.has(id))errors.push(`缺少女朋友必去景点任务：${id}`);
if(attractions.length!==REQUIRED_ATTRACTIONS.length)warnings.push(`愿望景点共 ${attractions.length} 项，预期 ${REQUIRED_ATTRACTIONS.length} 个独立地点/条件项目`);
for(const [index,item] of food.entries()){
  const ref=item.id||`wishlist.food[${index}]`;
  if(!text(item.id))errors.push(`${ref} 缺少 id`);else if(foodIds.has(item.id))errors.push(`愿望餐饮 ID 重复：${item.id}`);else foodIds.add(item.id);
  if(!text(item.name))errors.push(`${ref} 缺少名称`);if(!text(item.target))errors.push(`${ref} 缺少目标菜品/商品`);
  if(item.suggestedDate&&!TRIP_DATES.has(item.suggestedDate))errors.push(`${ref} 建议日期超出旅行范围：${item.suggestedDate}`);
  for(const key of ['sourceUrl','mapUrl'])if(item[key]&&!url(item[key]))errors.push(`${ref}.${key} URL 非法`);
}
for(const id of REQUIRED_FOOD)if(!foodIds.has(id))errors.push(`缺少女朋友必吃/必买任务：${id}`);
if(!food.find(item=>item.id==='drink-laoshan-cola')?.note?.includes('不要加强版'))errors.push('崂山可乐任务必须明确不要加强版');
if(!food.find(item=>item.id==='drink-snakegrass')?.note?.includes('先买一瓶'))errors.push('蛇草水任务必须保留先买一瓶试喝');
if(!food.find(item=>item.id==='food-lizhizha')?.note?.includes('李村'))errors.push('脂渣任务必须保留“买李村”要求');
if(!text(wishlist.seafoodRule?.text))errors.push('缺少活海鲜选择原则');

const report={version:VERSION,valid:errors.length===0,validatedFor:VALIDATED_FOR,counts:{points:data.POINTS.length,schedules:data.SCHEDULES.length,hotels:data.HOTELS.length,bookings:data.BOOKINGS.length,sources:data.SOURCES.length,recommended:data.RECOMMENDED.length,wishlistAttractions:attractions.length,wishlistFood:food.length},checks:['点位 ID 唯一','经纬度合法','日期属于 2026-08-09 至 08-16','pointIds 与路线引用存在','路线数组无序号空洞','URL 仅允许 HTTP/HTTPS','点位必填来源不为空','17个女朋友必去独立地点/条件项目全部覆盖','12项必吃/必买任务全部保留','用户原话与关键别名保留','饮料版本与试喝要求保留'],errors,warnings};
fs.writeFileSync(path.join(ROOT,'DATA_SCHEMA_REPORT_v2.5.1.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(DIR,'schema-report.js'),`/* Generated by validate-data-schema.mjs */\nconst TRAVEL_SCHEMA_REPORT=${JSON.stringify(report)};\n`);if(errors.length){console.error(JSON.stringify(report,null,2));process.exitCode=1}else console.log(`Schema OK: ${report.counts.points} points, ${report.counts.schedules} schedules, wishlist=${report.counts.wishlistAttractions}+${report.counts.wishlistFood}; warnings=${warnings.length}`);
