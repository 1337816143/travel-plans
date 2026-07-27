import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const ROOT=process.cwd(),VERSION='1.0.15';
function fail(message){throw new Error(message)}
function decodeVersion(version){const dir=path.join(ROOT,'assets',`v${version}`),names=fs.readdirSync(dir).filter(name=>/^payload-\d+\.b64$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(names.length!==4)fail(`v${version}: expected 4 payload files`);const buffers=names.map(name=>{const clean=fs.readFileSync(path.join(dir,name),'utf8').replace(/[^A-Za-z0-9+/=]/g,''),core=clean.replace(/=/g,'');if(core.length%4===1)fail(`${name}: invalid Base64 length`);return Buffer.from(core+'='.repeat((4-core.length%4)%4),'base64')});const gzip=Buffer.concat(buffers);if(gzip[0]!==0x1f||gzip[1]!==0x8b)fail('invalid gzip signature');return{html:gunzipSync(gzip).toString('utf8'),gzip}}
function functionText(source,name){const marker=`function ${name}`,start=source.indexOf(marker);if(start<0)fail(`Function missing: ${name}`);const from=start+marker.length,next=source.slice(from).match(/\sfunction\s+[A-Za-z_$][\w$]*\s*\(/),end=next?from+next.index:source.length;return source.slice(start,end).trim()}

const {html,gzip}=decodeVersion(VERSION),source=fs.readFileSync(path.join(ROOT,'src',`v${VERSION}.html`),'utf8');
if(html!==source)fail('Generated source and payload differ');
const hash=crypto.createHash('sha256').update(html).digest('hex');
for(const token of [`content="${VERSION}"`,`QINGDAO · COUPLE TRIP · v${VERSION}`,`const APP_VERSION='${VERSION}'`,`travel-plans-v${VERSION}`,'<title>青岛旅行计划</title>'])if(!html.includes(token))fail(`Version identity missing: ${token}`);
for(const token of ["if(mapEngine==='amap'&&amapInstance)",'const snapshot=alreadyActive','requestAnimationFrame','panel&&!panel.hidden'])if(!html.includes(token))fail(`Map-state fix missing: ${token}`);
[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((match,index)=>new vm.Script(match[1],{filename:`v${VERSION}-inline-${index}.js`}));

const historicalPath=path.join(ROOT,'versions','2026-07-27-v1.0.15.html');
if(!fs.existsSync(historicalPath))fail('Pinned v1.0.15 historical loader is missing');
const historical=fs.readFileSync(historicalPath,'utf8'),loaderScript=historical.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
if(!loaderScript)fail('Historical loader script missing');new vm.Script(loaderScript,{filename:'v1.0.15-history-loader.js'});
if(!historical.includes(`['${VERSION}']`))fail('Historical v1.0.15 loader must load only v1.0.15');
if(!historical.includes(`?loader=${VERSION}`))fail('Historical v1.0.15 cache bust is missing');

const toggleSource=functionText(html,'toggleAmapTraffic');
let switchCalls=0,visibilityCalls=0,detailCalls=0,restored=null;
const context={mapEngine:'amap',amapTrafficVisible:true,amapInstance:{getCenter:()=>({lng:120.321,lat:36.071}),getZoom:()=>14,setZoomAndCenter:(zoom,center)=>{restored={zoom,center}}},Promise,requestAnimationFrame:fn=>fn(),switchToAmap:()=>{switchCalls++;return Promise.resolve(context.amapInstance)},amapSetTrafficVisible:enabled=>{visibilityCalls++;context.amapTrafficVisible=enabled},amapTrafficAtCenter:()=>{detailCalls++;return Promise.resolve()},amapSetStatus:()=>{},console};
vm.createContext(context);vm.runInContext(toggleSource,context);await context.toggleAmapTraffic();
if(switchCalls!==0)fail('Traffic toggle re-entered switchToAmap while AMap was active');
if(visibilityCalls!==1)fail('Traffic visibility was not toggled exactly once');
if(detailCalls!==0)fail('Disabling traffic should not query detailed traffic');
if(restored?.zoom!==14||restored?.center?.[0]!==120.321||restored?.center?.[1]!==36.071)fail('Traffic toggle did not restore center and zoom');

const switchSource=functionText(html,'switchToAmap');
if(!switchSource.includes("if(mapEngine==='amap'&&amapInstance)"))fail('switchToAmap is not idempotent');
if(!switchSource.includes('if(panel&&!panel.hidden)'))fail('Hidden assistant still triggers detailed traffic request');
console.log(`Historical validation OK: v${VERSION}, gzip=${gzip.length}, html=${html.length}, sha256=${hash}`);
