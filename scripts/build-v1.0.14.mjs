import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT=process.cwd();
const BASE_VERSION='1.0.13';
const VERSION='1.0.14';
const DATE='2026-07-27';

function decodePayload(version){
  const dir=path.join(ROOT,'assets',`v${version}`);
  const names=fs.readdirSync(dir).filter(name=>/^payload-\d+\.b64$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const parts=names.map(name=>{const clean=fs.readFileSync(path.join(dir,name),'utf8').replace(/[^A-Za-z0-9+/=]/g,''),core=clean.replace(/=/g,'');if(core.length%4===1)throw new Error(`${name}: invalid Base64 length`);return Buffer.from(core+'='.repeat((4-core.length%4)%4),'base64')});
  return gunzipSync(Buffer.concat(parts)).toString('utf8');
}
function replaceOnce(source,before,after,label){const index=source.indexOf(before);if(index<0)throw new Error(`Missing target: ${label}`);if(source.indexOf(before,index+before.length)>=0)throw new Error(`Non-unique target: ${label}`);return source.slice(0,index)+after+source.slice(index+before.length)}
function replaceFunction(source,name,replacement){const marker=`function ${name}`,start=source.indexOf(marker);if(start<0)throw new Error(`Function not found: ${name}`);const from=start+marker.length,next=source.slice(from).match(/\sfunction\s+[A-Za-z_$][\w$]*\s*\(/),end=next?from+next.index:source.length;return source.slice(0,start)+replacement.trim()+' '+source.slice(end).trimStart()}
function section(text,kind,name){const startMarker=`/* @${kind} ${name} */`,endMarker=`/* @end ${name} */`,start=text.indexOf(startMarker),end=text.indexOf(endMarker);if(start<0||end<0||end<=start)throw new Error(`Patch section missing: ${kind} ${name}`);return text.slice(start+startMarker.length,end).trim()}

let html=decodePayload(BASE_VERSION);
const oldTools=fs.readFileSync(path.join(ROOT,'src','amap-v1.0.13-tools.html'),'utf8').trim();
const newTools=fs.readFileSync(path.join(ROOT,'src','amap-v1.0.14-tools.html'),'utf8').trim();
const css=fs.readFileSync(path.join(ROOT,'src','amap-v1.0.14.css'),'utf8');
const patches=fs.readFileSync(path.join(ROOT,'src','amap-v1.0.14-patches.js'),'utf8');

html=replaceOnce(html,'<meta name="travel-map-version" content="1.0.13">',`<meta name="travel-map-version" content="${VERSION}">`,'document version meta');
html=replaceOnce(html,'QINGDAO · COUPLE TRIP · v1.0.13',`QINGDAO · COUPLE TRIP · v${VERSION}`,'visible version label');
html=replaceOnce(html,"const APP_VERSION='1.0.13';",`const APP_VERSION='${VERSION}';`,'runtime version');
html=replaceOnce(html,'travel-plans-v1.0.13',`travel-plans-v${VERSION}`,'deployment version');
html=replaceOnce(html,'<title>青岛情侣旅行计划｜2026.08.09–08.16</title>','<title>青岛旅行计划</title>','browser title');
html=replaceOnce(html,oldTools,newTools,'AMap assistant DOM');
html=replaceOnce(html,'</style>',css+'\n</style>','v1.0.14 CSS');

const oldState="let activeBasemap='osm',activeTileLayer=null,basemapFailures={},autoFailoverLock=false,amapInstance=null,amapMarkers=[],amapOverlays=[],mapEngine='leaflet',amapApiPromise=null,amapTrafficLayer=null,amapTrafficVisible=false,amapServiceOverlays=[],amapLastLngLat=null,amapSelectedPoi=null,amapSuggestionTimer=null,amapServiceLoaded=false,amapAutoComplete=null,amapPlaceSearch=null,amapGeocoder=null,amapWeatherService=null,amapGeolocationService=null,amapCurrentLocation=null,amapCurrentLabel='当前位置',amapRouteStart=null,amapRouteEnd=null,amapRouteService=null,amapRouteMode='walking',amapSearchPois=[],amapSuggestionPois=[],amapContextLocation=null,amapContextLabel='',amapAssistantReady=false;";
const newState="let activeBasemap='osm',activeTileLayer=null,basemapFailures={},autoFailoverLock=false,amapInstance=null,amapMarkers=[],amapOverlays=[],mapEngine='leaflet',amapApiPromise=null,amapTrafficLayer=null,amapTrafficVisible=false,amapServiceOverlays=[],amapLastLngLat=null,amapSelectedPoi=null,amapSuggestionTimer=null,amapServiceLoaded=false,amapAutoComplete=null,amapPlaceSearch=null,amapGeocoder=null,amapWeatherService=null,amapGeolocationService=null,amapCurrentLocation=null,amapCurrentLabel='当前位置',amapRouteStart=null,amapRouteEnd=null,amapRouteService=null,amapRouteMode='walking',amapSearchPois=[],amapSuggestionPois=[],amapContextLocation=null,amapContextLabel='',amapAssistantReady=false,amapMarkerCluster=null,amapClusterPointMap=new Map(),amapInfoWindow=null,amapTripWeatherByDate={},amapTripWeatherReportTime='',amapWeatherLoading=null,amapTrafficAutoTimer=null,amapTrafficDetailTimer=null;";
html=replaceOnce(html,oldState,newState,'v1.0.14 state');

const insertAt=html.indexOf('function amapNormalizeLocation');
if(insertAt<0)throw new Error('v1.0.14 helper insertion point missing');
html=html.slice(0,insertAt)+section(patches,'insert','v114Helpers')+' '+html.slice(insertAt);
const replacements=['iconFor','routeMarkerIcon','directionIcon','setDayRouteCard','renderDays','renderLegend','clearAmapOverlays','renderAmapView','loadAmapApi','switchToAmap','toggleAmapServicePanel','amapRouteSummary','amapWeatherAtCenter','amapTrafficAtCenter','amapPlanRoute','toggleAmapTraffic','bindAmapServiceUI','bootstrapApp'];
for(const name of replacements)html=replaceFunction(html,name,section(patches,'replace',name));

const required=[`content="${VERSION}"`,`QINGDAO · COUPLE TRIP · v${VERSION}`,`const APP_VERSION='${VERSION}'`,`travel-plans-v${VERSION}`,'<title>青岛旅行计划</title>','AMap.MarkerCluster','travelMarkerHtml','amapRenderClusterBadge','amapTripWeatherByDate','day-weather-chip','legend-weather-detail','amapTrafficRadius','amapTaxiPickupBtn','实时路况图层默认开启','--app-height:100dvh'];
for(const token of required)if(!html.includes(token))throw new Error(`Missing generated feature: ${token}`);
for(const stale of ['<title>青岛情侣旅行计划｜2026.08.09–08.16</title>','QINGDAO · COUPLE TRIP · v1.0.13'])if(html.includes(stale))throw new Error(`Stale identity remains: ${stale}`);
[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((match,index)=>new vm.Script(match[1],{filename:`v${VERSION}-inline-${index}.js`}));

const compressed=gzipSync(Buffer.from(html),{level:9,mtime:0}),chunkSize=Math.ceil(compressed.length/4),assetDir=path.join(ROOT,'assets',`v${VERSION}`);
fs.mkdirSync(assetDir,{recursive:true});for(const name of fs.readdirSync(assetDir))fs.rmSync(path.join(assetDir,name));
for(let i=0;i<4;i++)fs.writeFileSync(path.join(assetDir,`payload-${i}.b64`),compressed.subarray(i*chunkSize,Math.min(compressed.length,(i+1)*chunkSize)).toString('base64'));

function loader(versionOnly=false){const candidates=versionOnly?`['${VERSION}']`:`['${VERSION}','${BASE_VERSION}']`;return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="travel-map-version" content="${VERSION}"><title>青岛旅行计划</title><style>html,body{height:100%;margin:0;background:#eef1f5;font-family:system-ui,"Microsoft YaHei",sans-serif}#boot{height:100%;display:grid;place-items:center;color:#334155;text-align:center;padding:24px;box-sizing:border-box}.err{max-width:760px;line-height:1.7}</style></head><body><div id="boot">正在加载青岛旅行地图…</div><script>(async()=>{const boot=document.getElementById('boot'),candidates=${candidates};const decode=text=>{const core=text.replace(/[^A-Za-z0-9+/]/g,'');if(core.length%4===1)throw new Error('Base64长度异常');return Uint8Array.from(atob(core+'='.repeat((4-core.length%4)%4)),c=>c.charCodeAt(0))};const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out};async function load(version){const root=location.pathname.includes('/versions/')?'../':'',names=['payload-0.b64','payload-1.b64','payload-2.b64','payload-3.b64'],texts=await Promise.all(names.map(async name=>{const response=await fetch(root+'assets/v'+version+'/'+name+'?loader=${VERSION}',{cache:'no-store'});if(!response.ok)throw new Error(name+' HTTP '+response.status);return response.text()})),bytes=concat(texts.map(decode));if(bytes[0]!==31||bytes[1]!==139)throw new Error('gzip文件头异常');const page=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();if(!/^\s*(?:<!doctype html|<html)/i.test(page))throw new Error('解压结果不是HTML');return page}const failures=[];for(const version of candidates){try{boot.textContent='正在加载青岛旅行地图 v'+version+'…';const page=await load(version);document.open();document.write(page);document.close();return}catch(error){failures.push('v'+version+': '+error.message)}}boot.innerHTML='<div class="err"><b>页面加载失败。</b><br>请刷新页面或使用最新版 Chrome、Edge、Safari、Firefox。<br><small>'+failures.join('；')+'</small></div>'})()</script><noscript><div class="err">此页面需要启用 JavaScript。</div></noscript></body></html>`}
fs.writeFileSync(path.join(ROOT,'index.html'),loader(false));fs.mkdirSync(path.join(ROOT,'versions'),{recursive:true});fs.writeFileSync(path.join(ROOT,'versions',`${DATE}-v${VERSION}.html`),loader(true));fs.mkdirSync(path.join(ROOT,'src'),{recursive:true});fs.writeFileSync(path.join(ROOT,'src',`v${VERSION}.html`),html);

const versionsIndex=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青岛旅行地图历史版本</title><style>body{max-width:800px;margin:48px auto;padding:0 20px;font-family:system-ui,"Microsoft YaHei",sans-serif;color:#172033;background:#f8fafc}h1{font-size:26px}a{color:#1d4ed8}.card{border:1px solid #dbe3ec;border-radius:12px;padding:16px;margin:12px 0;background:#fff}.tag{font-size:12px;color:#64748b}p{line-height:1.7}.current{border-color:#93c5fd;background:#eff6ff}.broken{border-color:#fecaca;background:#fff7f7}</style></head><body><h1>青岛旅行地图历史版本</h1><p>每个正式版本均保留独立入口；主入口会在完整性检查失败时自动回退。</p><div class="card current"><b><a href="${DATE}-v${VERSION}.html">v${VERSION} 地图标注、天气与移动端适配版</a></b><div class="tag">${DATE} · 当前正式版本</div><p>高德与 OSM 共用标注模板并支持聚合；高德路况默认开启并增加精细分析；接入行程天气；修复手机端遮挡和桌面端收起按钮视觉拼接；浏览器标题改为“青岛旅行计划”。</p></div><div class="card"><b><a href="2026-07-27-v1.0.13.html">v1.0.13 高德旅行助手版</a></b><div class="tag">稳定回退版本</div></div><div class="card"><b><a href="2026-07-27-v1.0.12.html">v1.0.12 高德实时服务初版</a></b></div><div class="card broken"><b><a href="2026-07-26-v1.0.11.html">v1.0.11 高德服务尝试版</a></b><div class="tag">压缩载荷损坏，不作为正式版本</div></div><div class="card"><b><a href="2026-07-26-v1.0.10.html">v1.0.10 稳定基线版</a></b></div><p><a href="../index.html">返回当前版本</a></p></body></html>`;
fs.writeFileSync(path.join(ROOT,'versions','index.html'),versionsIndex);
fs.writeFileSync(path.join(ROOT,'versions','README.md'),`# 历史版本\n\n- \`${DATE}-v${VERSION}.html\`：当前正式版本。同步高德/OSM标注与聚合，默认实时路况和精细分析，行程天气，移动端视口与遮挡修复，桌面收起按钮融合，页面标题简化。\n- \`2026-07-27-v1.0.13.html\`：高德旅行助手版，作为稳定回退。\n- \`2026-07-27-v1.0.12.html\`：高德实时服务初版。\n- \`2026-07-26-v1.0.11.html\`：载荷损坏，仅保留故障说明。\n- \`2026-07-26-v1.0.10.html\`：稳定基线版。\n`);
fs.writeFileSync(path.join(ROOT,'PAGES_SETUP.md'),`# GitHub Pages 分支发布\n\n- Source：\`Deploy from a branch\`\n- Branch：\`main\`\n- Folder：\`/ (root)\`\n- 公开地址：\`https://1337816143.github.io/travel-plans/\`\n- 当前正式版本：\`v${VERSION}\`\n- 稳定回退版本：\`v${BASE_VERSION}\`\n\n\`index.html\` 会优先加载 v${VERSION}，完整性校验失败时自动回退 v${BASE_VERSION}。\n\n## v1.0.14\n\n- 高德和 Leaflet/OSM 共同调用标注、路线序号和方向箭头 HTML 模板；高德使用 MarkerCluster 自动聚合。\n- 高德底图默认显示实时路况，支持 1/3/5 km 范围和道路等级的交通态势分析；驾车路线展示 TMC 路况分段及可用的打车费用估算。\n- 每日行程与路线总览接入高德 4 日天气预报。公开接口不提供小时降雨概率，页面仅按日/夜天气现象提示降水可能。\n- 高德公开接口不提供附近打车排队人数；页面不伪造该数据，改为附近出租车站/上车点搜索与打车路线估算。\n- 移动端使用动态可视视口和安全区，解决顶部提示及底部浏览器工具栏遮挡。\n`);
const sha=crypto.createHash('sha256').update(html).digest('hex');
fs.writeFileSync(path.join(ROOT,'DEPLOYMENT.md'),`# Deployment verification\n\n- Version: v${VERSION}\n- Fallback: v${BASE_VERSION}\n- Browser title: 青岛旅行计划\n- Shared markers: Leaflet and AMap use the same marker/route/direction HTML factories.\n- AMap clustering: MarkerCluster with custom point and cluster rendering.\n- Traffic: enabled by default on AMap, auto-refresh 60 seconds, selectable circle analysis, driving TMC breakdown.\n- Weather: AMap current and four-day day/night forecasts embedded in itinerary and route overview; no fabricated hourly rain probability.\n- Taxi: no public queue-count endpoint; nearby pickup points, traffic-aware route and available fare estimate only.\n- Mobile: dynamic visual viewport, safe-area placement, non-overlapping top controls/notice/route card, bounded collapsible legend.\n- Full HTML SHA-256: \`${sha}\`\n`);
console.log(`Built v${VERSION}: ${compressed.length} gzip bytes, ${html.length} HTML characters, SHA-256 ${sha}`);
