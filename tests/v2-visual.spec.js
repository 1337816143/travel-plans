import {test,expect} from '@playwright/test';

async function openPreview(page){
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    if(url.hostname==='restapi.amap.com'){
      if(url.pathname.includes('/v3/direction/walking'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',route:{paths:[{distance:'1350',duration:'1080',steps:[{polyline:'120.320000,36.060000;120.321000,36.061000;120.322000,36.062000'}]}]}})});
      if(url.pathname.includes('/v3/direction/driving'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',route:{taxi_cost:'28',paths:[{distance:'5200',duration:'900',steps:[]}]}})});
      if(url.pathname.includes('/v3/direction/transit'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',route:{transits:[{distance:'4800',duration:'1500'}]}})});
      if(url.pathname.includes('/v3/weather/weatherInfo'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',forecasts:[{reporttime:'2026-08-09 08:00:00',casts:[{date:'2026-08-10',dayweather:'阵雨',nightweather:'多云',daytemp:'31',nighttemp:'25'}]}]})});
      if(url.pathname.includes('/v3/ip'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',province:'山东省',city:'青岛市',rectangle:'120.30,36.02;120.45,36.15'})});
      if(url.pathname.includes('/v3/place/text'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',pois:[{id:'test',name:'测试地点',location:'120.38,36.06'}]})});
      if(url.pathname.includes('/v3/traffic/status/circle'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',trafficinfo:{description:'总体畅通',roads:[]}})});
      if(url.pathname.includes('/v3/geocode/regeo'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',regeocode:{formatted_address:'青岛市测试地址',addressComponent:{adcode:'370200'}}})});
    }
    if(url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/elevation'){const count=(url.searchParams.get('latitude')||'').split(',').filter(Boolean).length;return route.fulfill({contentType:'application/json',body:JSON.stringify({elevation:Array.from({length:count},(_,i)=>20+(i%4)*12)})})}
    if(url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/forecast'){const time=[],apparent_temperature=[],precipitation_probability=[],weather_code=[];for(let hour=0;hour<24;hour++){time.push(`2026-08-10T${String(hour).padStart(2,'0')}:00`);apparent_temperature.push(hour>=10&&hour<=16?34:27);precipitation_probability.push(hour===14?65:15);weather_code.push(hour===14?61:1)}return route.fulfill({contentType:'application/json',body:JSON.stringify({hourly:{time,apparent_temperature,precipitation_probability,weather_code}})})}
    return route.abort();
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#panel')).toBeAttached();
  await expect(page).toHaveTitle('青岛旅行计划');
  await expect(page.locator('.eyebrow')).toContainText('v2.5.3');
  await page.evaluate(()=>window.TravelAmapStartup?.hide());
  await page.waitForTimeout(350);
  await expect(page.locator('#auditBox')).not.toContainText('页面初始化失败');
}
async function loadTools(page){await page.locator('[data-tab="tools"]').click();await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});await expect(page.locator('#tripToolsDashboard')).toBeVisible()}
function overlapArea(a,b){return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))}
function isDesktop(name){return name.startsWith('desktop')}

test('desktop v2.5.3 keeps tools organized and map markers synchronized',async({page},testInfo)=>{
  test.skip(!isDesktop(testInfo.project.name),'Desktop-only workflow test');
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await openPreview(page);
  await page.evaluate(()=>filterDay('08-10'));
  await expect(page.locator('#dayRouteCard')).toHaveClass(/show/);
  const geometry=await page.evaluate(()=>{TravelLayoutCoordinator.measure();const card=document.getElementById('dayRouteCard'),controls=document.querySelector('.basemap-control');return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,card:card.getBoundingClientRect().toJSON(),controls:controls.getBoundingClientRect().toJSON()}});
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);
  expect(overlapArea(geometry.card,geometry.controls)).toBe(0);
  await loadTools(page);
  await expect(page.locator('.trip-tool-section')).toHaveCount(5);
  await expect(page.locator('[data-tool-group="quick"]')).toHaveAttribute('open','');
  await expect(page.locator('[data-tool-group="wishlist"]')).toHaveAttribute('open','');
  await expect(page.locator('[data-tool-group="route"]')).not.toHaveAttribute('open','');
  await expect(page.locator('#girlfriendWishlistPanel')).toContainText('必吃必买已关联地图');
  await expect(page.locator('.wishlist-location-badge').first()).toBeVisible();
  await page.locator('[data-tool-group="records"] > summary').click();
  await expect(page.locator('#financePanel')).toBeVisible();
  await page.locator('[data-tool-group="system"] > summary').click();
  await expect(page.locator('#localDataPanel')).toBeVisible();
  const markers=await page.evaluate(()=>({eat:TravelRenderModel.markerHtml(pointById('wishmap-wanhechun')),buy:TravelRenderModel.markerHtml(pointById('wishmap-lizhizha')),leaflet:TravelMapAdapters.snapshot()}));
  expect(markers.eat).toContain('wishlist-map-marker eat');
  expect(markers.buy).toContain('wishlist-map-marker buy');
  expect(markers.leaflet.adapters).toEqual(expect.arrayContaining(['leaflet','amap']));
  const toolsGeometry=await page.evaluate(()=>{const panel=document.getElementById('panel'),dashboard=document.getElementById('tripToolsDashboard');return{panel:panel.getBoundingClientRect().toJSON(),dashboard:dashboard.getBoundingClientRect().toJSON(),scrollWidth:document.documentElement.scrollWidth,width:innerWidth}});
  expect(toolsGeometry.dashboard.left).toBeGreaterThanOrEqual(toolsGeometry.panel.left-1);
  expect(toolsGeometry.dashboard.right).toBeLessThanOrEqual(toolsGeometry.panel.right+1);
  expect(toolsGeometry.scrollWidth).toBeLessThanOrEqual(toolsGeometry.width+1);
  expect(pageErrors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`${testInfo.project.name}.png`),fullPage:false});
});

test('flagship mobile uses one open tool group and keeps wishlist usable',async({page},testInfo)=>{
  test.skip(isDesktop(testInfo.project.name),'Mobile device-profile test');
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await openPreview(page);
  await page.evaluate(()=>{const day=SCHEDULES.find(item=>item.date==='08-10');setDayRouteCard(day);TravelRouteDrawer.moveForViewport()});
  await expect(page.locator('html')).toHaveClass(/mobile-layout/);
  await page.locator('#menuBtn').click();
  await loadTools(page);
  await expect(page.locator('.trip-tool-section[open]')).toHaveCount(1);
  await expect(page.locator('[data-tool-group="quick"]')).toHaveAttribute('open','');
  await page.locator('[data-tool-group="wishlist"] > summary').click();
  await expect(page.locator('.trip-tool-section[open]')).toHaveCount(1);
  await expect(page.locator('[data-tool-group="wishlist"]')).toHaveAttribute('open','');
  await expect(page.locator('#girlfriendWishlistPanel')).toBeVisible();
  await page.locator('[data-wishlist-map-mode="all"]').click();
  await expect.poll(()=>page.evaluate(()=>TravelWishlistMap.mode())).toBe('all');
  await page.locator('[data-tool-group="route"] > summary').click();
  await expect(page.locator('.trip-tool-section[open]')).toHaveCount(1);
  await expect(page.locator('#transportCorrectionPanel')).toBeVisible();
  const geometry=await page.evaluate(()=>{const panel=document.getElementById('panel'),dashboard=document.getElementById('tripToolsDashboard');return{panel:panel.getBoundingClientRect().toJSON(),dashboard:dashboard.getBoundingClientRect().toJSON(),height:innerHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth}});
  expect(geometry.dashboard.left).toBeGreaterThanOrEqual(geometry.panel.left-1);
  expect(geometry.dashboard.right).toBeLessThanOrEqual(geometry.panel.right+1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);
  expect(pageErrors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`${testInfo.project.name}.png`),fullPage:false});
});
