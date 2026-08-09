import fs from 'node:fs';

const file='scripts/build-v2.5.7-current.mjs';
const source=fs.readFileSync(file,'utf8');
const lines=source.split('\n');
const inlineIndex=lines.findIndex(line=>line.includes('[...html.matchAll('));
if(inlineIndex<0)throw new Error('v2.5.7 inline-script matcher line not found');
lines.splice(inlineIndex,1,
  "const inlineScriptPattern=new RegExp('<script(?![^>]*\\\\bsrc=)[^>]*>([\\\\s\\\\S]*?)<\\\\/script>','gi');",
  "[...html.matchAll(inlineScriptPattern)].forEach((match,index)=>new vm.Script(match[1],{filename:`v257-inline-${index}.js`}));"
);
const historyIndex=lines.findIndex(line=>line.includes("versionIndex=versionIndex.replace(/(<body><h1>"));
if(historyIndex<0)throw new Error('v2.5.7 history insertion regex line not found');
lines[historyIndex]="versionIndex=versionIndex.replace('<body><h1>青岛旅行地图历史版本</h1>','<body><h1>青岛旅行地图历史版本</h1>'+card);write('versions/index.html',versionIndex);";
fs.writeFileSync(file,lines.join('\n'));
console.log('Repaired v2.5.7 inline-script parser and history insertion.');
