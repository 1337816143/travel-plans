import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const file = path.join(ROOT, 'service-worker.js');
const broken = "self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-plans-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));";
const fixed = "self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-plans-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));";

if (!fs.existsSync(file)) throw new Error('service-worker.js was not generated.');
let source = fs.readFileSync(file, 'utf8');
if (source.includes(broken)) {
  source = source.replace(broken, fixed);
  fs.writeFileSync(file, source);
}
if (!source.includes(fixed)) throw new Error('Expected v2.5.5 activate handler was not found.');
new vm.Script(source, { filename: 'service-worker.js' });

const historyFile = path.join(ROOT, 'versions', 'index.html');
if (fs.existsSync(historyFile)) {
  const card = '<div class="card current"><b><a href="2026-08-08-v2.5.5.html">v2.5.5 雨天备用与浴场状态版</a></b><div class="tag">当前线上版本</div><p>完整继承冻结 v2.5.4，并新增雨天避坑/推荐专栏、9处海水浴场开放时段与实时核验入口，以及小麦岛日落、沙子口、云上海天等新增候选。</p></div>';
  let history = fs.readFileSync(historyFile, 'utf8');
  history = history.replace(
    /<div class="card(?: current)?"><b><a href="2026-08-08-v2\.5\.5\.html">.*?<\/p><\/div>/g,
    '',
  );
  history = history.replaceAll('class="card current"', 'class="card"');
  history = history.replace(
    /(<a href="2026-07-31-v2\.5\.4\.html">[^<]+<\/a><\/b><div class="tag">)[^<]*(<\/div>)/,
    '$1冻结回退版本$2',
  );
  history = history.replace(
    /(<body><h1>青岛旅行地图历史版本<\/h1>)/,
    `$1${card}`,
  );
  fs.writeFileSync(historyFile, history);
}

console.log('v2.5.5 service worker syntax and history index passed.');
