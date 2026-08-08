import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERSION = '2.5.6';
const V254_HASH = '264fda8953fda2773cfe73f77372f20963ed0821acfa1701ac76bea872f2c027';
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(read('assets', `v${VERSION}`, 'manifest.json'));
const source = read('src', `v${VERSION}.html`);
const root = read('index.html');
const status = JSON.parse(read('data', 'qingdao', 'ops', 'current-status-2026-08-09.json'));

const failures = [];
const requireToken = (token, label = token) => {
  if (!source.includes(token)) failures.push(`source missing ${label}`);
};
if (manifest.version !== VERSION) failures.push('manifest version mismatch');
if (manifest.previous !== '2.5.5') failures.push('previous release must remain v2.5.5');
if (manifest.frozenRollbackVersion !== '2.5.4') failures.push('frozen rollback version mismatch');
if (manifest.frozenRollbackSha256 !== V254_HASH) failures.push('frozen rollback hash mismatch');
if (manifest.sha256 !== sha(source)) failures.push('manifest source SHA mismatch');
if (!root.includes('<meta name="travel-map-version" content="2.5.6">')) failures.push('root loader version mismatch');
if (!root.includes("candidates=['2.5.6','2.5.5','2.5.4','1.0.15']")) failures.push('root fallback order mismatch');
if (status.beaches?.length !== 9) failures.push('official beach status must contain all 9 bathing beaches');
if (!status.scenicAndIndoor?.some((item) => item.id === 'laoshan' && item.officialPublishedState === 'open-restored')) failures.push('Laoshan official status missing');

[
  ['window.TravelActualRoutes', 'actual route runtime'],
  ['window.TravelMobileDaySwipe', 'mobile swipe runtime'],
  ['window.TravelHourlyWeather', 'hourly weather runtime'],
  ['window.TravelOfficialStatus', 'official status runtime'],
  ['window.TravelLeisureBackups', 'leisure backups runtime'],
  ['data-v256-route-toggle', 'global actual-route toggle'],
  ['v256-day-plan-pager', 'horizontal rain-plan pager'],
  ['dblclick', 'double-click itinerary focus'],
  ['pointerType!==\'touch\'', 'double-tap itinerary focus'],
  ['/v5/direction/walking', 'AMap walking route endpoint'],
  ['/v5/direction/driving', 'AMap driving route endpoint'],
  ['/v5/direction/transit/integrated', 'AMap transit route endpoint'],
  ['precipitation_probability', 'hourly precipitation probability'],
  ['笨蛤蜊地标小吃大排档', 'must-eat addition'],
  ['沙子口休闲广场', 'Shazikou leisure backup'],
  ['Vya无涯coffee', 'Vya leisure backup'],
  ['青岛云上海天', 'Haitian view leisure backup'],
  ['青岛西海岸博物馆', 'West Coast rain backup'],
].forEach(([token, label]) => requireToken(token, label));

if (/高德实际道路路线[^<]{0,100}直线/.test(source)) failures.push('actual route UI must not present straight-line metrics');
if (!source.includes('实际交通</b><small>高德实际路线、里程和耗时；默认隐藏')) failures.push('route details must be hidden by default');

for (let index = 0; index < 4; index += 1) {
  const payload = path.join(ROOT, 'assets', `v${VERSION}`, `payload-${index}.b64`);
  if (!fs.existsSync(payload) || fs.statSync(payload).size === 0) failures.push(`missing payload-${index}.b64`);
}

try {
  new vm.Script(read('src-v2.5.6', 'mobile-real-routes.js'), { filename: 'mobile-real-routes.js' });
  new vm.Script(read('service-worker.js'), { filename: 'service-worker.js' });
} catch (error) {
  failures.push(`JavaScript syntax: ${error.message}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `Validation OK: v${VERSION}; beaches=${status.beaches.length}; scenic=${status.scenicAndIndoor.length}; actual routes + mobile swipe + hourly weather + horizontal rain plans enabled; v2.5.4 frozen rollback preserved`,
);
