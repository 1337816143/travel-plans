import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const BASE_VERSION = '1.0.10';
const VERSION = '1.0.12';
const DATE = '2026-07-27';
const JS_KEY = '9f0fd5c87d441d1e6b50a61614ae4663';
const SECURITY_CODE = 'f64eee00a0b64e682d1e7fd0643a767f';
const WEB_KEY = 'fcdc5a905725781001576e04d37c0753';

function decodePayload(version) {
  const dir = path.join(ROOT, 'assets', `v${version}`);
  const names = fs.readdirSync(dir).filter((n) => /^payload-\d+\.b64$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const parts = names.map((name) => {
    const clean = fs.readFileSync(path.join(dir, name), 'utf8').replace(/[^A-Za-z0-9+/=]/g, '');
    const core = clean.replace(/=/g, '');
    if (core.length % 4 === 1) throw new Error(`${name}: invalid Base64 length`);
    return Buffer.from(core + '='.repeat((4 - core.length % 4) % 4), 'base64');
  });
  return gunzipSync(Buffer.concat(parts)).toString('utf8');
}
function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing target: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique target: ${label}`);
  return source.slice(0,index)+after+source.slice(index+before.length);
}
function replaceFunction(source, name, replacement) {
  const marker=`function ${name}`,start=source.indexOf(marker);
  if(start<0)throw new Error(`Function not found: ${name}`);
  const from=start+marker.length,next=source.slice(from).match(/\sfunction\s+[A-Za-z_$][\w$]*\s*\(/),end=next?from+next.index:source.length;
  return source.slice(0,start)+replacement.trim()+' '+source.slice(end).trimStart();
}
function section(text, kind, name) {
  const startMarker=`/* @${kind} ${name} */`,endMarker=`/* @end ${name} */`,start=text.indexOf(startMarker),end=text.indexOf(endMarker);
  if(start<0||end<0||end<=start)throw new Error(`Patch section missing: ${kind} ${name}`);
  return text.slice(start+startMarker.length,end).trim();
}

let html=decodePayload(BASE_VERSION);
const css=fs.readFileSync(path.join(ROOT,'src','amap-enhancements.css'),'utf8');
const tools=fs.readFileSync(path.join(ROOT,'src','amap-tools.html'),'utf8').trim();
const patchFiles=['amap-patches-1.js','amap-services-1.js','amap-services-2.js','amap-patches-2.js'];
const patches=patchFiles.map(name=>fs.readFileSync(path.join(ROOT,'src',name),'utf8')).join('\n');
html=replaceOnce(html,"const APP_VERSION='1.0.10';",`const APP_VERSION='${VERSION}';const AMAP_JS_KEY='${JS_KEY}',AMAP_SECURITY_CODE='${SECURITY_CODE}',AMAP_WEB_KEY='${WEB_KEY}',AMAP_CITY='青岛',AMAP_ADCODE='370200';`,'version and keys');
html=replaceOnce(html,"let activeBasemap='osm',activeTileLayer=null,basemapFailures={},autoFailoverLock=false,amapInstance=null,amapMarkers=[],amapOverlays=[],mapEngine='leaflet';","let activeBasemap='osm',activeTileLayer=null,basemapFailures={},autoFailoverLock=false,amapInstance=null,amapMarkers=[],amapOverlays=[],mapEngine='leaflet',amapApiPromise=null,amapTrafficLayer=null,amapTrafficVisible=false,amapServiceOverlays=[],amapLastLngLat=null,amapSelectedPoi=null,amapSuggestionTimer=null,amapServiceLoaded=false;",'AMap state');
html=replaceOnce(html,'</style>',css+'\n</style>','AMap CSS');
const oldControl='<div class="basemap-control"><label for="basemapSelect">底图</label><select id="basemapSelect"><option value="osm">OSM 标准</option><option value="carto-light">CARTO 浅色</option><option value="carto-voyager">CARTO 导航</option><option value="carto-dark">CARTO 深色</option><option value="opentopo">OpenTopoMap 地形</option><option value="hot">OSM 人道主义</option><option value="amap">高德地图（需Key）</option></select><button type="button" id="amapConfigBtn" title="配置高德Key">⚙</button><span id="basemapState">自动容灾开启</span></div>';
html=replaceOnce(html,oldControl,tools,'AMap tools DOM');
html=html.replace('高德网页底图需配置官方Web端JS API Key与安全密钥。','高德Web JS API和Web API凭证已内置；OSM异常时会自动尝试高德底图。');
for(const name of ['autoSwitchBasemap','promptAmapConfig','loadAmapApi','switchToAmap'])html=replaceFunction(html,name,section(patches,'replace',name));
const insert=html.indexOf('function initMap');if(insert<0)throw new Error('initMap insertion point missing');html=html.slice(0,insert)+section(patches,'insert','amapServices')+' '+html.slice(insert);
for(const name of ['initMap','bindUI'])html=replaceFunction(html,name,section(patches,'replace',name));
if(html.includes("prompt('请输入高德"))throw new Error('Manual key prompt remains');
for(const token of ['AMAP_JS_KEY','AMAP_WEB_KEY','amapServicePanel','amapWeatherAtCenter','amapPlanRoute','toggleAmapTraffic'])if(!html.includes(token))throw new Error(`Missing feature ${token}`);
[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((m,i)=>new vm.Script(m[1],{filename:`v${VERSION}-${i}.js`}));

const compressed=gzipSync(Buffer.from(html),{level:9,mtime:0}),chunkSize=Math.ceil(compressed.length/4),assetDir=path.join(ROOT,'assets',`v${VERSION}`);
fs.mkdirSync(assetDir,{recursive:true});for(const name of fs.readdirSync(assetDir))fs.rmSync(path.join(assetDir,name));
for(let i=0;i<4;i++)fs.writeFileSync(path.join(assetDir,`payload-${i}.b64`),compressed.subarray(i*chunkSize,Math.min(compressed.length,(i+1)*chunkSize)).toString('base64'));

function loader(versionOnly=false){const candidates=versionOnly?`['${VERSION}']`:`['${VERSION}','${BASE_VERSION}']`;return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="travel-map-version" content="${VERSION}"><title>青岛情侣旅行计划｜2026.08.09–08.16</title><style>html,body{height:100%;margin:0;background:#eef1f5;font-family:system-ui,"Microsoft YaHei",sans-serif}#boot{height:100%;display:grid;place-items:center;color:#334155;text-align:center;padding:24px;box-sizing:border-box}.err{max-width:760px;line-height:1.7}</style></head><body><div id="boot">正在加载青岛旅行地图…</div><script>(async()=>{const boot=document.getElementById('boot'),candidates=${candidates};const decode=text=>{const core=text.replace(/[^A-Za-z0-9+/]/g,'');if(core.length%4===1)throw new Error('Base64长度异常');return Uint8Array.from(atob(core+'='.repeat((4-core.length%4)%4)),c=>c.charCodeAt(0))};const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out};async function load(version){const root=location.pathname.includes('/versions/')?'../':'',names=['payload-0.b64','payload-1.b64','payload-2.b64','payload-3.b64'],texts=await Promise.all(names.map(async name=>{const response=await fetch(root+'assets/v'+version+'/'+name+'?loader=${VERSION}',{cache:'no-store'});if(!response.ok)throw new Error(name+' HTTP '+response.status);return response.text()})),bytes=concat(texts.map(decode));if(bytes[0]!==31||bytes[1]!==139)throw new Error('gzip文件头异常');const html=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();if(!/^\\s*(?:<!doctype html|<html)/i.test(html))throw new Error('解压结果不是HTML');return html}const failures=[];for(const version of candidates){try{boot.textContent='正在加载青岛旅行地图 v'+version+'…';const html=await load(version);document.open();document.write(html);document.close();return}catch(error){failures.push('v'+version+': '+error.message)}}boot.innerHTML='<div class="err"><b>页面加载失败。</b><br>请刷新页面或使用最新版 Chrome、Edge、Safari、Firefox。<br><small>'+failures.join('；')+'</small></div>'})()</script><noscript><div class="err">此页面需要启用 JavaScript。</div></noscript></body></html>`}
fs.writeFileSync(path.join(ROOT,'index.html'),loader(false));fs.mkdirSync(path.join(ROOT,'versions'),{recursive:true});fs.writeFileSync(path.join(ROOT,'versions',`${DATE}-v${VERSION}.html`),loader(true));fs.mkdirSync(path.join(ROOT,'src'),{recursive:true});fs.writeFileSync(path.join(ROOT,'src',`v${VERSION}.html`),html);
const versionsIndex=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青岛旅行地图历史版本</title><style>body{max-width:800px;margin:48px auto;padding:0 20px;font-family:system-ui,"Microsoft YaHei",sans-serif;color:#172033;background:#f8fafc}h1{font-size:26px}a{color:#1d4ed8}.card{border:1px solid #dbe3ec;border-radius:12px;padding:16px;margin:12px 0;background:#fff}.tag{font-size:12px;color:#64748b}p{line-height:1.7}.current{border-color:#93c5fd;background:#eff6ff}.broken{border-color:#fecaca;background:#fff7f7}</style></head><body><h1>青岛旅行地图历史版本</h1><p>每个正式版本均保留入口文件；完整交互地图需要联网加载地图组件和实时服务。</p><div class="card current"><b><a href="${DATE}-v${VERSION}.html">v${VERSION} 高德实时服务与桌面布局修复版</a></b><div class="tag">${DATE} · 当前正式版本</div><p>修正电脑端收起按钮位置；内置高德JS API与Web API，支持高德底图、OSM失败自动切换、天气、搜索、周边、定位、地址解析、路线规划、实时路况和静态地图。</p></div><div class="card broken"><b><a href="2026-07-26-v1.0.11.html">v1.0.11 高德服务尝试版</a></b><div class="tag">压缩载荷损坏，不作为正式版本</div></div><div class="card"><b><a href="2026-07-26-v1.0.10.html">v1.0.10 稳定基线版</a></b><div class="tag">可用回退版本</div></div><div class="card"><b><a href="2026-07-26-v1.0.9.html">v1.0.9 MarkerCluster初始化修复版</a></b></div><div class="card"><b><a href="2026-07-26-v1.0.8.html">v1.0.8 页面脚本初始化修复版</a></b></div><p><a href="../index.html">返回当前版本</a></p></body></html>`;fs.writeFileSync(path.join(ROOT,'versions','index.html'),versionsIndex);
fs.writeFileSync(path.join(ROOT,'versions','README.md'),`# 历史版本\n\n- \`${DATE}-v${VERSION}.html\`：当前正式版本。修正桌面端收起按钮；内置高德JS API与Web API，增加高德底图、自动容灾、天气、地点搜索、周边搜索、定位、地址解析、路线规划、路况及静态地图。\n- \`2026-07-26-v1.0.11.html\`：载荷损坏，仅保留故障说明。\n- \`2026-07-26-v1.0.10.html\`：稳定基线与回退版本。\n`);
fs.writeFileSync(path.join(ROOT,'PAGES_SETUP.md'),`# GitHub Pages 分支发布\n\n- Source：\`Deploy from a branch\`\n- Branch：\`main\`\n- Folder：\`/ (root)\`\n- 公开地址：\`https://1337816143.github.io/travel-plans/\`\n- 当前正式版本：\`v${VERSION}\`\n- 稳定回退版本：\`v${BASE_VERSION}\`\n\n\`index.html\` 会优先加载 v${VERSION}，完整性校验失败时自动回退 v${BASE_VERSION}。\n\n## 高德接口\n\n- Web JS API Key、安全密钥和 Web API Key 已按用户要求写入前端代码。\n- 功能包括高德底图、OSM异常自动切换、天气、输入提示、关键词与周边搜索、定位与坐标转换、逆地理编码、路径规划、交通态势、实时路况图层和静态地图。\n- 仓库为公开仓库，凭证可被访问者读取；应在高德控制台设置可用域名、额度告警并监控异常调用。\n`);
const sha=crypto.createHash('sha256').update(html).digest('hex');fs.writeFileSync(path.join(ROOT,'DEPLOYMENT.md'),`# Deployment verification\n\n- Version: v${VERSION}\n- Publishing mode: GitHub Pages branch publishing from \`main\` and \`/ (root)\`\n- Desktop fix: edge toggle anchored to \`left:0\` inside the map column on desktop.\n- AMap JS API: embedded credentials, Loader 2.0, AMap basemap, scale, toolbar, geolocation and live traffic.\n- AMap Web API: weather, IP location, input tips, keyword/nearby search, geocoding/reverse geocoding, GPS conversion, walking/driving/transit routing, traffic status and static maps.\n- Failover: Leaflet tile errors attempt AMap before other providers.\n- Full HTML SHA-256: \`${sha}\`\n`);
console.log(`Built v${VERSION}: ${compressed.length} gzip bytes, ${html.length} HTML characters, SHA-256 ${sha}`);
