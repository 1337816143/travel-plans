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
  await expect(page.locator('.eyebrow')).toContainText('v2.1.0');
  await page.evaluate(()=>window.TravelAmapStartup?.hide());
  await page.waitForTimeout(260);
}

async function showDayRoute(page){
  await page.evaluate(()=>{
    const day=SCHEDULES.find(item=>item.date==='08-10');
    setDayRouteCard(day);
    window.TravelLayoutV201?.layoutFloatingUi();
    window.TravelRouteDrawer?.moveForViewport();
  });
  await expect(page.locator('#dayRouteCard')).toHaveClass(/show/);
}

function overlapArea(a,b){
  return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
}

function isDesktop(name){return name.startsWith('desktop')}

test('desktop route card is complete without scrolling and floating controls do not collide',async({page},testInfo)=>{
  test.skip(!isDesktop(testInfo.project.name),'Desktop-only layout test');
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await openPreview(page);await showDayRoute(page);
  const geometry=await page.evaluate(()=>{
    const card=document.getElementById('dayRouteCard'),sequence=card.querySelector('.day-route-seq');
    const buttons=[...card.querySelectorAll('[data-route-point]')].map(node=>node.getBoundingClientRect().toJSON());
    return{
      width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
      card:card.getBoundingClientRect().toJSON(),controls:document.querySelector('.basemap-control').getBoundingClientRect().toJSON(),
      cardScrollHeight:card.scrollHeight,cardClientHeight:card.clientHeight,
      sequenceScrollWidth:sequence?.scrollWidth||0,sequenceClientWidth:sequence?.clientWidth||0,
      buttons,badge:Boolean(document.getElementById('mapEngineBadge'))
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);
  expect(overlapArea(geometry.card,geometry.controls)).toBe(0);
  expect(geometry.cardScrollHeight).toBeLessThanOrEqual(geometry.cardClientHeight+1);
  expect(geometry.sequenceScrollWidth).toBeLessThanOrEqual(geometry.sequenceClientWidth+1);
  expect(geometry.badge).toBe(false);
  for(const button of geometry.buttons){
    expect(button.left).toBeGreaterThanOrEqual(geometry.card.left-1);
    expect(button.right).toBeLessThanOrEqual(geometry.card.right+1);
    expect(button.bottom).toBeLessThanOrEqual(geometry.card.bottom+1);
  }

  const state=await page.evaluate(async()=>{
    mapEngine='amap';amapTrafficVisible=true;
    let switchCalls=0,visibilityCalls=0,detailCalls=0,restored=null;
    amapInstance={getCenter:()=>({lng:120.321,lat:36.071}),getZoom:()=>14,setZoomAndCenter:(zoom,center)=>{restored={zoom,center}},resize:()=>{}};
    switchToAmap=()=>{switchCalls++;return Promise.resolve(amapInstance)};
    amapSetTrafficVisible=enabled=>{visibilityCalls++;amapTrafficVisible=enabled};
    amapTrafficAtCenter=()=>{detailCalls++;return Promise.resolve()};
    amapSetStatus=()=>{};
    await toggleAmapTraffic();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return{switchCalls,visibilityCalls,detailCalls,restored};
  });
  expect(state).toEqual({switchCalls:0,visibilityCalls:1,detailCalls:0,restored:{zoom:14,center:[120.321,36.071]}});
  expect(pageErrors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`${testInfo.project.name}.png`),fullPage:false});
});

test('flagship mobile portrait and landscape use one bottom drawer without viewport obstruction',async({page},testInfo)=>{
  test.skip(isDesktop(testInfo.project.name),'Mobile device-profile test');
  await openPreview(page);await showDayRoute(page);
  await expect(page.locator('html')).toHaveClass(/mobile-layout/);
  await expect(page.locator('#mobileRouteDrawer')).toHaveAttribute('data-state','half');
  await expect(page.locator('#mobileRouteDrawer')).toHaveAttribute('data-mode','day');

  let geometry=await page.evaluate(()=>{
    const drawer=document.getElementById('mobileRouteDrawer'),card=document.getElementById('dayRouteCard'),menu=document.getElementById('menuBtn'),base=document.querySelector('.basemap-control');
    const r=drawer.getBoundingClientRect(),m=menu.getBoundingClientRect(),b=base.getBoundingClientRect();
    return{drawer:r.toJSON(),menu:m.toJSON(),base:b.toJSON(),height:innerHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cardParent:card.parentElement?.className,bottomGap:innerHeight-r.bottom,badge:Boolean(document.getElementById('mapEngineBadge')),preferred:window.TravelLayoutV201?.preferredAtStartup};
  });
  expect(geometry.preferred).toBe('amap');
  expect(geometry.cardParent).toContain('mobile-drawer-content');
  expect(geometry.drawer.left).toBeGreaterThanOrEqual(0);expect(geometry.drawer.right).toBeLessThanOrEqual(geometry.width+1);
  expect(geometry.drawer.bottom).toBeLessThanOrEqual(geometry.height+1);expect(geometry.bottomGap).toBeGreaterThanOrEqual(42);
  expect(overlapArea(geometry.menu,geometry.base)).toBe(0);expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);expect(geometry.badge).toBe(false);

  await page.locator('[data-drawer-state="full"]').click();
  await expect(page.locator('#mobileRouteDrawer')).toHaveAttribute('data-state','full');
  const full=await page.evaluate(()=>{
    const drawer=document.getElementById('mobileRouteDrawer'),card=document.getElementById('dayRouteCard'),content=drawer.querySelector('.mobile-drawer-content');
    const r=drawer.getBoundingClientRect();return{drawer:r.toJSON(),contentScrollHeight:content.scrollHeight,contentClientHeight:content.clientHeight,buttons:[...card.querySelectorAll('[data-route-point]')].map(node=>node.getBoundingClientRect().toJSON())};
  });
  expect(full.drawer.top).toBeGreaterThanOrEqual(-1);expect(full.drawer.bottom).toBeLessThanOrEqual(geometry.height+1);
  for(const button of full.buttons){expect(button.left).toBeGreaterThanOrEqual(full.drawer.left-1);expect(button.right).toBeLessThanOrEqual(full.drawer.right+1)}

  await page.locator('[data-drawer-action="overview"]').click();
  await expect(page.locator('#mobileRouteDrawer')).toHaveAttribute('data-mode','overview');
  await page.locator('[data-drawer-state="collapsed"]').click();
  await expect(page.locator('#mobileRouteDrawer')).toHaveAttribute('data-state','collapsed');
  const collapsed=await page.locator('#mobileRouteDrawer').boundingBox();
  expect(collapsed.height).toBeLessThanOrEqual(62);expect(geometry.height-collapsed.y-collapsed.height).toBeGreaterThanOrEqual(42);

  await page.evaluate(()=>window.TravelVersionUpdate?.show());
  await expect(page.locator('#versionUpdateBanner')).toBeVisible();
  await page.locator('#versionUpdateDismiss').click();await expect(page.locator('#versionUpdateBanner')).toBeHidden();

  await page.locator('#menuBtn').click();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('panel').getBoundingClientRect().left)).toBeGreaterThanOrEqual(-1);
  await expect(page.locator('#mobileRouteDrawer')).toBeHidden();
  await page.locator('#panelEdgeToggle').click();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('panel').getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  await page.screenshot({path:testInfo.outputPath(`${testInfo.project.name}.png`),fullPage:false});
});