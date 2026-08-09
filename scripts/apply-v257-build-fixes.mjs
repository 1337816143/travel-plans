import fs from 'node:fs';

const file='scripts/build-v2.5.7-current.mjs';
const source=fs.readFileSync(file,'utf8');
const lines=source.split('\n');
const index=lines.findIndex(line=>line.includes('[...html.matchAll('));
if(index<0)throw new Error('v2.5.7 inline-script matcher line not found');
lines.splice(index,1,
  "const inlineScriptPattern=new RegExp('<script(?![^>]*\\\\bsrc=)[^>]*>([\\\\s\\\\S]*?)<\\\\/script>','gi');",
  "[...html.matchAll(inlineScriptPattern)].forEach((match,index)=>new vm.Script(match[1],{filename:`v257-inline-${index}.js`}));"
);
fs.writeFileSync(file,lines.join('\n'));
console.log('Repaired v2.5.7 inline-script parser.');
