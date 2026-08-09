import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERSION = '2.5.7';
const V254_HASH = '264fda8953fda2773cfe73f77372f20963ed0821acfa1701ac76bea872f2c027';
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(read('assets', `v${VERSION}`, 'manifest.json'));
const source = read('src', `v${VERSION}.html`);
const root = read('index.html');
const data = JSON.parse(read('data', 'qingdao', 'checkin', 'checkin-guide.v1.json'));
const addon = read('src-v2.5.7', 'checkin-food-seaview.js');
const failures = [];
const requireToken = (token, label = token) => {
  if (!source.includes(token)) failures.push(`source missing ${label}`);
};

if (manifest.version !== VERSION) failures.push('manifest version mismatch');
if (manifest.previous !== '2.5.6') failures.push('previous release must be v2.5.6');
if (manifest.frozenRollbackVersion !== '2.5.4' || manifest.frozenRollbackSha256 !== V254_HASH)
  failures.push('frozen v2.5.4 mismatch');
if (manifest.sha256 !== sha(source)) failures.push('manifest source SHA mismatch');
if (!root.includes('<meta name="travel-map-version" content="2.5.7">'))
  failures.push('root loader version mismatch');
if (!root.includes("candidates=['2.5.7','2.5.6','2.5.5','2.5.4','1.0.15']"))
  failures.push('root fallback order mismatch');
if ((data.routes || []).length !== 2)
  failures.push('exactly two highlighted photo routes required');
if (
  !(data.locations || []).some(
    (item) =>
      item.id === 'huangdao-sign' && item.searchOnly && !('lat' in item) && !('lng' in item),
  )
)
  failures.push('Huangdao sign must remain search-only without fabricated coordinates');
if (
  !(data.locations || []).some(
    (item) => item.id === 'wuren-shop' && item.searchOnly && !('lat' in item) && !('lng' in item),
  )
)
  failures.push('Wuren shop must remain verification-first without fabricated coordinates');
if (
  !(data.locations || []).some(
    (item) => item.id === 'ohmo-cafe' && item.searchOnly && !('lat' in item) && !('lng' in item),
  )
)
  failures.push(
    'OHMO must use verified address + dynamic AMap resolution, not an unverified fixed coordinate',
  );
if ((data.food?.mustEatDrink || []).length < 9)
  failures.push('must-eat/drink additions incomplete');
if ((data.food?.bbqReference || []).length < 8) failures.push('BBQ reference pool too small');
if ((data.beachPlay || []).filter((item) => item.type === 'officialBathingBeach').length !== 2)
  failures.push('exactly two requested official bathing beaches expected');
if ((data.beachPlay || []).filter((item) => item.type === 'beachVisitOnly').length !== 2)
  failures.push('Jimo/Moon Bay must remain beach-visit-only');

[
  'TravelCheckinSpots',
  '打卡机位',
  '琴屿路',
  '海之恋Park',
  '宫崎骏漫画墙',
  '龙江路',
  '黄岛鱼鸣嘴',
  '黄岛站路牌',
  '小鱼山',
  '黄县路与黄县支路交汇口',
  '福山支路',
  '燕儿岛山公园',
  'OHMO CAFE',
  '五仁杂货铺',
  '龙口路 → 龙江路 → 黄县路',
  '福山支路 → 金口一路',
  '双合园',
  '万和春',
  '海平馄饨',
  '宽哥烧烤海鲜大排档',
  'hey妞酸奶',
  'SOJU笑猪食堂',
  '一抹崂山绿',
  '班布大叔的店',
  'WUYOO韩国冰奶冰茶咖啡',
  '味乐通炸鸡',
  '老西镇臭豆腐',
  '石雀滩',
  '唐岛湾',
  '青岛海神庙',
  '鱼鸣嘴',
  '石老人海水浴场',
  '第一海水浴场',
  '即墨区滨海公园',
  '月牙湾海滩',
  '/v5/place/text',
  '/v5/direction/walking',
  'data-v257-day-additions',
  'v257-gallery',
].forEach((token) => requireToken(token));
for (const date of ['08-10', '08-11', '08-12', '08-14', '08-15'])
  if (!data.itineraryAdditions?.[date]?.length)
    failures.push(`missing itinerary additions for ${date}`);
for (const location of data.locations || []) {
  if (!location.searchOnly && location.day && !(location.cameras || []).length)
    failures.push(`location lacks camera positions: ${location.name}`);
}
if (addon.includes('const delta=index') || addon.includes('delta/1.6'))
  failures.push('camera runtime still fabricates coordinate offsets');
if (
  addon.includes('L.polyline(path,{weight:5') ||
  addon.includes("new AMap.Polyline({path,strokeColor:'#e18a20'")
)
  failures.push('photo routes still draw schematic straight-line anchor polylines');
if (!addon.includes("amapWebRequest('/v5/direction/walking'"))
  failures.push('photo route does not call AMap walking route API');
if (!addon.includes('仅显示打卡顺序点，不绘制直线路线'))
  failures.push('photo route fallback boundary is missing');
for (let index = 0; index < 4; index += 1) {
  const payload = path.join(ROOT, 'assets', `v${VERSION}`, `payload-${index}.b64`);
  if (!fs.existsSync(payload) || fs.statSync(payload).size === 0)
    failures.push(`missing payload-${index}.b64`);
}
try {
  new vm.Script(addon, { filename: 'checkin-food-seaview.js' });
  new vm.Script(read('service-worker.js'), { filename: 'service-worker.js' });
} catch (error) {
  failures.push(`JavaScript syntax: ${error.message}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `Validation OK: v${VERSION}; check-in locations=${data.locations.length}; routes=${data.routes.length}; mustEatDrink=${data.food.mustEatDrink.length}; BBQ=${data.food.bbqReference.length}; AMap walking photo routes enforced; v2.5.4 frozen rollback preserved`,
);
