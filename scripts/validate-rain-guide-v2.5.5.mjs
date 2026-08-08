import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('src-v2/data/rain-guide-v2.5.5.js','utf8');
const ui=fs.readFileSync('src-v2/ui/rain-guide-panel.js','utf8');
const css=fs.readFileSync('src-v2/styles/v2.5.5.css','utf8');
const sandbox={};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'rain-guide-v2.5.5.js'});
const data=structuredClone(sandbox.TravelRainGuideData);
const fail=message=>{throw new Error(message)};
if(data.version!=='2.5.5')fail('rain guide version mismatch');
if(data.beaches.length!==9)fail(`expected 9 official beaches, got ${data.beaches.length}`);
for(const beach of data.beaches){for(const key of ['name','season','tripHours','phone','status','checkedAt','sourceUrl'])if(!beach[key])fail(`${beach.name||'beach'} missing ${key}`)}
const names=new Set(data.newNotes.map(item=>item.title));
for(const name of ['小麦岛草坪日落','笨蛤蜊·地标小吃大排档','沙子口广场','Vya无涯coffee','青岛云上海天'])if(!names.has(name))fail(`new place missing: ${name}`);
if(!data.consumerPitfalls.some(item=>item.title==='私人游艇'&&item.level==='避开'))fail('private yacht pitfall missing');
if(!data.consumerPitfalls.some(item=>item.title.includes('白花蛇草水')&&item.detail.includes('1瓶')))fail('snake-grass one-bottle rule missing');
const north=data.rainConditional.find(item=>item.title==='北九水');
if(!north?.condition.includes('山洪')||!north?.condition.includes('雷电'))fail('Beijiushui safety gate missing');
const beaches=data.rainConditional.find(item=>item.title.includes('海水浴场'));
if(!beaches?.condition.includes('明确开放')||!beaches?.detail.includes('绝不下海'))fail('beach safety override missing');
for(const token of ['雨天避坑 / 备用方案','BEACH STATUS','未找到当天发布的9处浴场临时封闭公告','TravelRainGuide'])if(!ui.includes(token))fail(`rain UI missing ${token}`);
for(const token of ['rain-hero','beach-status-table','pitfall-card'])if(!css.includes(token))fail(`rain CSS missing ${token}`);
console.log(`Rain guide OK: ${data.newNotes.length} new notes, ${data.rainRecommended.length} indoor backups, ${data.beaches.length} beaches, checked ${data.checkedAt}`);
