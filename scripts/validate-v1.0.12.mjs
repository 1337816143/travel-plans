import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const ROOT=process.cwd();
const VERSION='1.0.12';
const FALLBACK='1.0.10';
const JS_KEY='9f0fd5c87d441d1e6b50a61614ae4663';
const SECURITY_CODE='f64eee00a0b64e682d1e7fd0643a767f';
const WEB_KEY='fcdc5a905725781001576e04d37c0753';

function fail(message){throw new Error(message)}
function decodeVersion(version){
  const dir=path.join(ROOT,'assets',`v${version}`);
  const names=fs.readdirSync(dir).filter(name=>/^payload-\d+\.b64$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  if(names.length!==4)fail(`v${version}: expected 4 payload files, got ${names.length}`);
  const buffers=names.map(name=>{
    const raw=fs.readFileSync(path.join(dir,name),'utf8');
    const clean=raw.replace(/[^A-Za-z0-9+/=]/g,'');
    if(clean!==raw.trim())fail(`${name}: non-Base64 characters found`);
    const core=clean.replace(/=/g,'');
    if(core.length%4===1)fail(`${name}: invalid Base64 length`);
    const bytes=Buffer.from(core+'='.repeat((4-core.length%4)%4),'base64');
    if(!bytes.length)fail(`${name}: decoded empty`);
    return bytes;
  });
  const gzip=Buffer.concat(buffers);
  if(gzip[0]!==0x1f||gzip[1]!==0x8b)fail(`v${version}: invalid gzip signature`);
  const html=gunzipSync(gzip).toString('utf8');
  if(!/^\s*(?:<!doctype html|<html)/i.test(html))fail(`v${version}: decompressed content is not HTML`);
  return {html,gzip,names};
}

const {html,gzip}=decodeVersion(VERSION);
const source=fs.readFileSync(path.join(ROOT,'src',`v${VERSION}.html`),'utf8');
if(html!==source)fail('Generated source and compressed payload differ');
const hash=crypto.createHash('sha256').update(html).digest('hex');
const deployment=fs.readFileSync(path.join(ROOT,'DEPLOYMENT.md'),'utf8');
if(!deployment.includes(hash))fail('DEPLOYMENT.md SHA-256 does not match generated HTML');

const required=[
  `const APP_VERSION='${VERSION}'`,
  `AMAP_JS_KEY='${JS_KEY}'`,
  `AMAP_SECURITY_CODE='${SECURITY_CODE}'`,
  `AMAP_WEB_KEY='${WEB_KEY}'`,
  "window._AMapSecurityConfig={securityJsCode:AMAP_SECURITY_CODE}",
  "version:'2.0'",
  "switchToAmap({fallbackToLeaflet:false})",
  "'/v3/weather/weatherInfo'",
  "'/v3/assistant/inputtips'",
  "'/v3/place/text'",
  "'/v3/place/around'",
  "'/v3/geocode/geo'",
  "'/v3/geocode/regeo'",
  "'/v3/assistant/coordinate/convert'",
  "'/v3/direction/walking'",
  "'/v3/direction/driving'",
  "'/v3/direction/transit/integrated'",
  "'/v3/traffic/status/circle'",
  "https://restapi.amap.com/v3/staticmap",
  'new AMap.TileLayer.Traffic',
  'id="amapServicePanel"',
  'id="trafficToggleBtn"'
];
for(const token of required)if(!html.includes(token))fail(`Missing generated feature: ${token}`);
if(html.includes("prompt('请输入高德"))fail('Manual AMap key prompt remains');
if(!/@media \(min-width:801px\)\{\.panel-edge-toggle\{left:0;transform:translate\(-50%,-50%\)\}\}/.test(html))fail('Desktop toggle override is missing');

const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if(!scripts.length)fail('No inline scripts found');
scripts.forEach((match,index)=>new vm.Script(match[1],{filename:`v${VERSION}-inline-${index}.js`}));

const loader=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
new vm.Script(loader.match(/<script>([\s\S]*?)<\/script>/i)?.[1]||fail('Loader script missing'),{filename:'index-loader.js'});
if(!loader.includes(`['${VERSION}','${FALLBACK}']`))fail('Loader fallback order is incorrect');
if(!loader.includes(`?loader=${VERSION}`))fail('Loader cache-busting version is missing');

const history=fs.readFileSync(path.join(ROOT,'versions','2026-07-27-v1.0.12.html'),'utf8');
if(!history.includes(`['${VERSION}']`))fail('Historical v1.0.12 loader should load only v1.0.12');

console.log(`Static validation OK: v${VERSION}, gzip=${gzip.length}, html=${html.length}, sha256=${hash}`);

async function webApi(endpoint,params){
  const url=new URL(`https://restapi.amap.com${endpoint}`);
  Object.entries({...params,key:WEB_KEY,output:'JSON'}).forEach(([key,value])=>url.searchParams.set(key,String(value)));
  const response=await fetch(url,{headers:{'user-agent':'travel-plans-ci/1.0'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)fail(`${endpoint}: HTTP ${response.status}`);
  const data=await response.json();
  if(data.status!=='1')fail(`${endpoint}: ${data.info||data.infocode||'API failure'}`);
  return data;
}

try{
  const weather=await webApi('/v3/weather/weatherInfo',{city:'370200',extensions:'base'});
  if(!weather.lives?.length)fail('Weather API returned no live weather');
  const geocode=await webApi('/v3/geocode/geo',{address:'五四广场',city:'青岛'});
  if(!geocode.geocodes?.[0]?.location)fail('Geocoding API returned no location');
  const places=await webApi('/v3/place/text',{keywords:'五四广场',city:'青岛',citylimit:true,offset:3});
  if(!places.pois?.length)fail('Place search API returned no POI');
  const walking=await webApi('/v3/direction/walking',{origin:'120.3846,36.0671',destination:'120.3322,36.0573'});
  if(!walking.route?.paths?.length)fail('Walking route API returned no path');
  const traffic=await webApi('/v3/traffic/status/circle',{location:'120.38,36.066',radius:1000,level:5,extensions:'base'});
  if(!traffic.trafficinfo)fail('Traffic API returned no trafficinfo');
  const staticUrl=new URL('https://restapi.amap.com/v3/staticmap');
  Object.entries({key:WEB_KEY,location:'120.38,36.066',zoom:12,size:'400*300',markers:'mid,,A:120.38,36.066'}).forEach(([k,v])=>staticUrl.searchParams.set(k,v));
  const staticResponse=await fetch(staticUrl,{signal:AbortSignal.timeout(15000)});
  if(!staticResponse.ok||!String(staticResponse.headers.get('content-type')).startsWith('image/'))fail(`Static map API failed: HTTP ${staticResponse.status}, ${staticResponse.headers.get('content-type')}`);
  console.log('Live AMap Web API validation OK: weather, geocode, place search, walking route, traffic, static map');
}catch(error){
  const detail=[error?.message,error?.cause?.code,error?.cause?.message].filter(Boolean).join(' ');
  if(/fetch failed|timed?out|ETIMEDOUT|ENETUNREACH|ECONNRESET|EAI_AGAIN|AbortError/i.test(detail)){
    console.warn('Live AMap Web API validation skipped because the CI runner cannot reach AMap:',detail);
  }else{
    throw error;
  }
}
