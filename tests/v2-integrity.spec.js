import {test,expect} from '@playwright/test';

async function openOffline(page){
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    if(url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/forecast')return route.fulfill({contentType:'application/json',body:JSON.stringify({hourly:{time:[],apparent_temperature:[],precipitation_probability:[],weather_code:[]}})});
    return route.abort();
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.eyebrow')).toContainText('v2.5.2');
  await page.evaluate(()=>window.TravelAmapStartup?.hide());
  await page.waitForTimeout(250);
}

test('v2.5.2 organizes travel tools and maps all must-eat / must-buy tasks',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Run integrity test on desktop profiles');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openOffline(page);

  await page.evaluate(()=>filterDay('08-12'));
  await expect(page.locator('#dayRouteCard')).toHaveClass(/show/);
  await expect(page.locator('#dayRouteTitle')).toContainText('8月12日');

  await page.locator('[data-tab="tools"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});
  await expect(page.locator('#tripToolsDashboard')).toBeVisible();
  await expect(page.locator('.trip-tool-section')).toHaveCount(5);
  await expect(page.locator('[data-tool-group="quick"]')).toHaveAttribute('open','');
  await expect(page.locator('[data-tool-group="wishlist"]')).toHaveAttribute('open','');
  await expect(page.locator('#nextStopPanel')).toContainText('下一站行动卡');
  await expect(page.locator('#girlfriendWishlistPanel')).toContainText('17/17');
  await expect(page.locator('#girlfriendWishlistPanel')).toContainText('12/12');
  await expect(page.locator('#girlfriendWishlistPanel')).toContainText('必吃必买已关联地图');
  await expect(page.locator('#financeForm')).toBeAttached();
  await expect(page.locator('#accessibilityPanel [data-accessibility="simpleMode"]')).toBeAttached();
  await expect(page.locator('#rainAlternativeContent .availability-row').first()).toBeAttached({timeout:15000});

  const wishlist=await page.evaluate(()=>({
    schema:TRAVEL_SCHEMA_REPORT.counts,
    coverage:TravelGirlfriendWishlist.coverage(),
    aliases:TravelGirlfriendWishlist.data.attractions.flatMap(item=>item.aliases||[]),
    food:TravelGirlfriendWishlist.data.food.map(item=>({id:item.id,mapPointId:item.mapPointId})),
    mapPoints:TravelWishlistMap.points.map(item=>({id:item.id,category:item.category,precision:item.precision,lat:item.lat,lng:item.lng,html:TravelRenderModel.markerHtml(item)})),
    runtimePoints:POINTS.length,
    dayVisible:TravelSelectors.visiblePoints('08-12',{recommendationMode:false}).filter(point=>TravelWishlistMap.isPoint(point)).map(point=>point.id)
  }));
  expect(wishlist.schema).toMatchObject({wishlistAttractions:17,wishlistFood:12,wishlistMapPoints:10,mappedWishlistFood:12,runtimePoints:49});
  expect(wishlist.coverage).toMatchObject({coveredAttractions:17,totalAttractions:17,totalFoods:12,mappedFoods:12});
  expect(wishlist.aliases).toEqual(expect.arrayContaining(['雕塑岛（日出）','小青岛公园','黄岛金沙滩']));
  expect(wishlist.food.every(item=>Boolean(item.mapPointId))).toBe(true);
  expect(wishlist.mapPoints).toHaveLength(10);
  expect(new Set(wishlist.mapPoints.map(item=>item.category))).toEqual(new Set(['必吃','必买']));
  expect(wishlist.mapPoints.every(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lng))).toBe(true);
  expect(wishlist.mapPoints.some(item=>item.precision==='anchor')).toBe(true);
  expect(wishlist.mapPoints.find(item=>item.id==='wishmap-wanhechun').html).toContain('wishlist-map-marker eat');
  expect(wishlist.mapPoints.find(item=>item.id==='wishmap-lizhizha').html).toContain('wishlist-map-marker buy');
  expect(wishlist.runtimePoints).toBe(49);
  expect(wishlist.dayVisible).toContain('wishmap-wanhechun');
  expect(wishlist.dayVisible).not.toContain('wishmap-wangjie');

  await page.locator('[data-wishlist-map-mode="all"]').click();
  await expect.poll(()=>page.evaluate(()=>TravelWishlistMap.mode())).toBe('all');
  const allVisible=await page.evaluate(()=>TravelSelectors.visiblePoints('08-12',{recommendationMode:false}).filter(point=>TravelWishlistMap.isPoint(point)).length);
  expect(allVisible).toBe(10);
  await page.locator('[data-wishlist-map-mode="day"]').click();

  const wishCheckbox=page.locator('[data-wishlist-done]').first();await wishCheckbox.check();
  const savedWishlist=await page.evaluate(()=>({raw:JSON.parse(localStorage.getItem(TravelGirlfriendWishlist.key)),exported:TravelVersionedStorage.exportEntries()}));
  expect(savedWishlist.raw).toMatchObject({schemaVersion:1,data:{}});
  expect(Object.keys(savedWishlist.raw.data)).toHaveLength(1);
  expect(Object.prototype.hasOwnProperty.call(savedWishlist.exported.entries,'trip-girlfriend-wishlist-v2.5.1')).toBe(true);

  const storageState=await page.evaluate(()=>{
    const booking=BOOKINGS[0];setBookingProgress(booking.id,'booked');
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return{raw,bridge:Boolean(TravelLegacyStorageBridge),migrated:TravelLegacyStorageBridge.migrated()};
  });
  expect(storageState.bridge).toBe(true);
  expect(storageState.raw).toMatchObject({schemaVersion:1,data:{}});
  expect(storageState.raw.data[Object.keys(storageState.raw.data)[0]]).toBe('booked');

  const observerState=await page.evaluate(async()=>{
    const panel=document.getElementById('rainAlternativePanel'),list=panel.querySelector('.rain-alternatives'),select=panel.querySelector('[data-availability-status]');
    let mutations=0;const observer=new MutationObserver(records=>{mutations+=records.reduce((sum,record)=>sum+record.addedNodes.length+record.removedNodes.length,0)});observer.observe(panel,{childList:true,subtree:true});
    select.value='closed';select.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,500));observer.disconnect();
    const id=select.dataset.availabilityStatus,button=list.querySelector(`button[data-focus-stop="${CSS.escape(id)}"]`),rows=list.querySelectorAll('.availability-row').length,buttons=list.querySelectorAll(':scope > button[data-focus-stop]').length;
    return{mutations,rows,buttons,status:TravelAvailability.get(id)?.status,buttonStatus:button?.dataset.availability,operationUndoable:TravelOperationLog.lastUndoable()?.type||null};
  });
  expect(observerState.status).toBe('closed');
  expect(observerState.buttonStatus).toBe('closed');
  expect(observerState.rows).toBe(observerState.buttons);
  expect(observerState.mutations).toBeLessThan(20);
  expect(observerState.operationUndoable).not.toBe('availability');

  const finance=await page.evaluate(()=>{
    TravelFinance.clear();
    TravelFinance.add({kind:'actual',category:'交通',amount:60,label:'一人承担',split:1,date:'08-12'});
    TravelFinance.add({kind:'actual',category:'餐饮',amount:40,label:'两人分摊',split:2,date:'08-12'});
    return TravelFinance.summary('08-12');
  });
  expect(finance).toMatchObject({actual:100,perPersonActual:80,count:2});

  const layerState=await page.evaluate(()=>{
    TravelFloatingLayers.set('drawer',true,{state:'half'});
    const open=TravelStore.snapshot().routeDrawerState;
    TravelFloatingLayers.set('drawer',false,{state:'collapsed'});
    return{open,closed:TravelStore.snapshot().routeDrawerState};
  });
  expect(layerState).toEqual({open:'half',closed:'collapsed'});
  expect(errors).toEqual([]);
});
