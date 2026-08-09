import fs from 'node:fs';

function update(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
  else console.log(`No additional change needed for ${file}`);
}

update('src-v2.5.7/checkin-food-seaview.js', (source) => {
  if (!source.includes('function itineraryFallbackLocations()')) {
    source = source.replace(
      "  function allLocations(){return [...(DATA.locations||[]),...extraPopular]}",
      `  let fallbackLocationCache=null;\n  function itineraryFallbackLocations(){\n    if(fallbackLocationCache)return fallbackLocationCache;\n    if(typeof POINTS==='undefined'){fallbackLocationCache=[];return fallbackLocationCache}\n    const explicit=[...(DATA.locations||[]),...extraPopular],covered=new Set();\n    for(const location of explicit){if(location.basePointId)covered.add(location.basePointId);if(location.id?.endsWith('-checkin'))covered.add(location.id.slice(0,-8))}\n    const routeIds=new Set(typeof SCHEDULES==='undefined'?[]:SCHEDULES.flatMap(day=>day.route||[]));\n    const ignored=new Set(['住宿区域','酒店','服务','交通节点','行程节点']);\n    fallbackLocationCache=POINTS.filter(point=>point&&!ignored.has(point.category)&&(routeIds.has(point.id)||point.category==='备选')&&!covered.has(point.id)).map(point=>({\n      id:'auto-'+point.id,name:point.name,day:Array.isArray(point.days)?point.days[0]:undefined,basePointId:point.id,amapQuery:point.name+' 青岛',precision:'沿用已核验行程地点锚点；暂无独立精确机位，现场按人流和围栏微调',autoFallback:true,cameras:[\n        {name:'主地标／入口全景',direction:'以主地标或入口为背景，人物站在人行区域',light:'顺光、阴天柔光或傍晚',detail:'使用行程中已核验地点坐标作为地点锚点，不伪造独立站位；优先拍完整地标与环境关系。'},\n        {name:'环境纵深／人物机位',direction:'沿主要步道、街景、建筑或海岸线形成纵深',light:'上午或日落前',detail:'用道路、栏杆、建筑边线或海岸线作引导线；具体站位根据现场开放边界微调。'}\n      ]\n    }));\n    return fallbackLocationCache\n  }\n  function allLocations(){return [...(DATA.locations||[]),...extraPopular,...itineraryFallbackLocations()]}`,
    );
  }

  const oldTab = "const tab=target.closest('.tab-btn');if(tab&&tab!==tabButton)clearMapLayer()";
  const newTab = "const tab=target.closest('.tab-btn');if(tab&&tab!==tabButton){clearMapLayer();[0,80,260,650].forEach(delay=>setTimeout(()=>{decorateDays();decorateFood();decorateLeisure()},delay))}";
  source = source.replace(oldTab, newTab);

  return source;
});

update('apps/web/checkin.html', (source) => {
  if (source.includes("child.matchMedia?.('(max-width:800px)').matches")) return source;
  return source.replace(
    "            if (!tab || !panel) return false;\n",
    "            if (!tab || !panel) return false;\n            const shell = doc.getElementById('panel') || doc.querySelector('.panel');\n            if (child.matchMedia?.('(max-width:800px)').matches) shell?.classList.add('open');\n",
  );
});

update('tests-v3/v257-checkin-food-seaview.spec.js', (source) => {
  if (!source.includes("auto-underwater")) {
    source = source.replace(
      "  await expect(qinyu.locator('.v257-camera')).toHaveCount(2);\n",
      "  await expect(qinyu.locator('.v257-camera')).toHaveCount(2);\n  for (const id of ['auto-underwater', 'auto-naval']) {\n    const fallback = panel.locator(`[data-v257-location-card=\"${id}\"]`);\n    await expect(fallback).toHaveCount(1);\n    await fallback.locator('details').evaluate((element) => { element.open = true; });\n    await expect(fallback.locator('.v257-camera')).toHaveCount(2);\n  }\n",
    );
  }
  return source;
});

console.log('Applied persistent tab decoration, mobile drawer opening, and automatic multi-camera fallbacks.');
