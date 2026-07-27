import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const ROOT=process.cwd(),VERSION='1.0.13';
function fail(message){throw new Error(message)}
function decodeVersion(version){const dir=path.join(ROOT,'assets',`v${version}`),names=fs.readdirSync(dir).filter(name=>/^payload-\d+\.b64$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(names.length!==4)fail(`v${version}: expected 4 payload files, got ${names.length}`);const buffers=names.map(name=>{const raw=fs.readFileSync(path.join(dir,name),'utf8'),clean=raw.replace(/[^A-Za-z0-9+/=]/g,'');if(clean!==raw.trim())fail(`${name}: non-Base64 characters found`);const core=clean.replace(/=/g,'');if(core.length%4===1)fail(`${name}: invalid Base64 length`);return Buffer.from(core+'='.repeat((4-core.length%4)%4),'base64')});const gzip=Buffer.concat(buffers);if(gzip[0]!==0x1f||gzip[1]!==0x8b)fail(`v${version}: invalid gzip signature`);const html=gunzipSync(gzip).toString('utf8');if(!/^\s*(?:<!doctype html|<html)/i.test(html))fail(`v${version}: decompressed content is not HTML`);return{html,gzip}}

const {html,gzip}=decodeVersion(VERSION),source=fs.readFileSync(path.join(ROOT,'src',`v${VERSION}.html`),'utf8');
if(html!==source)fail('Historical v1.0.13 source and compressed payload differ');
const hash=crypto.createHash('sha256').update(html).digest('hex');
const identity=[`<meta name="travel-map-version" content="${VERSION}">`,`QINGDAO · COUPLE TRIP · v${VERSION}`,`const APP_VERSION='${VERSION}'`,`travel-plans-v${VERSION}`];for(const token of identity)if(!html.includes(token))fail(`Historical version identity missing: ${token}`);
const required=['高德旅行助手','id="amapSuggestions"','id="amapSearchResults"','id="amapRouteSteps"','id="amapTripDestination"','AMap.AutoComplete','AMap.PlaceSearch','AMap.Geocoder','AMap.Geolocation','AMap.Weather','AMap.Driving','AMap.Walking','AMap.Transfer','amapRenderSearchResults','amapHandleMapClick','amapRouteSummary','amapPopulateTripDestinations','data-amap-nearby="卫生间"','data-amap-route-mode="transit"'];for(const token of required)if(!html.includes(token))fail(`Missing historical assistant feature: ${token}`);
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];if(!scripts.length)fail('No inline scripts found');scripts.forEach((match,index)=>new vm.Script(match[1],{filename:`v${VERSION}-inline-${index}.js`}));
const history=fs.readFileSync(path.join(ROOT,'versions','2026-07-27-v1.0.13.html'),'utf8'),historyScript=history.match(/<script>([\s\S]*?)<\/script>/i)?.[1];if(!historyScript)fail('Historical v1.0.13 loader script missing');new vm.Script(historyScript,{filename:'v1.0.13-history-loader.js'});if(!history.includes(`['${VERSION}']`))fail('Historical v1.0.13 loader should load only v1.0.13');
console.log(`Historical validation OK: v${VERSION}, gzip=${gzip.length}, html=${html.length}, sha256=${hash}`);

const webKey=html.match(/AMAP_WEB_KEY='([^']+)'/)?.[1];if(!webKey)fail('AMAP_WEB_KEY not found');
async function webApi(endpoint,params){const url=new URL(`https://restapi.amap.com${endpoint}`);Object.entries({...params,key:webKey,output:'JSON'}).forEach(([key,value])=>url.searchParams.set(key,String(value)));const response=await fetch(url,{headers:{'user-agent':'travel-plans-ci/historical-1.0.13'},signal:AbortSignal.timeout(15000)});if(!response.ok)fail(`${endpoint}: HTTP ${response.status}`);const data=await response.json();if(data.status!=='1')fail(`${endpoint}: ${data.info||data.infocode||'API failure'}`);return data}
try{const weather=await webApi('/v3/weather/weatherInfo',{city:'370200',extensions:'base'});if(!weather.lives?.length)fail('Weather API returned no live weather');const traffic=await webApi('/v3/traffic/status/circle',{location:'120.38,36.066',radius:1000,level:5,extensions:'base'});if(!traffic.trafficinfo)fail('Traffic API returned no trafficinfo');console.log('Historical live AMap validation OK: weather and traffic')}catch(error){const detail=[error?.message,error?.cause?.code,error?.cause?.message].filter(Boolean).join(' ');if(/fetch failed|timed?out|ETIMEDOUT|ENETUNREACH|ECONNRESET|EAI_AGAIN|AbortError/i.test(detail))console.warn('Historical live AMap validation skipped because the runner cannot reach AMap:',detail);else throw error}
