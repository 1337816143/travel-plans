import fs from 'node:fs';
const file='src-v2/app/legacy-app.js';
const text=fs.readFileSync(file,'utf8');
function extractFunctions(source){
  const out=[];const re=/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g;let match;
  while((match=re.exec(source))){
    const name=match[1],start=match.index+(match[0].startsWith('\n')?1:0),brace=source.indexOf('{',re.lastIndex);if(brace<0)continue;
    let depth=0,quote='',escape=false,end=-1;
    for(let i=brace;i<source.length;i++){
      const ch=source[i];
      if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote='';continue}
      if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
      if(ch==='{')depth++;else if(ch==='}'&&--depth===0){end=i+1;break}
    }
    if(end>start)out.push({name,start,end,bytes:Buffer.byteLength(source.slice(start,end))});
  }
  return out;
}
const groups={
  booking:/booking|progress|channel|platform/i,
  itinerary:/day|schedule|timeline|legend|preset|recommend|source/i,
  search:/search|destination|focusPoint|focusRecommendation/i,
  hotel:/hotel/i,
  marker:/marker|popup|visiblePoints|pointIcon|shortName|routeOrder|bearing|direction|travelMarker/i,
  route:/drawRoutes|fitPoints|filterDay|showAll|clearRoutes|routePoints/i,
  weather:/weather|tripWeather/i,
  traffic:/traffic/i,
  amapSearch:/amap.*(?:search|nearby|locate|reverse|route|place|suggest|context|static|input|poi)/i
};
const functions=extractFunctions(text);
console.log('FUNCTION_COUNT='+functions.length);
for(const fn of functions){const hits=Object.entries(groups).filter(([,rx])=>rx.test(fn.name)).map(([name])=>name);console.log(`${String(fn.bytes).padStart(6)} ${fn.name} ${hits.join(',')}`)}
console.log('LEGACY_BYTES='+Buffer.byteLength(text));
