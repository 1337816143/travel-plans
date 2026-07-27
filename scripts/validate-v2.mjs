import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const ROOT=process.cwd(),VERSION='2.2.0',FALLBACK='1.0.15';
function fail(message){throw new Error(message)}
function read(...parts){return fs.readFileSync(path.join(ROOT,...parts),'utf8')}
function decode(version){const dir=path.join(ROOT,'assets',`v${version}`);const names=fs.readdirSync(dir).filter(n=>/^payload-\d+\.b64$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(names.length!==4)fail(`Expected four payload chunks for v${version}`);const buffers=names.map(name=>{const clean=read('assets',`v${version}`,name).replace(/[^A-Za-z0-9+/=]/g,''),core=clean.replace(/=/g,'');if(core.length%4===1)fail(`${name}: invalid base64`);return Buffer.from(core+'='.repeat((4-core.length%4)%4),'base64')});return gunzipSync(Buffer.concat(buffers)).toString('utf8')}

const html=decode(VERSION),source=read('src',`v${VERSION}.html`);
if(html!==source)fail('Generated source and payload differ');
const hash=crypto.createHash('sha256').update(html).digest('hex');if(!read('DEPLOYMENT.md').includes(hash))fail('Deployment hash mismatch');
for(const token of [`content="${VERSION}"`,`const APP_VERSION='${VERSION}'`,`travel-plans-v${VERSION}`,'window.TravelCore','window.TravelV2','window.TravelFloatingLayers','window.TravelRouteDrawer','window.TravelVersionUpdate','window.TravelAmapStartup','window.TravelPreferences','window.TravelData','window.TravelDataCatalog','window.TravelMapAdapters','window.TravelReminders','window.TravelServiceDiagnostics','检测到新版本','正在加载高德地图与实时路况','出发提醒','准备离线访问'])if(!html.includes(token))fail(`Missing v2.2 feature: ${token}`);
for(const stale of ['QINGDAO · COUPLE TRIP · v2.1.0','travel-plans-v2.1.0'])if(html.includes(stale))fail(`Stale v2.1 identity in v2.2 page: ${stale}`);
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];scripts.forEach((m,i)=>new vm.Script(m[1],{filename:`v2-inline-${i}.js`}));
const worker=read('service-worker.js');new vm.Script(worker,{filename:'service-worker.js'});for(const token of ['SKIP_WAITING','CACHE_OFFLINE_CORE','OFFLINE_CORE_READY'])if(!worker.includes(token))fail(`Service worker missing ${token}`);

const loader=read('index.html'),loaderScript=loader.match(/<script>([\s\S]*?)<\/script>/i)?.[1];if(!loaderScript)fail('Root loader script missing');new vm.Script(loaderScript,{filename:'index-loader.js'});
if(!loader.includes(`['${VERSION}','${FALLBACK}']`))fail('Root fallback order is incorrect');
if(!read('versions','2026-07-27-v2.2.0.html').includes(`['${VERSION}']`))fail('Historical v2.2.0 loader is not pinned');
if(!fs.existsSync(path.join(ROOT,'versions','2026-07-27-v1.0.15.html')))fail('Stable v1.0.15 historical entry is missing');

const build=read('scripts','build-v2.mjs');if(/gunzipSync|decodePayload|assets\/v1\.0\.15/.test(build))fail('v2 build must not use compressed previous release as source');
const required=['template.html','styles/legacy.css','styles/optimization.css','styles/layout-fixes.css','styles/v2.1.css','styles/device-profiles.css','styles/v2.2.css','startup.js','app/legacy-app.js','core/runtime.js','state/preferences.js','data/trip-data.js','map/map-adapters.js','map/amap-startup.js','services/travel-services.js','services/version-update.js','services/travel-reminders.js','services/service-diagnostics.js','ui/floating-layer-manager.js','ui/route-drawer.js','optimization.js','layout-fixes.js','boot.js','service-worker.js'];
for(const file of required)if(!fs.existsSync(path.join(ROOT,'src-v2',file)))fail(`Canonical source file missing: ${file}`);
for(const file of ['points.js','schedules.js','hotels.js','bookings.js','sources.js','recommendations.js','catalog.js'])if(!fs.existsSync(path.join(ROOT,'src-v2','data','generated',file)))fail(`Extracted data file missing: ${file}`);
const legacy=read('src-v2','app','legacy-app.js');if(/(?:^|\n)const\s+POINTS\s*=/.test(legacy)||/(?:^|\n)const\s+SCHEDULES\s*=/.test(legacy))fail('POINTS or SCHEDULES still live in legacy-app.js');
if(!read('src-v2','data','generated','points.js').includes('const POINTS='))fail('POINTS was not extracted');
if(!read('src-v2','data','generated','schedules.js').match(/const\s+\w*SCHEDULE\w*\s*=/i))fail('SCHEDULES was not extracted');
if(!legacy.includes("document.getElementById('amapAutoFitRoute')?.checked!==false"))fail('Route auto-fit preference is not wired into route planning');

const storage=new Map(),documentStub={visibilityState:'visible',addEventListener(){},documentElement:{style:{setProperty(){}}},body:{appendChild(){}},getElementById(){return null},createElement(){return{setAttribute(){},className:'',textContent:''}}};
const sandbox={window:{innerHeight:800,addEventListener(){},visualViewport:null},document:documentStub,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},requestAnimationFrame:fn=>{fn();return 1},cancelAnimationFrame(){},setInterval:()=>1,clearInterval(){},AbortController,structuredClone,console};sandbox.window.window=sandbox.window;sandbox.window.document=documentStub;sandbox.window.localStorage=sandbox.localStorage;sandbox.window.requestAnimationFrame=sandbox.requestAnimationFrame;sandbox.window.cancelAnimationFrame=sandbox.cancelAnimationFrame;
vm.createContext(sandbox);vm.runInContext(read('src-v2','core','runtime.js'),sandbox);vm.runInContext(read('src-v2','state','preferences.js'),sandbox);const core=sandbox.window.TravelCore;if(!core)fail('TravelCore failed to initialize');
const first=core.requests.begin('search'),second=core.requests.begin('search');if(core.requests.current(first)||!core.requests.current(second))fail('RequestCoordinator did not invalidate stale request');
const fakeLeaflet={getCenter:()=>({lng:120.38,lat:36.06}),getZoom:()=>13};core.mapView.captureLeaflet(fakeLeaflet,{selectedDay:'08-10'});if(core.mapView.state.zoom!==13)fail('MapViewState capture failed');
sandbox.window.TravelPreferences.set('test',{ok:true});if(!sandbox.window.TravelPreferences.get('test')?.ok)fail('Preference store failed');

const adapter=read('src-v2','map','map-adapters.js'),drawer=read('src-v2','ui','route-drawer.js'),reminders=read('src-v2','services','travel-reminders.js'),diagnostics=read('src-v2','services','service-diagnostics.js'),css=read('src-v2','styles','v2.2.css');
for(const token of ['renderMarkers','renderRoute','setView','clearLayer','fitPoints','install','renderTrip'])if(!adapter.includes(token))fail(`Map adapter interface missing ${token}`);
for(const token of ["'hidden'",'mobileRouteSideTab',"state==='collapsed'?'hidden'",'pointerdown'])if(!drawer.includes(token))fail(`Side-hidden drawer missing ${token}`);
for(const token of ['weather-change','rain-','deadlineReminders','unresolvedBookingCount','prepareOffline'])if(!reminders.includes(token))fail(`Reminder service missing ${token}`);
for(const token of ['amapAutoFitRoute','serviceDiagnostics','metrics'])if(!diagnostics.includes(token))fail(`Service diagnostics missing ${token}`);
for(const token of ['mobile-route-side-tab','trip-reminder-center','service-diagnostics','data-state="hidden"'])if(!css.includes(token))fail(`v2.2 CSS missing ${token}`);
console.log(`Validation OK: v${VERSION}, html=${Buffer.byteLength(html)}, sha256=${hash}; extracted data, shared adapters, reminders and side-hidden drawer passed`);
