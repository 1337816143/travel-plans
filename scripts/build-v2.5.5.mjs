import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';

const ROOT=process.cwd();
const VERSION='2.5.5';
const PREVIOUS='2.5.4';
const STABLE='1.0.15';
const DATE='2026-08-08';
const RELEASE_TIMESTAMP='2026-08-08T16:07:00+08:00';
const FROZEN_HTML='src/v2.5.4.html';
const FROZEN_HASH='264fda8953fda2773cfe73f77372f20963ed0821acfa1701ac76bea872f2c027';

function read(...parts){return fs.readFileSync(path.join(ROOT,...parts),'utf8')}
function write(file,content){const target=path.join(ROOT,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content)}
function sha(text){return crypto.createHash('sha256').update(text).digest('hex')}
function mustReplace(text,pattern,value,label){const next=typeof pattern==='string'?text.replace(pattern,value):text.replace(pattern,value);if(next===text)throw new Error(`v2.5.5 build token missing: ${label}`);return next}

const frozen=read(FROZEN_HTML);
if(sha(frozen)!==FROZEN_HASH)throw new Error('Frozen v2.5.4 source changed; refuse to derive v2.5.5');
const rainData=JSON.parse(read('data/qingdao/rain/rain-guide.v1.json'));
if(rainData.beachStatus?.beaches?.length!==9)throw new Error('Rain guide must contain all 9 official bathing beaches');
if((rainData.uploadedScreenshotGuide?.avoidOrLowValue?.length||0)<12)throw new Error('Uploaded rain avoidance guide is incomplete');
if((rainData.uploadedScreenshotGuide?.recommendedWithConditions?.length||0)<15)throw new Error('Uploaded rain recommendation guide is incomplete');

let html=frozen.replaceAll('2.5.4',VERSION);
html=mustReplace(html,/name="travel-map-release" content="[^"]+"/,`name="travel-map-release" content="${DATE}-v${VERSION}.html"`,'release metadata');
const rainCss=read('src-v2.5.5/rain-guide.css');
const rainJs=read('src-v2.5.5/rain-guide.js');
new vm.Script(rainJs,{filename:'src-v2.5.5/rain-guide.js'});
html=mustReplace(html,'</head>',`<style id="rain-guide-v255">${rainCss}</style>\n</head>`,'head injection');
const dataScript=`<script id="rain-guide-data-v255">window.__QINGDAO_RAIN_GUIDE_DATA__=${JSON.stringify(rainData).replace(/</g,'\\u003c')};<\/script>`;
const appScript=`<script id="rain-guide-app-v255">${rainJs}<\/script>`;
html=mustReplace(html,'</body>',`${dataScript}\n${appScript}\n</body>`,'body injection');

const lazySource=read('assets/v2.5.4/lazy-tools.js').replaceAll('2.5.4',VERSION);
new vm.Script(lazySource,{filename:'assets/v2.5.5/lazy-tools.js'});
[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((match,index)=>new vm.Script(match[1],{filename:`v255-inline-${index}.js`}));
if(!html.includes(`const APP_VERSION='${VERSION}'`))throw new Error('APP_VERSION was not promoted to v2.5.5');
if(!html.includes('window.TravelRainGuide'))throw new Error('Rain guide runtime missing');

const gzip=gzipSync(Buffer.from(html),{level:9,mtime:0});
const lazyGzip=gzipSync(Buffer.from(lazySource),{level:9,mtime:0});
const previousManifest=JSON.parse(read('assets/v2.5.4/manifest.json'));
const initialBudget=Number(previousManifest.gzipBytes)+42000;
const totalBudget=Number(previousManifest.totalGzipBytes)+52000;
if(gzip.length>initialBudget)throw new Error(`Initial gzip budget exceeded: ${gzip.length} > ${initialBudget}`);
if(gzip.length+lazyGzip.length>totalBudget)throw new Error(`Total gzip budget exceeded: ${gzip.length+lazyGzip.length} > ${totalBudget}`);

const assetDir=path.join(ROOT,'assets',`v${VERSION}`);
fs.mkdirSync(assetDir,{recursive:true});
for(const name of fs.readdirSync(assetDir))fs.rmSync(path.join(assetDir,name),{recursive:true,force:true});
const chunkSize=Math.ceil(gzip.length/4);
for(let i=0;i<4;i++)fs.writeFileSync(path.join(assetDir,`payload-${i}.b64`),gzip.subarray(i*chunkSize,Math.min(gzip.length,(i+1)*chunkSize)).toString('base64'));
write(`assets/v${VERSION}/lazy-tools.js`,lazySource);
const manifest={version:VERSION,previous:PREVIOUS,fallback:STABLE,htmlBytes:Buffer.byteLength(html),gzipBytes:gzip.length,lazyBytes:Buffer.byteLength(lazySource),lazyGzipBytes:lazyGzip.length,totalGzipBytes:gzip.length+lazyGzip.length,initialDeltaBytes:gzip.length-Number(previousManifest.gzipBytes),totalDeltaBytes:gzip.length+lazyGzip.length-Number(previousManifest.totalGzipBytes),sha256:sha(html),lazySha256:sha(lazySource),builtAt:RELEASE_TIMESTAMP,baseVersion:PREVIOUS,baseSha256:FROZEN_HASH};
write(`assets/v${VERSION}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
write(`BUNDLE_BUDGET_v${VERSION}.json`,JSON.stringify({version:VERSION,previous:PREVIOUS,previousInitialGzip:Number(previousManifest.gzipBytes),previousTotalGzip:Number(previousManifest.totalGzipBytes),initialGzip:gzip.length,lazyGzip:lazyGzip.length,totalGzip:gzip.length+lazyGzip.length,initialBudget,totalBudget,passed:true},null,2)+'\n');
write(`src/v${VERSION}.html`,html);

function loader(pinned=false){
  const candidates=pinned?`['${VERSION}']`:`['${VERSION}','${PREVIOUS}','${STABLE}']`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="travel-map-version" content="${VERSION}"><title>青岛旅行计划</title><style>html,body{height:100%;margin:0;background:#eef1f5;font-family:system-ui,"Microsoft YaHei",sans-serif}#boot{height:100%;display:grid;place-items:center;color:#334155;text-align:center;padding:24px;box-sizing:border-box}.err{max-width:760px;line-height:1.7}</style></head><body><div id="boot">正在加载青岛旅行地图…</div><script>(async()=>{const boot=document.getElementById('boot'),candidates=${candidates};const decode=text=>{const core=text.replace(/[^A-Za-z0-9+/]/g,'');if(core.length%4===1)throw new Error('Base64长度异常');return Uint8Array.from(atob(core+'='.repeat((4-core.length%4)%4)),c=>c.charCodeAt(0))};const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out};async function load(version){const root=location.pathname.includes('/versions/')?'../':'',names=['payload-0.b64','payload-1.b64','payload-2.b64','payload-3.b64'],texts=await Promise.all(names.map(async name=>{const response=await fetch(root+'assets/v'+version+'/'+name+'?loader=${VERSION}',{cache:'no-store'});if(!response.ok)throw new Error(name+' HTTP '+response.status);return response.text()})),bytes=concat(texts.map(decode));if(bytes[0]!==31||bytes[1]!==139)throw new Error('gzip文件头异常');const page=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();if(!/^(?:<!doctype html|<html)/i.test(page.trimStart()))throw new Error('解压结果不是HTML');return page}const failures=[];for(const version of candidates){try{boot.textContent='正在加载青岛旅行地图 v'+version+'…';const page=await load(version);document.open();document.write(page);document.close();return}catch(error){failures.push('v'+version+': '+error.message)}}boot.innerHTML='<div class="err"><b>页面加载失败。</b><br>请刷新页面或使用最新版 Chrome、Edge、Safari、Firefox。<br><small>'+failures.join('；')+'</small></div>'})()<\/script><noscript><div class="err">此页面需要启用 JavaScript。</div></noscript></body></html>`;
}
write('index.html',loader(false));
write(`versions/${DATE}-v${VERSION}.html`,loader(true));

const previousVersionIndex=fs.existsSync(path.join(ROOT,'versions/index.html'))?read('versions/index.html'):'';
const card=`<div class="card current"><b><a href="${DATE}-v${VERSION}.html">v${VERSION} 雨天备用与浴场状态版</a></b><div class="tag">当前线上版本</div><p>完整继承冻结 v2.5.4，并新增雨天避坑/推荐专栏、9处海水浴场开放时段与实时核验入口，以及小麦岛日落、沙子口、云上海天等新增候选。</p></div>`;
if(previousVersionIndex){
  let next=previousVersionIndex.replace('class="card current"','class="card"');
  next=next.replace(/(<body><h1>青岛旅行地图历史版本<\/h1>)/,`$1${card}`);
  write('versions/index.html',next);
}else write('versions/index.html',`<!doctype html><html lang="zh-CN"><body><h1>青岛旅行地图历史版本</h1>${card}</body></html>`);

const sw=`const CACHE='travel-plans-${VERSION}';\nconst LAZY_TOOLS='./assets/v${VERSION}/lazy-tools.js';\nconst CORE=['./','./index.html','./versions/${DATE}-v${VERSION}.html','./assets/v${VERSION}/payload-0.b64','./assets/v${VERSION}/payload-1.b64','./assets/v${VERSION}/payload-2.b64','./assets/v${VERSION}/payload-3.b64','./versions/2026-07-31-v2.5.4.html','./assets/v2.5.4/payload-0.b64','./assets/v2.5.4/payload-1.b64','./assets/v2.5.4/payload-2.b64','./assets/v2.5.4/payload-3.b64','./versions/2026-07-27-v1.0.15.html'];\nconst OFFLINE_CORE=[...CORE,LAZY_TOOLS];\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));\nself.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='CACHE_OFFLINE_CORE')event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(OFFLINE_CORE)).then(()=>event.source?.postMessage?.({type:'OFFLINE_CORE_READY'})))});\nself.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-plans-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));\nself.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==location.origin)return;event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response}).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))))});\n`;
write('service-worker.js',sw);
write(`docs/deployment/v${VERSION}-rain-contingency.md`,`# v${VERSION} rain contingency release\n\n- Built deterministically from frozen v${PREVIOUS} source hash \`${FROZEN_HASH}\`.\n- Root fallback order: v${VERSION} → v${PREVIOUS} → v${STABLE}.\n- Canonical additive sources: \`data/qingdao/rain/rain-guide.v1.json\` and \`src-v2.5.5/\`.\n- v${PREVIOUS} historical source, payload and rollback branch remain unchanged.\n- Beach opening hours are official normal service windows; the page explicitly does not invent a live closure state.\n- Real-time closure is checked through 爱山东/点靓青岛, beach official accounts, phone and on-site instructions.\n- Built at ${RELEASE_TIMESTAMP}.\n- Payload SHA-256: \`${manifest.sha256}\`.\n`);
console.log(`Built v${VERSION} from frozen v${PREVIOUS}: initial=${gzip.length}, lazy=${lazyGzip.length}, total=${gzip.length+lazyGzip.length}, sha256=${manifest.sha256}`);
