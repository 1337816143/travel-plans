import {test,expect} from '@playwright/test';

async function openPreview(page){
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'||url.hostname==='localhost')route.continue();
    else route.abort();
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#panel')).toBeAttached();
  await expect(page).toHaveTitle('青岛旅行计划');
  await expect(page.locator('.eyebrow')).toContainText('v2.0.1');
}

async function showDayRoute(page){
  await page.evaluate(()=>{
    const day=SCHEDULES.find(item=>item.date==='08-10');
    setDayRouteCard(day);
    window.TravelLayoutV201?.layoutFloatingUi();
  });
  await expect(page.locator('#dayRouteCard')).toHaveClass(/show/);
}

function overlapArea(a,b){
  return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
}

test('desktop floating controls do not collide and traffic toggle preserves view',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Desktop-only visual and map-state test');
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await openPreview(page);
  await showDayRoute(page);
  await expect(page.locator('#panelEdgeToggle')).toBeVisible();
  const dimensions=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    width:innerWidth,
    panel:document.getElementById('panel').getBoundingClientRect().toJSON(),
    toggle:document.getElementById('panelEdgeToggle').getBoundingClientRect().toJSON(),
    card:document.getElementById('dayRouteCard').getBoundingClientRect().toJSON(),
    controls:document.querySelector('.basemap-control').getBoundingClientRect().toJSON(),
    cardScrollWidth:document.getElementById('dayRouteCard').scrollWidth,
    cardClientWidth:document.getElementById('dayRouteCard').clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width+1);
  expect(Math.abs(dimensions.toggle.left-dimensions.panel.right)).toBeLessThanOrEqual(3);
  expect(overlapArea(dimensions.card,dimensions.controls)).toBe(0);
  expect(dimensions.cardScrollWidth).toBeLessThanOrEqual(dimensions.cardClientWidth+1);

  const state=await page.evaluate(async()=>{
    mapEngine='amap';amapTrafficVisible=true;
    let switchCalls=0,visibilityCalls=0,detailCalls=0,restored=null;
    amapInstance={getCenter:()=>({lng:120.321,lat:36.071}),getZoom:()=>14,setZoomAndCenter:(zoom,center)=>{restored={zoom,center}},resize:()=>{}};
    switchToAmap=()=>{switchCalls++;return Promise.resolve(amapInstance)};
    amapSetTrafficVisible=enabled=>{visibilityCalls++;amapTrafficVisible=enabled};
    amapTrafficAtCenter=()=>{detailCalls++;return Promise.resolve()};
    amapSetStatus=()=>{};
    await toggleAmapTraffic();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return{switchCalls,visibilityCalls,detailCalls,restored};
  });
  expect(state).toEqual({switchCalls:0,visibilityCalls:1,detailCalls:0,restored:{zoom:14,center:[120.321,36.071]}});
  expect(pageErrors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('desktop-v2.0.1.png'),fullPage:false});
});

test('mobile defaults to AMap preference and route card remains fully usable',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('mobile'),'Mobile-only viewport test');
  await openPreview(page);
  await showDayRoute(page);
  const geometry=await page.evaluate(()=>{
    const menu=document.getElementById('menuBtn').getBoundingClientRect();
    const base=document.querySelector('.basemap-control').getBoundingClientRect();
    const card=document.getElementById('dayRouteCard');
    const cardRect=card.getBoundingClientRect();
    const legend=document.getElementById('legend').getBoundingClientRect();
    const buttons=[...card.querySelectorAll('[data-route-point]')].map(node=>node.getBoundingClientRect().toJSON());
    return{
      preferred:window.TravelLayoutV201?.preferredAtStartup,
      menu:menu.toJSON(),base:base.toJSON(),card:cardRect.toJSON(),legend:legend.toJSON(),buttons,
      cardScrollLeft:card.scrollLeft,cardScrollWidth:card.scrollWidth,cardClientWidth:card.clientWidth,
      legendCollapsed:document.getElementById('legend').classList.contains('collapsed'),
      height:innerHeight,scrollWidth:document.documentElement.scrollWidth,width:innerWidth
    };
  });
  expect(geometry.preferred).toBe('amap');
  expect(overlapArea(geometry.menu,geometry.base)).toBe(0);
  expect(overlapArea(geometry.card,geometry.menu)).toBe(0);
  expect(overlapArea(geometry.card,geometry.base)).toBe(0);
  expect(geometry.card.left).toBeGreaterThanOrEqual(0);
  expect(geometry.card.right).toBeLessThanOrEqual(geometry.width+1);
  expect(geometry.card.top).toBeGreaterThanOrEqual(Math.max(geometry.menu.bottom,geometry.base.bottom));
  expect(geometry.card.bottom).toBeLessThanOrEqual(geometry.height+1);
  expect(geometry.cardScrollLeft).toBe(0);
  expect(geometry.cardScrollWidth).toBeLessThanOrEqual(geometry.cardClientWidth+1);
  expect(geometry.legendCollapsed).toBe(true);
  for(const button of geometry.buttons){
    expect(button.left).toBeGreaterThanOrEqual(geometry.card.left-1);
    expect(button.right).toBeLessThanOrEqual(geometry.card.right+1);
  }
  expect(geometry.legend.bottom).toBeLessThanOrEqual(geometry.height+1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);

  await page.locator('#menuBtn').click();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('panel').getBoundingClientRect().left)).toBeGreaterThanOrEqual(-1);
  await expect(page.locator('#dayRouteCard')).toBeHidden();
  await page.locator('#panelEdgeToggle').click();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('panel').getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  await page.screenshot({path:testInfo.outputPath('mobile-v2.0.1.png'),fullPage:false});
});
