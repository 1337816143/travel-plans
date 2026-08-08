import fs from 'node:fs';

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`No runtime fix applied to ${file}`);
  fs.writeFileSync(file, next);
}

patch('scripts/build-v2.5.6-current.mjs', (source) => {
  const oldHistory = "versionIndex = versionIndex.replace(new RegExp(`<div class=\"card(?: current)?\"><b><a href=\"${DATE}-v${VERSION}\\\\.html\">[\\\\s\\\\S]*?<\\\\/div>`, 'g'), '');";
  const fixedHistory = "versionIndex = versionIndex.replace(new RegExp(`<div class=\\\"card(?: current)?\\\"><b><a href=\\\"${DATE}-v${VERSION}\\\\\\\\.html\\\">[\\\\\\\\s\\\\\\\\S]*?<\\\\\\\\/p><\\\\\\\\/div>`, 'g'), '');";
  const brokenActivate = "self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-plans-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));";
  const fixedActivate = "self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-plans-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));";
  if (!source.includes(oldHistory)) throw new Error('v2.5.6 history-card regex not found');
  if (!source.includes(brokenActivate)) throw new Error('v2.5.6 broken activate handler template not found');
  return source.replace(oldHistory, fixedHistory).replace(brokenActivate, fixedActivate);
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

patch('data/qingdao/ops/current-status-2026-08-09.json', (source) => {
  const oldNote = 'Official notice published 2026-07-07 states all tour areas including Erlongshan resumed opening on 2026-07-08. No newer closure notice was found in the official announcement results used for this snapshot. Same-day official alerts still override this snapshot.';
  const newNote = 'The latest reopening notice found in the official scenic-area announcement results was published 2026-07-14 and states all tour areas including Erlongshan resumed opening on 2026-07-15. Same-day weather warnings, ticket suspension, crowd control, or a newer official temporary closure still override this snapshot.';
  if (!source.includes(oldNote)) throw new Error('previous Laoshan status note not found');
  return source
    .replace(oldNote, newNote)
    .replace('https://www.qdlaoshan.cn/New-News-info-nid-6442.html', 'https://www.qdlaoshan.cn/New-News-info-nid-6466.html');
});

console.log('Applied v2.5.6 runtime hardening fixes.');
