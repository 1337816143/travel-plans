import fs from 'node:fs';

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`No runtime fix applied to ${file}`);
  fs.writeFileSync(file, next);
}

patch('scripts/build-v2.5.6-current.mjs', (source) => {
  const old = "versionIndex = versionIndex.replace(new RegExp(`<div class=\"card(?: current)?\"><b><a href=\"${DATE}-v${VERSION}\\\\.html\">[\\\\s\\\\S]*?<\\\\/div>`, 'g'), '');";
  const replacement = "versionIndex = versionIndex.replace(new RegExp(`<div class=\\\"card(?: current)?\\\"><b><a href=\\\"${DATE}-v${VERSION}\\\\\\\\.html\\\">[\\\\\\\\s\\\\\\\\S]*?<\\\\\\\\/p><\\\\\\\\/div>`, 'g'), '');";
  if (!source.includes(old)) throw new Error('v2.5.6 history-card regex not found');
  return source.replace(old, replacement);
});

patch('src-v2.5.6/mobile-real-routes.js', (source) => {
  const anchor = "  function drawActualDay(date,segments){";
  if (!source.includes(anchor)) throw new Error('actual route draw function not found');
  const helper = `  function clearSelectedSchematic(){\n    if(!selectedDay)return;\n    if(mapEngine==='amap'&&amapInstance){try{if(amapOverlays?.length){amapInstance.remove(amapOverlays);amapOverlays=[]}}catch{}}\n    else if(routeLayer){try{routeLayer.clearLayers()}catch{}}\n  }\n`;
  source = source.replace(anchor, helper + anchor);
  const oldPatch = "const result=original(date,...rest);setTimeout(()=>{fitVisibleDayPoints(date);void ensureDay(date);void renderHourlyWeather(false)},120);return result";
  const newPatch = "const result=original(date,...rest);clearSelectedSchematic();showMapNotice('正在加载高德实际道路路线…');setTimeout(()=>{fitVisibleDayPoints(date);void ensureDay(date);void renderHourlyWeather(false)},120);return result";
  if (!source.includes(oldPatch)) throw new Error('day-selection route patch not found');
  return source.replace(oldPatch, newPatch);
});

console.log('Applied v2.5.6 runtime hardening fixes.');
