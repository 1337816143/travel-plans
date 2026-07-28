import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';

const ROOT=process.cwd();
const VERSION='2.5.0';
const SOURCE_IDENTITY='2.0.0';
const PREVIOUS='2.4.0';
const FALLBACK='1.0.15';
const DATE='2026-07-28';
const RELEASE_TIMESTAMP=`${DATE}T00:00:00.000Z`;
const V2=path.join(ROOT,'src-v2');

if(!fs.existsSync(path.join(V2,'template.html')))throw new Error('Canonical src-v2/template.html is missing');
await import('./validate-data-schema.mjs');
function read(...parts){return fs.readFileSync(path.join(ROOT,...parts),'utf8')}
function write(file,content){const target=path.join(ROOT,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content)}
function replaceAllRequired(text,token,value){if(!text.includes(token))throw new Error(`Missing build token ${token}`);return text.split(token).join(value)}
function size(file){return fs.statSync(path.join(ROOT,file)).size}

let html=read('src-v2','template.html').replace('正在初始化旅行工具……','点击“旅行工具”后按需加载下一站、轨迹、交通纠正、费用、日历和健康检查。');
const css=[
  read('src-v2','styles','legacy.css'),
  read('src-v2','styles','optimization.css'),
  read('src-v2','styles','layout-fixes.css'),
  read('src-v2','styles','v2.1.css'),
  read('src-v2','styles','device-profiles.css'),
  read('src-v2','styles','v2.2.css'),
  read('src-v2','styles','v2.3.css'),
  read('src-v2','styles','v2.4.css'),
  read('src-v2','styles','v2.5.css')
].join('\n');
const generatedData=['points.js','schedules.js','hotels.js','bookings.js','sources.js','recommendations.js','schema-report.js','catalog.js'].map(name=>read('src-v2','data','generated',name)).join('\n');
const legacyBundle=[
  generatedData,
  read('src-v2','core','app-state.js'),
  read('src-v2','map','coordinate-service.js'),
  read('src-v2','map','basemap-controller.js'),
  read('src-v2','map','amap-loader.js'),
  read('src-v2','ui','amap-assistant-controller.js'),
  read('src-v2','ui','app-bootstrap.js'),
  read('src-v2','app','legacy-app.js')
].join('\n');
const modularEnhancements=[
  read('src-v2','state','versioned-storage.js'),
  read('src-v2','state','preferences.js'),
  read('src-v2','state','travel-store.js'),
  read('src-v2','data','trip-data.js'),
  read('src-v2','data','selectors.js'),
  read('src-v2','services','service-result.js'),
  read('src-v2','map','render-model.js'),
  read('src-v2','ui','booking-panel.js'),
  read('src-v2','ui','itinerary-panel.js'),
  read('src-v2','ui','search-panel.js'),
  read('src-v2','ui','hotel-panel.js'),
  read('src-v2','map','marker-renderer.js'),
  read('src-v2','map','route-renderer.js'),
  read('src-v2','services','weather-service.js'),
  read('src-v2','services','traffic-service.js'),
  read('src-v2','services','search-service.js'),
  read('src-v2','services','amap-client.js'),
  read('src-v2','map','leaflet-adapter.js'),
  read('src-v2','map','amap-adapter.js'),
  read('src-v2','map','map-adapters.js'),
  read('src-v2','services','service-facade.js'),
  read('src-v2','services','travel-services.js'),
  read('src-v2','optimization.js'),
  read('src-v2','layout-fixes.js'),
  read('src-v2','ui','accessibility-controller.js'),
  read('src-v2','ui','floating-layer-manager.js'),
  read('src-v2','ui','route-drawer.js'),
  read('src-v2','ui','layout-coordinator.js'),
  read('src-v2','map','amap-startup.js'),
  read('src-v2','services','service-diagnostics.js'),
  read('src-v2','services','travel-reminders.js'),
  read('src-v2','ui','trip-tools-loader.js'),
  read('src-v2','services','version-update.js')
].join('\n');
const lazyTools=[
  read('src-v2','services','segment-overrides.js'),
  read('src-v2','services','track-store.js'),
  read('src-v2','services','operation-log.js'),
  read('src-v2','services','finance-store.js'),
  read('src-v2','services','risk-metrics-service.js'),
  read('src-v2','services','health-check.js'),
  read('src-v2','ui','trip-operations.js'),
  read('src-v2','services','calendar-export.js'),
  read('src-v2','state','local-data-manager.js')
].join('\n');
const parts={
  '/*__APP_CSS__*/':css,
  '/*__STARTUP__*/':read('src-v2','startup.js'),
  '/*__RUNTIME__*/':read('src-v2','core','runtime.js'),
  '/*__LEGACY_APP__*/':legacyBundle,
  '/*__OPTIMIZATION__*/':modularEnhancements,
  '/*__BOOT__*/':read('src-v2','boot.js')
};
for(const [token,value] of Object.entries(parts))html=replaceAllRequired(html,token,value);
html=html.replaceAll(SOURCE_IDENTITY,VERSION);
const lazySource=lazyTools.replaceAll(SOURCE_IDENTITY,VERSION);
if(/\/\*__[A-Z_]+__\*\//.test(html))throw new Error('Unresolved v2 build token remains');
if(!html.includes(`content="${VERSION}"`)||!html.includes(`const APP_VERSION='${VERSION}'`)||!html.includes(`travel-plans-v${VERSION}`))throw new Error('v2 version identity is incomplete');

const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
for(const [index,match] of scripts.entries())new vm.Script(match[1],{filename:`v2-inline-${index}.js`});
new vm.Script(lazySource,{filename:'lazy-tools.js'});

const gzip=gzipSync(Buffer.from(html),{level:9,mtime:0});
const lazyGzip=gzipSync(Buffer.from(lazySource),{level:9,mtime:0});
const previousManifest=JSON.parse(read('assets',`v${PREVIOUS}`,'manifest.json'));
const previousInitial=Number(previousManifest.gzipBytes),previousTotal=Number(previousManifest.totalGzipBytes||previousManifest.gzipBytes);
const initialBudget=previousInitial+10000;
const totalBudget=previousTotal+45000;
if(gzip.length>initialBudget)throw new Error(`Initial gzip budget exceeded: ${gzip.length} > ${initialBudget}`);
if(gzip.length+lazyGzip.length>totalBudget)throw new Error(`Total gzip budget exceeded: ${gzip.length+lazyGzip.length} > ${totalBudget}`);
const hash=crypto.createHash('sha256').update(html).digest('hex');
const lazyHash=crypto.createHash('sha256').update(lazySource).digest('hex');
const chunkSize=Math.ceil(gzip.length/4);
const assetDir=path.join(ROOT,'assets',`v${VERSION}`);
fs.mkdirSync(assetDir,{recursive:true});
for(const name of fs.readdirSync(assetDir))fs.rmSync(path.join(assetDir,name),{recursive:true,force:true});
for(let i=0;i<4;i++)fs.writeFileSync(path.join(assetDir,`payload-${i}.b64`),gzip.subarray(i*chunkSize,Math.min(gzip.length,(i+1)*chunkSize)).toString('base64'));
write(`assets/v${VERSION}/lazy-tools.js`,lazySource);
const manifest={version:VERSION,previous:PREVIOUS,fallback:FALLBACK,htmlBytes:Buffer.byteLength(html),gzipBytes:gzip.length,lazyBytes:Buffer.byteLength(lazySource),lazyGzipBytes:lazyGzip.length,totalGzipBytes:gzip.length+lazyGzip.length,initialDeltaBytes:gzip.length-previousInitial,totalDeltaBytes:gzip.length+lazyGzip.length-previousTotal,sha256:hash,lazySha256:lazyHash,builtAt:RELEASE_TIMESTAMP};
write(`assets/v${VERSION}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
write('BUNDLE_BUDGET_v2.5.json',JSON.stringify({version:VERSION,previousInitialGzip:previousInitial,previousTotalGzip:previousTotal,initialGzip:gzip.length,lazyGzip:lazyGzip.length,totalGzip:gzip.length+lazyGzip.length,initialBudget,totalBudget,passed:true},null,2)+'\n');
const migrationFiles=['src-v2/state/versioned-storage.js','src-v2/state/travel-store.js','src-v2/data/selectors.js','src-v2/services/amap-client.js','src-v2/services/segment-overrides.js','src-v2/services/track-store.js','src-v2/services/operation-log.js','src-v2/services/finance-store.js','src-v2/services/health-check.js','src-v2/ui/layout-coordinator.js','src-v2/ui/accessibility-controller.js'];
write('MIGRATION_V2.5.json',JSON.stringify({version:VERSION,canonicalBuild:true,legacyBytes:size('src-v2/app/legacy-app.js'),modules:Object.fromEntries(migrationFiles.map(file=>[file,size(file)])),features:['observable-store','pure-amap-client','versioned-local-data','segment-overrides','gpx-tracks','budget-and-actual','next-stop-actions','operation-undo','calendar-updates','accessibility','health-check','layout-coordination']},null,2)+'\n');
write(`src/v${VERSION}.html`,html);

function loader(versionOnly=false){
  const candidates=versionOnly?`['${VERSION}']`:`['${VERSION}','${FALLBACK}']`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="travel-map-version" content="${VERSION}"><title>青岛旅行计划</title><style>html,body{height:100%;margin:0;background:#eef1f5;font-family:system-ui,"Microsoft YaHei",sans-serif}#boot{height:100%;display:grid;place-items:center;color:#334155;text-align:center;padding:24px;box-sizing:border-box}.err{max-width:760px;line-height:1.7}</style></head><body><div id="boot">正在加载青岛旅行地图…</div><script>(async()=>{const boot=document.getElementById('boot'),candidates=${candidates};const decode=text=>{const core=text.replace(/[^A-Za-z0-9+/]/g,'');if(core.length%4===1)throw new Error('Base64长度异常');return Uint8Array.from(atob(core+'='.repeat((4-core.length%4)%4)),c=>c.charCodeAt(0))};const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out};async function load(version){const root=location.pathname.includes('/versions/')?'../':'',names=['payload-0.b64','payload-1.b64','payload-2.b64','payload-3.b64'],texts=await Promise.all(names.map(async name=>{const response=await fetch(root+'assets/v'+version+'/'+name+'?loader=${VERSION}',{cache:'no-store'});if(!response.ok)throw new Error(name+' HTTP '+response.status);return response.text()})),bytes=concat(texts.map(decode));if(bytes[0]!==31||bytes[1]!==139)throw new Error('gzip文件头异常');const page=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();if(!/^(?:<!doctype html|<html)/i.test(page.trimStart()))throw new Error('解压结果不是HTML');return page}const failures=[];for(const version of candidates){try{boot.textContent='正在加载青岛旅行地图 v'+version+'…';const page=await load(version);document.open();document.write(page);document.close();return}catch(error){failures.push('v'+version+': '+error.message)}}boot.innerHTML='<div class="err"><b>页面加载失败。</b><br>请刷新页面或使用最新版 Chrome、Edge、Safari、Firefox。<br><small>'+failures.join('；')+'</small></div>'})()<\/script><noscript><div class="err">此页面需要启用 JavaScript。</div></noscript></body></html>`;
}
write('index.html',loader(false));
write(`versions/${DATE}-v${VERSION}.html`,loader(true));

const sw=read('src-v2','service-worker.js').replaceAll('__VERSION__',VERSION);
write('service-worker.js',sw);
write('versions/index.html',`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青岛旅行地图历史版本</title><style>body{max-width:820px;margin:48px auto;padding:0 20px;font-family:system-ui,"Microsoft YaHei",sans-serif;color:#172033;background:#f8fafc}.card{border:1px solid #dbe3ec;border-radius:12px;padding:16px;margin:12px 0;background:#fff}.current{border-color:#93c5fd;background:#eff6ff}.stable{border-color:#86efac;background:#f0fdf4}a{color:#1d4ed8}p{line-height:1.7}.tag{font-size:12px;color:#64748b}</style></head><body><h1>青岛旅行地图历史版本</h1><div class="card current"><b><a href="${DATE}-v${VERSION}.html">v${VERSION} 实用工具与同步增强版</a></b><div class="tag">当前线上版本</div><p>加入下一站行动卡、交通段纠正、GPX轨迹、预算与实际支出、操作撤销、状态文件导入导出、日历更新、无障碍设置、健康检查和浮层冲突协调。</p></div><div class="card"><b><a href="${DATE}-v${PREVIOUS}.html">v${PREVIOUS}</a></b><div class="tag">上一优化版本</div></div><div class="card stable"><b><a href="2026-07-27-v1.0.15.html">v1.0.15 完整稳定版</a></b><div class="tag">永久保留，不随优化版本修改</div></div><p><a href="../index.html">返回当前入口</a></p></body></html>`);
write('versions/README.md',`# 历史版本\n\n- \`${DATE}-v${VERSION}.html\`：实用工具、同步、轨迹、费用、无障碍与健康检查增强版。\n- \`${DATE}-v${PREVIOUS}.html\`：上下文适配器、统一服务结果与精细风险版。\n- \`2026-07-27-v1.0.15.html\`：完整稳定版，另由 \`archive/v1.0.15-stable\` 分支固定保存。\n`);
write('PAGES_SETUP.md',`# GitHub Pages\n\n生产分支 \`main\` 运行 v${VERSION}，加载失败时自动回退 v${FALLBACK}。旅行工具脚本在首次打开“旅行工具”时从 \`assets/v${VERSION}/lazy-tools.js\` 加载。\n\n稳定归档：\`archive/v1.0.15-stable\`，提交 \`d7d4266bd14cb8bdb89b8b03ce02720baf999512\`。\n`);
write('DEPLOYMENT.md',`# Deployment manifest\n\n- Current version: v${VERSION}\n- Previous version: v${PREVIOUS}\n- Stable fallback: v${FALLBACK}\n- Initial HTML bytes: ${Buffer.byteLength(html)}\n- Initial gzip bytes: ${gzip.length}\n- Lazy tools bytes: ${Buffer.byteLength(lazySource)}\n- Lazy tools gzip bytes: ${lazyGzip.length}\n- Total gzip bytes: ${gzip.length+lazyGzip.length}\n- Initial delta vs v${PREVIOUS}: ${gzip.length-previousInitial}\n- Total delta vs v${PREVIOUS}: ${gzip.length+lazyGzip.length-previousTotal}\n- SHA-256: \`${hash}\`\n- Lazy SHA-256: \`${lazyHash}\`\n- Canonical source: \`src-v2/\`\n- Immutable stable branch: \`archive/v1.0.15-stable\`\n`);
console.log(`Built v${VERSION}: initial=${gzip.length}, lazy=${lazyGzip.length}, total=${gzip.length+lazyGzip.length}, sha256=${hash}`);
