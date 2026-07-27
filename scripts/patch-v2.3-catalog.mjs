import fs from 'node:fs';
const file='src-v2/data/generated/catalog.js';
let text=fs.readFileSync(file,'utf8');
text=text.replace(/version:'[^']+'/,"version:'2.3.0'");
fs.writeFileSync(file,text);
