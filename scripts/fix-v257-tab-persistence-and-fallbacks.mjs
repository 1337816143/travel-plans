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
      `  if (!DATA) return;\n\n  function installPersistentV257Data(){\n    if(typeof SCHEDULES!=='undefined'&&Array.isArray(SCHEDULES)){\n      for(const [date,items] of Object.entries(DATA.itineraryAdditions||{})){\n        const day=SCHEDULES.find(item=>item.date===date);if(!day||!Array.isArray(day.items))continue;const text=items.join('；');if(!day.items.some(row=>Array.isArray(row)&&String(row[0]).includes('打卡支线')))day.items.push(['📷 打卡支线',text]);\n      }\n    }\n    const wishlist=typeof GIRLFRIEND_WISHLIST!=='undefined'?GIRLFRIEND_WISHLIST:window.GIRLFRIEND_WISHLIST;\n    if(wishlist&&Array.isArray(wishlist.food)){const rows=[...(DATA.food?.mustEatDrink||[]).map(item=>({...item,kind:'新增必吃/必喝'})),...(DATA.food?.bbqReference||[]).map(item=>({...item,kind:'烤肉参考'})),...(DATA.food?.deliveryOrTry||[]).map(item=>({...item,kind:item.kind||'外卖/可尝'}))];for(const [index,item] of rows.entries()){if(wishlist.food.some(existing=>existing.name===item.name))continue;wishlist.food.push({id:'food-v257-'+index,name:item.name,original:item.name,category:item.kind||'必吃',target:item.kind||'必吃/必喝候选',status:item.status||'user-added-reference',address:item.address||'按当天位置高德确认',mapUrl:'https://ditu.amap.com/search?query='+encodeURIComponent((item.amapQuery||item.name)+' 青岛'),note:item.note||item.reason||item.status||'v2.5.7新增参考项',girlfriendMust:true})}window.GIRLFRIEND_WISHLIST=wishlist}\n  }\n  installPersistentV257Data();\n`,
    );
  }

  // v2.5.6 moves .planb into the normal-plan pager. Insert beside the real parent, not day-body.
  source = source.replace(
    'body.insertBefore(box, planB || null);',
    "if (planB?.parentNode) planB.parentNode.insertBefore(box, planB); else body.appendChild(box);",
  );

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

update('tests-v3/v257-checkin-food-seaview.spec.js', (source) =>
  source.replace(
    "sign: window.TravelCheckinSpots.data.locations.find((item) => item.id === 'huangdao-sign'),",
    "sign: window.__QINGDAO_CHECKIN_V257__.locations.find((item) => item.id === 'huangdao-sign'),",
  ),
);

console.log('Applied canonical persistence and fixed nested Plan-B insertion crash.');
