import fs from 'node:fs';
const file='scripts/build-v2.mjs';
let text=fs.readFileSync(file,'utf8');
const old="  read('src-v2','map','map-adapters.js'),";
const replacement="  read('src-v2','map','leaflet-adapter.js'),\n  read('src-v2','map','amap-adapter.js'),\n  read('src-v2','map','map-adapters.js'),";
if(!text.includes("read('src-v2','map','leaflet-adapter.js')")){if(!text.includes(old))throw new Error('Map adapter build slot was not found');text=text.replace(old,replacement)}
fs.writeFileSync(file,text);
console.log('Patched build order for separate Leaflet and AMap adapters');
