import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const ROOT=process.cwd(),VERSION='2.0.0',FALLBACK='1.0.15';
function fail(message){throw new Error(message)}
function read(...parts){return fs.readFileSync(path.join(ROOT,...parts),'utf8')}
function decode(version){const dir=path.join(ROOT,'assets',`v${version}`);const names=fs.readdirSync(dir).filter(n=>/^payload-\d+\.b64$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(names.length!==4)fail(`Expected four payload chunks for v${version}`);const buffers=names.map(name=>{const clean=read('assets',`v${version}`,name).replace(/[^A-Za-z0-9+/=]/g,''),core=clean.replace(/=/g,'');if(core.length%4===1)fail(`${name}: invalid base64`);return Buffer.from(core+'='.repeat((4-core.length%4)%4),'base64')});return gunzipSync(Buffer.concat(buffers)).toString('utf8')}

const html=decode(VERSION),source=read('src',`v${VERSION}.html`);
if(html!==source)fail('Generated source and payload differ');
const hash=crypto.createHash('sha256').update(html).digest('hex');
if(!read('DEPLOYMENT.md').includes(hash))fail('Deployment hash mismatch');
for(const token of [`content="${VERSION}"`,`const APP_VERSION='${VERSION}'`,`travel-plans-v${VERSION}`,'window.TravelCore','window.TravelV2','RequestCoordinator','MapViewState','OverlayManager','serviceWorker.register'])if(!html.includes(token))fail(`Missing v2 feature: ${token}`);
for(const stale of ['QINGDAO · COUPLE TRIP · v1.0.15','travel-plans-v1.0.15'])if(html.includes(stale))fail(`Stale v1.0.15 identity in v2 page: ${stale}`);
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
scripts.forEach((m,i)=>new vm.Script(m[1],{filename:`v2-inline-${i}.js`}));
new vm.Script(read('service-worker.js'),{filename:'service-worker.js'});

const loader=read('index.html');
const loaderScript=loader.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
if(!loaderScript)fail('Root loader script missing');new vm.Script(loaderScript,{filename:'index-loader.js'});
if(!loader.includes(`['${VERSION}','${FALLBACK}']`))fail('Root fallback order is incorrect');
if(!read('versions','2026-07-27-v2.0.0.html').includes(`['${VERSION}']`))fail('Historical v2 loader is not pinned');
if(!fs.existsSync(path.join(ROOT,'versions','2026-07-27-v1.0.15.html')))fail('Stable v1.0.15 historical entry is missing');

const build=read('scripts','build-v2.mjs');
if(/gunzipSync|decodePayload|assets\/v1\.0\.15/.test(build))fail('v2 build must not use a compressed previous release as source');
for(const file of ['template.html','styles/legacy.css','styles/optimization.css','startup.js','app/legacy-app.js','core/runtime.js','optimization.js','boot.js','service-worker.js'])if(!fs.existsSync(path.join(ROOT,'src-v2',file)))fail(`Canonical source file missing: ${file}`);

const storage=new Map();
const documentStub={visibilityState:'visible',addEventListener(){},documentElement:{style:{setProperty(){}}},body:{appendChild(){}},getElementById(){return null},createElement(){return{setAttribute(){},className:'',textContent:''}}};
const sandbox={window:{innerHeight:800,addEventListener(){},visualViewport:null},document:documentStub,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},requestAnimationFrame:fn=>{fn();return 1},cancelAnimationFrame(){},setInterval:()=>1,clearInterval(){},AbortController,structuredClone,console};
sandbox.window.window=sandbox.window;sandbox.window.document=documentStub;sandbox.window.localStorage=sandbox.localStorage;sandbox.window.requestAnimationFrame=sandbox.requestAnimationFrame;sandbox.window.cancelAnimationFrame=sandbox.cancelAnimationFrame;
vm.createContext(sandbox);vm.runInContext(read('src-v2','core','runtime.js'),sandbox);
const core=sandbox.window.TravelCore;if(!core)fail('TravelCore failed to initialize');
const first=core.requests.begin('search'),second=core.requests.begin('search');if(core.requests.current(first)||!core.requests.current(second))fail('RequestCoordinator did not invalidate the stale request');
const fakeLeaflet={getCenter:()=>({lng:120.38,lat:36.06}),getZoom:()=>13};core.mapView.captureLeaflet(fakeLeaflet,{selectedDay:'08-10'});if(core.mapView.state.zoom!==13||core.mapView.state.selectedDay!=='08-10')fail('MapViewState capture failed');
core.overlays.add('test',{id:1});if(core.overlays.items('test').length!==1)fail('OverlayManager add failed');core.overlays.clear('test',null,()=>{});if(core.overlays.items('test').length)fail('OverlayManager clear failed');

const optimization=read('src-v2','optimization.js');
for(const token of ["core.requests.begin('traffic-detail')","core.requests.begin('place-search')","core.requests.begin('weather')",'switchToAmap=function','switchLeafletBasemap=function','updateWeatherNodes','core.refreshers.register'])if(!optimization.includes(token))fail(`Optimization integration missing: ${token}`);
console.log(`Validation OK: v${VERSION}, html=${Buffer.byteLength(html)}, sha256=${hash}; canonical source and core state tests passed`);
