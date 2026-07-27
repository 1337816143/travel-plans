import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';

const ROOT=process.cwd(),VERSION='1.0.14';
function fail(message){throw new Error(message)}
function decodeVersion(version){const dir=path.join(ROOT,'assets',`v${version}`),names=fs.readdirSync(dir).filter(name=>/^payload-\d+\.b64$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(names.length!==4)fail(`v${version}: expected 4 payload files`);const gzip=Buffer.concat(names.map(name=>{const clean=fs.readFileSync(path.join(dir,name),'utf8').replace(/[^A-Za-z0-9+/=]/g,''),core=clean.replace(/=/g,'');if(core.length%4===1)fail(`${name}: invalid Base64 length`);return Buffer.from(core+'='.repeat((4-core.length%4)%4),'base64')}));if(gzip[0]!==0x1f||gzip[1]!==0x8b)fail('invalid gzip signature');return gunzipSync(gzip).toString('utf8')}
const html=decodeVersion(VERSION),source=fs.readFileSync(path.join(ROOT,'src',`v${VERSION}.html`),'utf8');if(html!==source)fail('Historical source and payload differ');
for(const token of [`<meta name="travel-map-version" content="${VERSION}">`,`QINGDAO · COUPLE TRIP · v${VERSION}`,`const APP_VERSION='${VERSION}'`,`travel-plans-v${VERSION}`,'AMap.MarkerCluster','travelMarkerHtml','day-weather-chip','amapTrafficRadius'])if(!html.includes(token))fail(`Historical feature missing: ${token}`);
[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((match,index)=>new vm.Script(match[1],{filename:`historical-v${VERSION}-${index}.js`}));
const history=fs.readFileSync(path.join(ROOT,'versions','2026-07-27-v1.0.14.html'),'utf8');if(!history.includes("['1.0.14']"))fail('Historical loader must load only v1.0.14');
console.log(`Historical v${VERSION} validation OK: html=${html.length}`);
