import fs from 'node:fs';

function update(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
  else console.log(`No additional change needed for ${file}`);
}

update('src-v2.5.7/checkin-food-seaview.js', (source) => {
  if (!source.includes('function installPersistentV257Data()')) {
    source = source.replace(
      "  if (!DATA) return;\n",
      `  if (!DATA) return;\n\n  function installPersistentV257Data(){\n    if(typeof SCHEDULES!=='undefined'&&Array.isArray(SCHEDULES)){\n      for(const [date,items] of Object.entries(DATA.itineraryAdditions||{})){\n        const day=SCHEDULES.find(item=>item.date===date);\n        if(!day||!Array.isArray(day.items))continue;\n        const text=items.join('；');\n        if(!day.items.some(row=>Array.isArray(row)&&String(row[0]).includes('打卡支线')))day.items.push(['📷 打卡支线',text]);\n      }\n    }\n    const wishlist=typeof GIRLFRIEND_WISHLIST!=='undefined'?GIRLFRIEND_WISHLIST:window.GIRLFRIEND_WISHLIST;\n    if(wishlist&&Array.isArray(wishlist.food)){\n      const rows=[\n        ...(DATA.food?.mustEatDrink||[]).map(item=>({...item,kind:'新增必吃/必喝'})),\n        ...(DATA.food?.bbqReference||[]).map(item=>({...item,kind:'烤肉参考'})),\n        ...(DATA.food?.deliveryOrTry||[]).map(item=>({...item,kind:item.kind||'外卖/可尝'}))\n      ];\n      for(const [index,item] of rows.entries()){\n        if(wishlist.food.some(existing=>existing.name===item.name))continue;\n        wishlist.food.push({id:'food-v257-'+index,name:item.name,original:item.name,category:item.kind||'必吃',target:item.kind||'必吃/必喝候选',status:item.status||'user-added-reference',address:item.address||'按当天位置高德确认',mapUrl:'https://ditu.amap.com/search?query='+encodeURIComponent((item.amapQuery||item.name)+' 青岛'),note:item.note||item.reason||item.status||'v2.5.7新增参考项',girlfriendMust:true});\n      }\n      window.GIRLFRIEND_WISHLIST=wishlist;\n    }\n  }\n  installPersistentV257Data();\n`,
    );
  }

  if (!source.includes('function itineraryFallbackLocations()')) {
    source = source.replace(
      "  function allLocations(){return [...(DATA.locations||[]),...extraPopular]}",
      `  let fallbackLocationCache=null;\n  function itineraryFallbackLocations(){\n    if(fallbackLocationCache)return fallbackLocationCache;\n    if(typeof POINTS==='undefined'){fallbackLocationCache=[];return fallbackLocationCache}\n    const explicit=[...(DATA.locations||[]),...extraPopular],covered=new Set();\n    for(const location of explicit){if(location.basePointId)covered.add(location.basePointId);if(location.id?.endsWith('-checkin'))covered.add(location.id.slice(0,-8))}\n    const routeIds=new Set(typeof SCHEDULES==='undefined'?[]:SCHEDULES.flatMap(day=>day.route||[]));\n    const ignored=new Set(['住宿区域','酒店','服务','交通节点','行程节点']);\n    fallbackLocationCache=POINTS.filter(point=>point&&!ignored.has(point.category)&&(routeIds.has(point.id)||point.category==='备选')&&!covered.has(point.id)).map(point=>({id:'auto-'+point.id,name:point.name,day:Array.isArray(point.days)?point.days[0]:undefined,basePointId:point.id,amapQuery:point.name+' 青岛',precision:'沿用已核验行程地点锚点；暂无独立精确机位，现场按人流和围栏微调',autoFallback:true,cameras:[{name:'主地标／入口全景',direction:'以主地标或入口为背景，人物站在人行区域',light:'顺光、阴天柔光或傍晚',detail:'使用行程中已核验地点坐标作为地点锚点，不伪造独立站位；优先拍完整地标与环境关系。'},{name:'环境纵深／人物机位',direction:'沿主要步道、街景、建筑或海岸线形成纵深',light:'上午或日落前',detail:'用道路、栏杆、建筑边线或海岸线作引导线；具体站位根据现场开放边界微调。'}]}));return fallbackLocationCache}\n  function allLocations(){return [...(DATA.locations||[]),...extraPopular,...itineraryFallbackLocations()]}`,
    );
  }

  if (!source.includes('v257ReconcileTimer')) {
    source = source.replace(
      "observer.observe(document.body, { childList: true, subtree: true });",
      "observer.observe(document.body, { childList: true, subtree: true });\n    const v257ReconcileTimer = window.setInterval(() => { decorateDays(); decorateFood(); decorateLeisure(); }, 400);\n    window.addEventListener('pagehide', () => window.clearInterval(v257ReconcileTimer), { once: true });",
    );
  }

  source = source.replace(
    /if \(dedicatedCheckinEntry\) \{[\s\S]*?\n    \}/,
    "if (dedicatedCheckinEntry) { setTimeout(openPanel, 180); }",
  );
  return source;
});

update('apps/web/checkin.html', (source) => {
  if (!source.includes("child.matchMedia?.('(max-width:800px)').matches")) {
    source = source.replace(
      "            if (!tab || !panel) return false;\n",
      "            if (!tab || !panel) return false;\n            const shell = doc.getElementById('panel') || doc.querySelector('.panel');\n            if (child.matchMedia?.('(max-width:800px)').matches) shell?.classList.add('open');\n",
    );
  }
  source = source.replace(
    "if ((active && Date.now() - startedAt > 1200) || Date.now() - startedAt > 12000)",
    "if ((active && Date.now() - startedAt > 700) || Date.now() - startedAt > 6000)",
  );
  return source;
});

update('tests-v3/v257-checkin-food-seaview.spec.js', (source) => {
  source = source.replace(
    "sign: window.TravelCheckinSpots.data.locations.find((item) => item.id === 'huangdao-sign'),",
    "sign: window.__QINGDAO_CHECKIN_V257__.locations.find((item) => item.id === 'huangdao-sign'),",
  );
  return source;
});

console.log('Applied canonical itinerary/food persistence, stable check-in lifecycle, and camera fallbacks.');
