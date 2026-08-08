import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT=process.cwd();
const VERSION='2.5.5';
const PREVIOUS='2.5.4';
const STABLE='1.0.15';
const DATE='2026-08-08';
const FROZEN_HASH='264fda8953fda2773cfe73f77372f20963ed0821acfa1701ac76bea872f2c027';
const read=(...parts)=>fs.readFileSync(path.join(ROOT,...parts),'utf8');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const fail=message=>{throw new Error(message)};
function decode(version){const dir=path.join(ROOT,'assets',`v${version}`);const names=fs.readdirSync(dir).filter(name=>/^payload-\d+\.b64$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(names.length!==4)fail(`Expected four payload chunks for v${version}`);const chunks=names.map(name=>Buffer.from(read('assets',`v${version}`,name).replace(/\s+/g,''),'base64'));return gunzipSync(Buffer.concat(chunks)).toString('utf8')}

if(sha(read('src/v2.5.4.html'))!==FROZEN_HASH)fail('Frozen v2.5.4 source hash changed');
const html=decode(VERSION),source=read(`src/v${VERSION}.html`);if(html!==source)fail('v2.5.5 source and payload differ');
const manifest=JSON.parse(read('assets',`v${VERSION}`,'manifest.json'));if(manifest.sha256!==sha(html))fail('v2.5.5 manifest hash mismatch');if(manifest.baseSha256!==FROZEN_HASH||manifest.baseVersion!==PREVIOUS)fail('v2.5.5 does not declare the frozen v2.5.4 base');
const lazy=read('assets',`v${VERSION}`,'lazy-tools.js');new vm.Script(lazy,{filename:'lazy-tools-v255.js'});if(manifest.lazySha256!==sha(lazy))fail('v2.5.5 lazy hash mismatch');
[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((match,index)=>new vm.Script(match[1],{filename:`v255-inline-${index}.js`}));
for(const token of [`content="${VERSION}"`,`const APP_VERSION='${VERSION}'`,'window.TravelRainGuide','雨天避坑和推荐','小麦岛草坪看日落','笨蛤蜊地标小吃大排档','私人游艇避坑','沙子口休闲广场','Vya无涯coffee','青岛云上海天','爱山东','点靓青岛','第一海水浴场','第二海水浴场','第三海水浴场','栈桥海水浴场','石老人海水浴场','仰口海水浴场','金沙滩海水浴场','银沙滩海水浴场','灵山湾海水浴场'])if(!html.includes(token))fail(`v2.5.5 rain feature missing: ${token}`);
const rain=JSON.parse(read('data/qingdao/rain/rain-guide.v1.json'));if(rain.beachStatus.beaches.length!==9)fail('Nine bathing beaches are required');if(rain.tripAdditions.length<8)fail('Trip additions are incomplete');if(rain.uploadedScreenshotGuide.avoidOrLowValue.length!==12)fail('Uploaded rain avoid list must contain 12 items');if(rain.uploadedScreenshotGuide.recommendedWithConditions.length<15)fail('Uploaded rain recommendation list is incomplete');if(!rain.uploadedScreenshotGuide.recommendedWithConditions.find(item=>item.name==='北九水')?.condition.includes('中到大雨'))fail('Beijiushui safety override is missing');if(!rain.beachStatus.weatherRiskIsNotClosure)fail('Weather risk must not be represented as closure state');
const officialHours=new Map(rain.beachStatus.beaches.map(item=>[item.name,[item.hoursAug09to15,item.hoursAug16]]));for(const [name,hours] of [['第一海水浴场',['09:00–21:00','09:00–18:00']],['第二海水浴场',['09:00–17:30','09:00–17:30']],['第三海水浴场',['09:00–17:30','09:00–17:30']],['栈桥海水浴场',['09:00–21:00','09:00–18:00']],['石老人海水浴场',['09:00–18:00','09:00–18:00']],['仰口海水浴场',['09:00–18:00','09:00–18:00']],['金沙滩海水浴场',['09:00–19:00','09:00–18:00']],['银沙滩海水浴场',['09:00–19:00','09:00–18:00']],['灵山湾海水浴场（城市阳台）',['09:00–19:00','09:00–18:00']]])if(JSON.stringify(officialHours.get(name))!==JSON.stringify(hours))fail(`Official trip-window hours mismatch: ${name}`);
const loader=read('index.html');if(!loader.includes(`['${VERSION}','${PREVIOUS}','${STABLE}']`))fail('Root v2.5.5 fallback chain is incorrect');if(!read('versions',`${DATE}-v${VERSION}.html`).includes(`['${VERSION}']`))fail('Historical v2.5.5 loader is not pinned');if(!fs.existsSync(path.join(ROOT,'versions','2026-07-31-v2.5.4.html')))fail('Frozen v2.5.4 historical loader missing');
const worker=read('service-worker.js');new vm.Script(worker,{filename:'service-worker.js'});for(const token of [`travel-plans-${VERSION}`,`assets/v${VERSION}/payload-0.b64`,'assets/v2.5.4/payload-0.b64','versions/2026-07-27-v1.0.15.html'])if(!worker.includes(token))fail(`Service worker fallback missing: ${token}`);
const budget=JSON.parse(read(`BUNDLE_BUDGET_v${VERSION}.json`));if(!budget.passed||manifest.gzipBytes!==gzipSync(Buffer.from(html),{level:9,mtime:0}).length||manifest.lazyGzipBytes!==gzipSync(Buffer.from(lazy),{level:9,mtime:0}).length)fail('Bundle manifest/budget mismatch');
console.log(`Validation OK: v${VERSION}; beaches=9; additions=${rain.tripAdditions.length}; screenshotAvoid=${rain.uploadedScreenshotGuide.avoidOrLowValue.length}; screenshotRecommend=${rain.uploadedScreenshotGuide.recommendedWithConditions.length}; base=${PREVIOUS}@${FROZEN_HASH}`);
