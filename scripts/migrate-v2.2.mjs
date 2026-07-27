import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const LEGACY=path.join(ROOT,'src-v2','app','legacy-app.js');
const DATA_DIR=path.join(ROOT,'src-v2','data','generated');
const VERSION='2.2.0';

function write(file,content){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content)}
function isIdStart(ch){return /[A-Za-z_$]/.test(ch||'')}
function isId(ch){return /[\w$]/.test(ch||'')}
function topLevelConstDeclarations(text){
  const out=[];let quote='',escape=false,lineComment=false,blockComment=false,curly=0;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++}continue}
    if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote='';continue}
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
    if(ch==='{'){curly++;continue}if(ch==='}'){curly=Math.max(0,curly-1);continue}
    if(curly!==0||!text.startsWith('const',i))continue;
    const before=text[i-1],after=text[i+5];if(isId(before)||isId(after))continue;
    let p=i+5;while(/\s/.test(text[p]))p++;if(!isIdStart(text[p]))continue;
    const nameStart=p;while(isId(text[p]))p++;const name=text.slice(nameStart,p);while(/\s/.test(text[p]))p++;if(text[p]!=='=')continue;
    let q=p+1,innerQuote='',innerEscape=false,lc=false,bc=false,round=0,square=0,brace=0;
    for(;q<text.length;q++){
      const c=text[q],n=text[q+1];
      if(lc){if(c==='\n')lc=false;continue}if(bc){if(c==='*'&&n==='/'){bc=false;q++}continue}
      if(innerQuote){if(innerEscape){innerEscape=false;continue}if(c==='\\'){innerEscape=true;continue}if(c===innerQuote)innerQuote='';continue}
      if(c==='/'&&n==='/'){lc=true;q++;continue}if(c==='/'&&n==='*'){bc=true;q++;continue}
      if(c==='"'||c==="'"||c==='`'){innerQuote=c;continue}
      if(c==='(')round++;else if(c===')')round--;else if(c==='[')square++;else if(c===']')square--;else if(c==='{')brace++;else if(c==='}')brace--;
      else if(c===';'&&round===0&&square===0&&brace===0){q++;break}
    }
    out.push({name,start:i,end:q,text:text.slice(i,q)});i=q-1;
  }
  return out;
}
function groupFor(name){if(name==='POINTS')return'points';if(/SCHEDULE/i.test(name))return'schedules';if(/HOTEL/i.test(name))return'hotels';if(/BOOK|RESERV/i.test(name))return'bookings';if(/SOURCE/i.test(name))return'sources';if(/RECOMMEND/i.test(name))return'recommendations';return null}

let source=fs.readFileSync(LEGACY,'utf8');
const declarations=topLevelConstDeclarations(source);
const selected=declarations.filter(item=>groupFor(item.name));
if(!selected.some(item=>item.name==='POINTS')&&!fs.existsSync(path.join(DATA_DIR,'points.js')))throw new Error('POINTS declaration was not found');
if(!selected.some(item=>/SCHEDULE/i.test(item.name))&&!fs.existsSync(path.join(DATA_DIR,'schedules.js')))throw new Error('SCHEDULES declaration was not found');

if(selected.length){
  const groups=new Map();
  for(const item of selected){const group=groupFor(item.name);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(item)}
  for(const [group,items] of groups){write(path.join(DATA_DIR,`${group}.js`),`/* Generated from the v1.0.15 business baseline. Edit this canonical data module directly. */\n${items.map(item=>item.text).join('\n')}\n`)}
  for(const item of [...selected].sort((a,b)=>b.start-a.start))source=source.slice(0,item.start)+source.slice(item.end);
}

const pointFile=path.join(DATA_DIR,'points.js');
if(fs.existsSync(pointFile)){
  const points=fs.readFileSync(pointFile,'utf8');
  if(!/TRAVEL_HOTELS/.test(points)&&!fs.existsSync(path.join(DATA_DIR,'hotels.js')))write(path.join(DATA_DIR,'hotels.js'),`/* Derived hotel view; hotel POIs remain single-sourced in points.js. */\nconst TRAVEL_HOTELS=POINTS.filter(item=>item.category==='酒店');\n`);
}
for(const name of ['bookings','sources','recommendations']){const file=path.join(DATA_DIR,`${name}.js`);if(!fs.existsSync(file))write(file,`/* No standalone ${name} declaration existed in the baseline; related records remain referenced through TravelDataCatalog until the next content migration. */\n`)}

const dataFiles=fs.readdirSync(DATA_DIR).filter(name=>name.endsWith('.js')&&name!=='catalog.js').sort();
const names=[];for(const file of dataFiles){const text=fs.readFileSync(path.join(DATA_DIR,file),'utf8');for(const match of text.matchAll(/(?:^|\n)const\s+([A-Za-z_$][\w$]*)\s*=/g))names.push(match[1])}
write(path.join(DATA_DIR,'catalog.js'),`/* Generated binding catalog for diagnostics and reminder services. */\nwindow.TravelDataCatalog=Object.freeze({version:'${VERSION}',bindings:Object.freeze({${names.map(name=>`${name}:typeof ${name}!=='undefined'?${name}:null`).join(',')}})});\n`);

if(source.includes('autoFitView:true'))source=source.replaceAll('autoFitView:true',"autoFitView:document.getElementById('amapAutoFitRoute')?.checked!==false");
source=source.replace(/^\s+/,match=>match.includes('\n')?'\n':'');
fs.writeFileSync(LEGACY,source);

const report={version:VERSION,extracted:selected.map(item=>({name:item.name,group:groupFor(item.name),bytes:Buffer.byteLength(item.text)})),dataFiles:[...dataFiles,'catalog.js'],legacyBytes:Buffer.byteLength(source)};
write(path.join(ROOT,'MIGRATION_V2.2.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
