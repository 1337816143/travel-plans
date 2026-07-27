import fs from 'node:fs';
const file='src-v2/app/legacy-app.js';
const text=fs.readFileSync(file,'utf8');
const constants=[...text.matchAll(/(?:^|\n)const\s+([A-Za-z_$][\w$]*)\s*=\s*/g)].map(match=>({name:match[1],index:match.index+(match[0].startsWith('\n')?1:0)}));
console.log('CONSTANTS',constants.map(item=>item.name).join(','));
for(let i=0;i<constants.length;i++){
  const item=constants[i],end=constants[i+1]?.index??text.length;
  const body=text.slice(item.index,end);
  const first=body.slice(body.indexOf('=')+1).trimStart();
  let kind='expression';
  if(first.startsWith('['))kind='array';else if(first.startsWith('{'))kind='object';else if(first.startsWith("'" )||first.startsWith('"'))kind='string';
  console.log(`CONST ${item.name} kind=${kind} bytes=${Buffer.byteLength(body)}`);
}
const functions=[...text.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
console.log('FUNCTION_COUNT',functions.length);
console.log('MAP_FUNCTIONS',functions.filter(name=>/map|marker|route|layer|view|leaflet|amap|fit|cluster/i.test(name)).join(','));
for(const token of ['POINTS','SCHEDULES','HOTELS','BOOK','SOURCES','SOURCE','RECOMMEND']){
  console.log('TOKEN',token,'count',text.split(token).length-1);
}
