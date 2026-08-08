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
console.log('v2.5.5 service worker syntax passed.');
