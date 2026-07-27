import fs from 'node:fs';
import path from 'node:path';

const files=[
  path.resolve('index.html'),
  path.resolve('versions','2026-07-27-v1.0.14.html')
];
for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  const before='if(!/^s*(?:<!doctype html|<html)/i.test(page))';
  const after='if(!/^[\\t\\r\\n ]*(?:<!doctype html|<html)/i.test(page))';
  if(!html.includes(before))throw new Error(`${path.basename(file)}: loader whitespace check target missing`);
  html=html.replace(before,after);
  fs.writeFileSync(file,html);
  if(html.includes(before)||!html.includes(after))throw new Error(`${path.basename(file)}: loader whitespace check was not finalized`);
}
console.log('Finalized v1.0.14 loader whitespace validation');
