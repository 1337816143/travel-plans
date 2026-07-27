import fs from 'node:fs';
const file='scripts/build-v2.mjs';
let text=fs.readFileSync(file,'utf8');
const old="  read('src-v2','map','map-adapters.js'),";
const replacement="  read('src-v2','map','leaflet-adapter.js'),\n  read('src-v2','map','amap-adapter.js'),\n  read('src-v2','map','map-adapters.js'),";
if(!text.includes("read('src-v2','map','leaflet-adapter.js')")){if(!text.includes(old))throw new Error('Map adapter build slot was not found');text=text.replace(old,replacement)}
if(!text.includes("await import('./patch-v2.2-source.mjs')"))text=text.replace("await import('./migrate-v2.2.mjs');","await import('./migrate-v2.2.mjs');\nawait import('./patch-v2.2-source.mjs');");
fs.writeFileSync(file,text);
console.log('Patched v2.2 build lifecycle and separate engine adapter order');
