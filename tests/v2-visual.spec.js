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
  await expect(page.locator('.eyebrow')).toContainText('v2.5.1');
  await page.evaluate(()=>window.TravelAmapStartup?.hide());
  await page.waitForTimeout(350);
  await expect(page.locator('#auditBox')).not.toContainText('页面初始化失败');
}
async function loadTools(page){await page.locator('[data-tab="tools"]').click();await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});await expect(page.locator('#nextStopPanel')).toBeVisible();await expect(page.locator('#girlfriendWishlistPanel')).toBeVisible()}
function overlapArea(a,b){return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))}
function isDesktop(name){return name.startsWith('desktop')}

test('desktop v2.5.1 synchronizes map, complete wishlist, practical actions and accessible layout',async({page},testInfo)=>{
  test.skip(!isDesktop(testInfo.project.name),'Desktop-only workflow test');
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await openPreview(page);
  await page.evaluate(()=>filterDay('08-10'));
  await expect(page.locator('#dayRouteCard')).toHaveClass(/show/);
  const initial=await page.evaluate(()=>{return{store:TravelStore.snapshot(),adapters:TravelMapAdapters.snapshot(),services:TravelServiceFacade.snapshot(),lazyLoaded:TravelLazyTools.loaded,result:TravelServiceResult.success({sample:true},{source:'test'})}});
  expect(initial.store.selectedDay).toBe('08-10');
  expect(initial.adapters.explicitContext).toBe(true);
  expect(initial.adapters.adapters).toEqual(expect.arrayContaining(['leaflet','amap']));
  expect(initial.services.shape).toEqual(['ok','data','error','source','cached','reportedAt']);
  expect(initial.services.controllerSeparated).toBe(true);
  expect(initial.services.pureServices).toEqual(expect.arrayContaining(['search','route','compareModes','health']));
  expect(initial.lazyLoaded).toBe(false);
  expect(initial.result).toMatchObject({ok:true,error:null,source:'test',cached:false});
  const factory=await page.evaluate(()=>{const fake={state:{selectedDay:null,routeVisible:true,recommendationMode:false},leaflet:{map:null,clusters:{clearLayers(){}},routeLayer:{clearLayers(){}},hotelLayer:null,markers:new Map()},L:()=>({}),visiblePoints:()=>[],schedules:()=>[],routePoints:()=>[],routeOrderMap:()=>new Map(),pointById:()=>null,routeMarkerIcon(){},popup(){},directionIcon(){},bearingRotation(){},setDayRouteCard(){}};const adapter=createLeafletTravelAdapter(fake);return{id:adapter.id,sameContext:adapter.context===fake,ready:adapter.ready()}});
  expect(factory).toEqual({id:'leaflet',sameContext:true,ready:false});
  const geometry=await page.evaluate(()=>{TravelLayoutCoordinator.measure();const card=document.getElementById('dayRouteCard'),controls=document.querySelector('.basemap-control');return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,card:card.getBoundingClientRect().toJSON(),controls:controls.getBoundingClientRect().toJSON()}});
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);
  expect(overlapArea(geometry.card,geometry.controls)).toBe(0);
  await loadTools(page);
  for(const id of ['nextStopPanel','girlfriendWishlistPanel','todayModePanel','stopStatusPanel','transportCorrectionPanel','trackPanel','comfortPanel','rainAlternativePanel','financePanel','dailyCardPanel','calendarExportPanel','accessibilityPanel','healthCheckPanel','localDataPanel','dataStatusPanel','operationLogPanel'])await expect(page.locator('#'+id)).toBeVisible();
  await expect(page.locator('#girlfriendWishlistPanel')).toContainText('17/17');
  await expect(page.locator('#girlfriendWishlistPanel')).toContainText('12 项餐饮/饮料/购买任务');
  for(const name of ['栈桥','八大关','崂山','五四广场','信号山','小青岛','青岛啤酒博物馆','金沙滩','琴屿路','燕儿岛','雕塑园','小麦岛','海之恋','小鱼山','石老人浴场','鱼鸣嘴','轮渡'])await expect(page.locator('#girlfriendWishlistPanel')).toContainText(name);
  await page.locator('[data-wishlist-filter="food"]').click();
  for(const name of ['万和春','王姐烧烤','高家糖球','前海沿','李村脂渣','崂山可乐普通版','崂山白花蛇草水','炒海肠','蛤蜊','梭子蟹','小木家','云南锅锅米线'])await expect(page.locator('#girlfriendWishlistPanel')).toContainText(name);
  const firstWish=page.locator('[data-wishlist-done]').first();await firstWish.check();await expect(page.locator('#girlfriendWishlistPanel')).toContainText('1 项已完成');
  const wishlistState=await page.evaluate(()=>({coverage:TravelGirlfriendWishlist.coverage(),saved:TravelGirlfriendWishlist.read()}));
  expect(wishlistState.coverage).toMatchObject({totalAttractions:17,coveredAttractions:17,totalFoods:12});expect(Object.keys(wishlistState.saved)).toHaveLength(1);
  const occurrence=await page.evaluate(()=>{const day=SCHEDULES.find(item=>new Set(item.route).size<item.route.length),counts={};let duplicate='';for(const id of day.route){counts[id]=(counts[id]||0)+1;if(counts[id]>1){duplicate=id;break}}TravelTripOperations.setStop(day.date,duplicate,0,'completed');TravelTripOperations.setStop(day.date,duplicate,1,'skipped');return{first:TravelTripOperations.stopValue(day.date,duplicate,0),second:TravelTripOperations.stopValue(day.date,duplicate,1)}});
  expect(occurrence).toEqual({first:'completed',second:'skipped'});
  await page.locator('#tripToolDaySelect').selectOption('08-12');
  await expect.poll(()=>page.evaluate(()=>TravelStore.snapshot())).toMatchObject({selectedDay:'08-12',toolsDay:'08-12',activeTab:'tools'});
  await expect(page.locator('[data-panel="tools"]')).toHaveClass(/active/);
  await expect(page.locator('#dailyCardContent')).toContainText('万和春');
  const firstSegment=page.locator('[data-segment-mode]').first();
  await firstSegment.selectOption('walking');
  await expect.poll(()=>page.evaluate(()=>TravelSegmentOverrides.list('08-12').length)).toBeGreaterThan(0);
  await page.locator('#financeForm [name="kind"]').selectOption('budget');
  await page.locator('#financeForm [name="category"]').selectOption('交通');
  await page.locator('#financeForm [name="label"]').fill('测试交通预算');
  await page.locator('#financeForm [name="amount"]').fill('100');
  await page.locator('#financeForm button[type="submit"]').click();
  await page.locator('#financeForm [name="kind"]').selectOption('actual');
  await page.locator('#financeForm [name="category"]').selectOption('交通');
  await page.locator('#financeForm [name="label"]').fill('测试实际车费');
  await page.locator('#financeForm [name="amount"]').fill('40');
  await page.locator('#financeForm button[type="submit"]').click();
  await expect(page.locator('#financePanel')).toContainText('¥100.00');
  await expect(page.locator('#financePanel')).toContainText('¥40.00');
  const finance=await page.evaluate(()=>TravelFinance.summary());
  expect(finance).toMatchObject({budget:100,actual:40,remaining:60,perPersonActual:20});
  await page.locator('[data-accessibility="fontScale"]').selectOption('1.15');
  await page.locator('[data-accessibility="contrast"]').selectOption('high');
  await page.locator('[data-accessibility="reduceMotion"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-contrast','high');
  await expect(page.locator('html')).toHaveClass(/user-reduce-motion/);
  const persistence=await page.evaluate(()=>{const exported=TravelVersionedStorage.exportEntries();return{format:exported.format,entryCount:Object.keys(exported.entries).length,preference:TravelPreferences.inspect('accessibility'),calendar:TravelCalendarExport.itineraryEvents().length,uid:TravelCalendarExport.calendarIcs(TravelCalendarExport.itineraryEvents().slice(0,1))}});
  expect(persistence.format).toBe('travel-plans-local-data');
  expect(persistence.entryCount).toBeGreaterThan(2);
  expect(persistence.preference.schemaVersion).toBe(1);
  expect(persistence.calendar).toBe(8);
  expect(persistence.uid).toContain('UID:itinerary-');
  await page.locator('[data-health-run="local"]').click();
  await expect(page.locator('#healthCheckResults')).toContainText('布局冲突');
  const layout=await page.evaluate(()=>TravelHealthCheck.layoutCheck());
  expect(layout.ok).toBe(true);
  const undo=await page.evaluate(()=>{const day=SCHEDULES.find(item=>item.date==='08-12'),entry=TravelTripOperations.routeEntries(day)[0];TravelTripOperations.setStop(day.date,entry.point.id,entry.occurrence,'completed');return{before:TravelTripOperations.stopValue(day.date,entry.point.id,entry.occurrence),id:entry.point.id,occurrence:entry.occurrence}});
  expect(undo.before).toBe('completed');
  await page.locator('[data-operation-undo]').first().click();
  await expect.poll(()=>page.evaluate(({id,occurrence})=>TravelTripOperations.stopValue('08-12',id,occurrence),undo)).not.toBe('completed');
  expect(pageErrors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`${testInfo.project.name}.png`),fullPage:false});
});

test('flagship mobile keeps panel, assistant, drawer and wishlist mutually usable',async({page},testInfo)=>{
  test.skip(isDesktop(testInfo.project.name),'Mobile device-profile test');
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await openPreview(page);
  await page.evaluate(()=>{const day=SCHEDULES.find(item=>item.date==='08-10');setDayRouteCard(day);TravelRouteDrawer.moveForViewport()});
  await expect(page.locator('html')).toHaveClass(/mobile-layout/);
  await expect(page.locator('#mobileRouteDrawer')).toHaveAttribute('data-state','half');
  const geometry=await page.evaluate(()=>{const drawer=document.getElementById('mobileRouteDrawer'),menu=document.getElementById('menuBtn'),base=document.querySelector('.basemap-control'),r=drawer.getBoundingClientRect(),m=menu.getBoundingClientRect(),b=base.getBoundingClientRect();return{drawer:r.toJSON(),menu:m.toJSON(),base:b.toJSON(),height:innerHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bottomGap:innerHeight-r.bottom}});
  expect(geometry.drawer.left).toBeGreaterThanOrEqual(0);expect(geometry.drawer.right).toBeLessThanOrEqual(geometry.width+1);expect(geometry.bottomGap).toBeGreaterThanOrEqual(42);expect(overlapArea(geometry.menu,geometry.base)).toBe(0);expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);
  await page.locator('#amapConfigBtn').click();
  await expect(page.locator('#amapServicePanel')).toBeVisible();
  await expect(page.locator('#mobileRouteDrawer')).toHaveAttribute('data-state','collapsed');
  await expect(page.locator('#panel')).not.toHaveClass(/open/);
  await page.locator('#menuBtn').click();
  await expect(page.locator('#panel')).toHaveClass(/open/);
  await expect(page.locator('#amapServicePanel')).toBeHidden();
  await expect(page.locator('#mobileRouteDrawer')).toHaveAttribute('data-state','collapsed');
  await page.locator('[data-tab="tools"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});
  await expect(page.locator('#nextStopPanel')).toBeVisible();
  await expect(page.locator('#girlfriendWishlistPanel')).toBeVisible();
  await expect(page.locator('#girlfriendWishlistPanel')).toContainText('17/17');
  const wishGeometry=await page.evaluate(()=>{const panel=document.getElementById('girlfriendWishlistPanel'),rect=panel.getBoundingClientRect();return{left:rect.left,right:rect.right,width:innerWidth,scrollWidth:document.documentElement.scrollWidth}});
  expect(wishGeometry.left).toBeGreaterThanOrEqual(0);expect(wishGeometry.right).toBeLessThanOrEqual(wishGeometry.width+1);expect(wishGeometry.scrollWidth).toBeLessThanOrEqual(wishGeometry.width+1);
  await page.locator('[data-accessibility="simpleMode"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-simple-mode','true');
  await expect(page.locator('#transportCorrectionPanel')).toBeHidden();
  await expect(page.locator('#girlfriendWishlistPanel')).toBeVisible();
  await page.locator('#panelEdgeToggle').click();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('panel').getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`${testInfo.project.name}.png`),fullPage:false});
});
