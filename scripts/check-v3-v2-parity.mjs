import console from 'node:console';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function requireTokens(relativePath, tokens) {
  const source = read(relativePath);
  for (const token of tokens) {
    if (!source.includes(token))
      throw new Error(`${relativePath} is missing parity token: ${token}`);
  }
}

const stableHtml = read('src/v2.5.4.html');
const stableManifest = readJson('assets/v2.5.4/manifest.json');
const stableSha256 = createHash('sha256').update(stableHtml).digest('hex');
if (stableSha256 !== stableManifest.sha256) {
  throw new Error(`Embedded v2.5.4 HTML drifted: ${stableSha256} != ${stableManifest.sha256}`);
}

const runtimePoints = readJson('data/qingdao/places/imports/legacy-v2.5.4-runtime-points.v1.json');
const legacyContent = readJson('data/qingdao/content/imports/legacy-v2.5.4-content.v1.json');
const expectedCounts = {
  primaryPoints: 39,
  wishlistMapPoints: 10,
  runtimePoints: 49,
  sources: 24,
  reservations: 8,
  hotels: 3,
  wishlistAttractions: 17,
  wishlistItems: 12,
};
for (const [key, value] of Object.entries(expectedCounts)) {
  const actual = runtimePoints.counts[key] ?? legacyContent.counts[key];
  if (actual !== value) throw new Error(`Legacy parity count ${key}: ${actual} != ${value}`);
}

const scheduleContext = {};
vm.runInNewContext(
  `${read('src-v2/data/generated/schedules.js')}\nglobalThis.scheduleCount = SCHEDULES.length;`,
  scheduleContext,
);
if (scheduleContext.scheduleCount !== 8) {
  throw new Error(`Legacy schedule count: ${scheduleContext.scheduleCount} != 8`);
}

requireTokens('src-v2/template.html', [
  'data-tab="booking"',
  'data-tab="days"',
  'data-tab="search"',
  'data-tab="recommend"',
  'data-tab="stay"',
  'data-tab="tools"',
  'data-tab="sources"',
  'id="basemapSelect"',
  'id="map"',
  'id="amapMap"',
  'id="amapServicePanel"',
  'id="amapWeatherBtn"',
  'id="amapRouteBtn"',
  'id="tripToolsRoot"',
]);
for (const modulePath of [
  'src-v2/map/leaflet-adapter.js',
  'src-v2/map/amap-adapter.js',
  'src-v2/map/basemap-controller.js',
  'src-v2/services/weather-service.js',
  'src-v2/services/traffic-service.js',
  'src-v2/ui/food-search-panel.js',
  'src-v2/ui/hotel-panel.js',
  'src-v2/ui/trip-operations.js',
  'src-v2/ui/wishlist-panel.js',
]) {
  if (!fs.existsSync(path.join(root, modulePath)))
    throw new Error(`Legacy module missing: ${modulePath}`);
}

requireTokens('apps/web/src/view.ts', [
  'data-workspace="guide"',
  'data-workspace="planner"',
  'src="../index.html?embedded=v3"',
  '39 个主要点位＋10 个必吃必买地图点',
  '逐日攻略、住宿、预约、点位与美食检索',
  '天气、路况、路线、日历、预算与旅行工具',
]);
requireTokens('apps/web/src/map-view.ts', [
  'data-real-basemap="true"',
  'data-leaflet-map',
  'data-basemap-select',
  'data-map-scope-select',
  '完整高德地图与攻略',
]);
requireTokens('apps/web/src/leaflet-map.ts', [
  "import L from 'leaflet'",
  'tile.openstreetmap.org',
  'basemaps.cartocdn.com',
  'wgs84ToGcj02',
  'addCatalogLayer',
  '在高德地图中打开',
]);

const v3Source = [
  read('apps/web/src/view.ts'),
  read('apps/web/src/map-view.ts'),
  read('apps/web/src/leaflet-map.ts'),
].join('\n');
if (v3Source.includes('无真实底图')) {
  throw new Error('v3 source still declares that it has no real basemap.');
}

console.log(
  `v2.5.4 → v3 parity passed: exact embedded HTML ${stableSha256}, 49 points, 8 days, 8 reservations, 3 hotels, 24 sources, full guide plus native Leaflet planner map`,
);
