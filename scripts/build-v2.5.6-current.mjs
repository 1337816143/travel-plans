import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERSION = '2.5.6';
const PREVIOUS = '2.5.5';
const ROLLBACK = '2.5.4';
const STABLE = '1.0.15';
const DATE = '2026-08-09';
const RELEASE_TIMESTAMP = '2026-08-09T00:00:00+08:00';
const FROZEN_V254_HASH = '264fda8953fda2773cfe73f77372f20963ed0821acfa1701ac76bea872f2c027';

function run(script) {
  const result = spawnSync(process.execPath, [script], { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} exited with ${result.status}`);
}
function read(...parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
}
function write(file, content) {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function mustReplace(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`v${VERSION} build token missing: ${label}`);
  return next;
}

// Reproduce the previous release from its frozen v2.5.4 source first. This keeps v2.5.5 a deterministic fallback.
run('scripts/build-v2.5.5-current.mjs');
run('scripts/fix-v2.5.5-service-worker.mjs');

const previousManifest = JSON.parse(read('assets', `v${PREVIOUS}`, 'manifest.json'));
const previousHtml = read('src', `v${PREVIOUS}.html`);
if (sha(previousHtml) !== previousManifest.sha256) {
  throw new Error(`v${PREVIOUS} source does not match its manifest; refuse to derive v${VERSION}`);
}
if (previousManifest.baseSha256 !== FROZEN_V254_HASH) {
  throw new Error('v2.5.5 no longer points at the frozen v2.5.4 baseline');
}

const addonCss = read('src-v2.5.6', 'mobile-real-routes.css');
const addonJs = read('src-v2.5.6', 'mobile-real-routes.js');
const status = JSON.parse(read('data', 'qingdao', 'ops', 'current-status-2026-08-09.json'));
new vm.Script(addonJs, { filename: 'src-v2.5.6/mobile-real-routes.js' });

let html = previousHtml.replaceAll('2.5.5', VERSION);
html = mustReplace(
  html,
  /name="travel-map-release" content="[^"]+"/,
  `name="travel-map-release" content="${DATE}-v${VERSION}.html"`,
  'release metadata',
);
html = mustReplace(
  html,
  '</head>',
  `<style id="mobile-real-routes-v256">${addonCss}</style>\n</head>`,
  'v2.5.6 stylesheet injection',
);
const statusScript = `<script id="official-status-data-v256">window.__QINGDAO_OPS_STATUS_V256__=${JSON.stringify(status).replace(/</g, '\\u003c')};<\/script>`;
const addonScript = `<script id="mobile-real-routes-app-v256">${addonJs}<\/script>`;
html = mustReplace(html, '</body>', `${statusScript}\n${addonScript}\n</body>`, 'v2.5.6 runtime injection');

if (!html.includes(`const APP_VERSION='${VERSION}'`)) throw new Error('APP_VERSION was not promoted');
if (!html.includes('TravelActualRoutes')) throw new Error('actual-route runtime was not injected');
if (!html.includes('TravelMobileDaySwipe')) throw new Error('mobile day swipe runtime was not injected');
if (!html.includes('TravelHourlyWeather')) throw new Error('hourly weather runtime was not injected');
if (!html.includes('TravelOfficialStatus')) throw new Error('official status runtime was not injected');
if (!html.includes('笨蛤蜊地标小吃大排档')) throw new Error('must-eat addition is missing');
if (!html.includes('沙子口休闲广场') || !html.includes('Vya无涯coffee') || !html.includes('青岛云上海天')) {
  throw new Error('leisure backup additions are incomplete');
}

[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((match, index) => {
  new vm.Script(match[1], { filename: `v256-inline-${index}.js` });
});

const lazySource = read('assets', `v${PREVIOUS}`, 'lazy-tools.js').replaceAll(PREVIOUS, VERSION);
new vm.Script(lazySource, { filename: `assets/v${VERSION}/lazy-tools.js` });
const gzip = gzipSync(Buffer.from(html), { level: 9, mtime: 0 });
const lazyGzip = gzipSync(Buffer.from(lazySource), { level: 9, mtime: 0 });
const initialBudget = Number(previousManifest.gzipBytes) + 45_000;
const totalBudget = Number(previousManifest.totalGzipBytes) + 52_000;
if (gzip.length > initialBudget) throw new Error(`Initial gzip budget exceeded: ${gzip.length} > ${initialBudget}`);
if (gzip.length + lazyGzip.length > totalBudget) {
  throw new Error(`Total gzip budget exceeded: ${gzip.length + lazyGzip.length} > ${totalBudget}`);
}

const assetDir = path.join(ROOT, 'assets', `v${VERSION}`);
fs.mkdirSync(assetDir, { recursive: true });
for (const name of fs.readdirSync(assetDir)) fs.rmSync(path.join(assetDir, name), { recursive: true, force: true });
const chunkSize = Math.ceil(gzip.length / 4);
for (let index = 0; index < 4; index += 1) {
  fs.writeFileSync(
    path.join(assetDir, `payload-${index}.b64`),
    gzip.subarray(index * chunkSize, Math.min(gzip.length, (index + 1) * chunkSize)).toString('base64'),
  );
}
write(`assets/v${VERSION}/lazy-tools.js`, lazySource);
const manifest = {
  version: VERSION,
  previous: PREVIOUS,
  rollback: ROLLBACK,
  fallback: STABLE,
  htmlBytes: Buffer.byteLength(html),
  gzipBytes: gzip.length,
  lazyBytes: Buffer.byteLength(lazySource),
  lazyGzipBytes: lazyGzip.length,
  totalGzipBytes: gzip.length + lazyGzip.length,
  initialDeltaBytes: gzip.length - Number(previousManifest.gzipBytes),
  totalDeltaBytes: gzip.length + lazyGzip.length - Number(previousManifest.totalGzipBytes),
  sha256: sha(html),
  lazySha256: sha(lazySource),
  builtAt: RELEASE_TIMESTAMP,
  baseVersion: PREVIOUS,
  baseSha256: previousManifest.sha256,
  frozenRollbackVersion: ROLLBACK,
  frozenRollbackSha256: FROZEN_V254_HASH,
  capabilities: [
    'mobile-day-swipe',
    'amap-actual-routes',
    'route-details-global-toggle',
    'double-tap-route-context',
    'drawer-aware-map-focus',
    'selected-day-hourly-weather',
    'per-day-rain-plan-pager',
    'official-operation-status',
  ],
};
write(`assets/v${VERSION}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
write(
  `BUNDLE_BUDGET_v${VERSION}.json`,
  `${JSON.stringify(
    {
      version: VERSION,
      previous: PREVIOUS,
      previousInitialGzip: Number(previousManifest.gzipBytes),
      previousTotalGzip: Number(previousManifest.totalGzipBytes),
      initialGzip: gzip.length,
      lazyGzip: lazyGzip.length,
      totalGzip: gzip.length + lazyGzip.length,
      initialBudget,
      totalBudget,
      passed: true,
    },
    null,
    2,
  )}\n`,
);
write(`src/v${VERSION}.html`, html);

function loader(pinned = false) {
  const candidates = pinned
    ? `['${VERSION}']`
    : `['${VERSION}','${PREVIOUS}','${ROLLBACK}','${STABLE}']`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="travel-map-version" content="${VERSION}"><title>青岛旅行计划</title><style>html,body{height:100%;margin:0;background:#eef1f5;font-family:system-ui,"Microsoft YaHei",sans-serif}#boot{height:100%;display:grid;place-items:center;color:#334155;text-align:center;padding:24px;box-sizing:border-box}.err{max-width:760px;line-height:1.7}</style></head><body><div id="boot">正在加载青岛旅行地图…</div><script>(async()=>{const boot=document.getElementById('boot'),candidates=${candidates};const decode=text=>{const core=text.replace(/[^A-Za-z0-9+/]/g,'');if(core.length%4===1)throw new Error('Base64长度异常');return Uint8Array.from(atob(core+'='.repeat((4-core.length%4)%4)),c=>c.charCodeAt(0))};const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out};async function load(version){const root=location.pathname.includes('/versions/')?'../':'',names=['payload-0.b64','payload-1.b64','payload-2.b64','payload-3.b64'],texts=await Promise.all(names.map(async name=>{const response=await fetch(root+'assets/v'+version+'/'+name+'?loader=${VERSION}',{cache:'no-store'});if(!response.ok)throw new Error(name+' HTTP '+response.status);return response.text()})),bytes=concat(texts.map(decode));if(bytes[0]!==31||bytes[1]!==139)throw new Error('gzip文件头异常');const page=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();if(!/^(?:<!doctype html|<html)/i.test(page.trimStart()))throw new Error('解压结果不是HTML');return page}const failures=[];for(const version of candidates){try{boot.textContent='正在加载青岛旅行地图 v'+version+'…';const page=await load(version);document.open();document.write(page);document.close();return}catch(error){failures.push('v'+version+': '+error.message)}}boot.innerHTML='<div class="err"><b>页面加载失败。</b><br>请刷新页面或使用最新版 Chrome、Edge、Safari、Firefox。<br><small>'+failures.join('；')+'</small></div>'})()<\/script><noscript><div class="err">此页面需要启用 JavaScript。</div></noscript></body></html>`;
}
write('index.html', loader(false));
write(`versions/${DATE}-v${VERSION}.html`, loader(true));

let versionIndex = fs.existsSync(path.join(ROOT, 'versions/index.html')) ? read('versions/index.html') : '<!doctype html><html lang="zh-CN"><body><h1>青岛旅行地图历史版本</h1></body></html>';
versionIndex = versionIndex.replace(new RegExp(`<div class="card(?: current)?"><b><a href="${DATE}-v${VERSION}\\.html">[\\s\\S]*?<\\/div>`, 'g'), '');
versionIndex = versionIndex.replaceAll('class="card current"', 'class="card"');
const card = `<div class="card current"><b><a href="${DATE}-v${VERSION}.html">v${VERSION} 移动端真实路线与逐日雨天方案版</a></b><div class="tag">当前线上版本</div><p>新增手机底部抽屉左右滑动换日、动态地图避让、高德实际道路路线与全局交通开关、双击时间段路线上下文、选定日逐小时天气、逐日左右滑动雨天方案及官方浴场/景区状态。</p></div>`;
versionIndex = versionIndex.replace(/(<body><h1>青岛旅行地图历史版本<\/h1>)/, `$1${card}`);
write('versions/index.html', versionIndex);

const currentPayloads = [0, 1, 2, 3].map((index) => `'./assets/v${VERSION}/payload-${index}.b64'`).join(',');
const previousPayloads = [0, 1, 2, 3].map((index) => `'./assets/v${PREVIOUS}/payload-${index}.b64'`).join(',');
const sw = `const CACHE='travel-plans-${VERSION}';\nconst LAZY_TOOLS='./assets/v${VERSION}/lazy-tools.js';\nconst CORE=['./','./index.html','./versions/${DATE}-v${VERSION}.html',${currentPayloads},${previousPayloads},'./versions/2026-07-31-v2.5.4.html','./assets/v2.5.4/payload-0.b64','./assets/v2.5.4/payload-1.b64','./assets/v2.5.4/payload-2.b64','./assets/v2.5.4/payload-3.b64','./versions/2026-07-27-v1.0.15.html'];\nconst OFFLINE_CORE=[...CORE,LAZY_TOOLS];\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));\nself.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='CACHE_OFFLINE_CORE')event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(OFFLINE_CORE)).then(()=>event.source?.postMessage?.({type:'OFFLINE_CORE_READY'})))});\nself.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-plans-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));\nself.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==location.origin)return;event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response}).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))))});\n`;
new vm.Script(sw, { filename: 'service-worker.js' });
write('service-worker.js', sw);
write(
  `docs/deployment/v${VERSION}-mobile-real-routes.md`,
  `# v${VERSION} mobile actual-route release\n\n- Derived from reproducible v${PREVIOUS} SHA-256 \`${previousManifest.sha256}\`.\n- Root fallback order: v${VERSION} → v${PREVIOUS} → v${ROLLBACK} → v${STABLE}.\n- Frozen v${ROLLBACK} rollback source remains \`${FROZEN_V254_HASH}\`.\n- Selected-day route distance/time is requested from AMap route services; straight-line geometry is not displayed as actual distance/time.\n- Route details are globally hidden by default.\n- Hourly forecast uses Open-Meteo only for selected-day hourly temperature/rain probability; AMap current weather remains available.\n- Official operating-status snapshot: \`data/qingdao/ops/current-status-2026-08-09.json\`.\n- Same-day official temporary closures and on-site beach flags override published seasonal service windows.\n- Built at ${RELEASE_TIMESTAMP}.\n- Payload SHA-256: \`${manifest.sha256}\`.\n`,
);

console.log(`Built v${VERSION} from v${PREVIOUS}: initial=${gzip.length}, lazy=${lazyGzip.length}, total=${gzip.length + lazyGzip.length}, sha256=${manifest.sha256}`);
