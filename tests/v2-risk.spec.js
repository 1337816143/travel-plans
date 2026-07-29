import {test,expect} from '@playwright/test';

test('v2.5.1 uses corrected segments, GPX elevation, pure services and status-aware calendar',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Run precision test once on desktop');
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    if(url.hostname==='restapi.amap.com'){
      if(url.pathname.includes('/v3/direction/walking'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',route:{paths:[{distance:'1350',duration:'1080',steps:[{polyline:'120.320000,36.060000;120.321500,36.061500;120.323000,36.063000'}]}]}})});
      if(url.pathname.includes('/v3/direction/driving'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',route:{taxi_cost:'30',paths:[{distance:'5000',duration:'900'}]}})});
      if(url.pathname.includes('/v3/direction/transit'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',route:{transits:[{distance:'4500',duration:'1400'}]}})});
      if(url.pathname.includes('/v3/place/text'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',pois:[{id:'p1',name:'测试地点',location:'120.38,36.06'}]})});
      if(url.pathname.includes('/v3/weather/weatherInfo'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',forecasts:[{reporttime:'2026-08-11 08:00:00',casts:[{date:'2026-08-12',dayweather:'阵雨',nightweather:'多云',daytemp:'31',nighttemp:'25'}]}]})});
      if(url.pathname.includes('/v3/ip'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',province:'山东省',city:'青岛市',rectangle:'120.30,36.02;120.45,36.15'})});
      if(url.pathname.includes('/v3/traffic/status/circle'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',trafficinfo:{description:'畅通',roads:[]}})});
    }
    if(url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/elevation'){
      const count=(url.searchParams.get('latitude')||'').split(',').filter(Boolean).length;
      return route.fulfill({contentType:'application/json',body:JSON.stringify({elevation:Array.from({length:count},(_,index)=>20+index*8)})});
    }
    if(url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/forecast'){
      const time=[],apparent_temperature=[],precipitation_probability=[],weather_code=[];
      for(let hour=0;hour<24;hour++){
        time.push(`2026-08-12T${String(hour).padStart(2,'0')}:00`);
        apparent_temperature.push(hour>=9&&hour<=17?34:27);
        precipitation_probability.push(hour===14?65:15);
        weather_code.push(hour===14?61:1);
      }
      return route.fulfill({contentType:'application/json',body:JSON.stringify({hourly:{time,apparent_temperature,precipitation_probability,weather_code}})});
    }
    return route.abort();
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.eyebrow')).toContainText('v2.5.1');
  await page.locator('[data-tab="tools"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});
  const result=await page.evaluate(async()=>{
    TravelRiskMetrics.clear();await TravelTrackStore.clear();TravelSegmentOverrides.clearDay('08-12');TravelAvailability.clear();TravelFinance.clear();TravelOperationLog.clear();
    const hours=TravelRiskMetrics.activeHours({items:[['09:30–12:30','户外'],['14:15–17:20','室内']]});
    const day=SCHEDULES.find(item=>item.date==='08-12'),entries=TravelTripOperations.routeEntries(day),segmentIndex=entries.findIndex((entry,index)=>entry.point.id==='qinyu'&&entries[index+1]?.point.id==='xiaoqingdao'),a=entries[segmentIndex].point,b=entries[segmentIndex+1].point;
    const auto=TravelRiskMetrics.segmentMode(a,b,{day,index:segmentIndex});
    TravelSegmentOverrides.set(day,segmentIndex,a,b,'taxi');
    const correctedTransfer=TravelRiskMetrics.segmentMode(a,b,{day,index:segmentIndex});
    TravelSegmentOverrides.set(day,segmentIndex,a,b,'walking');
    const correctedWalking=TravelRiskMetrics.segmentMode(a,b,{day,index:segmentIndex});
    const gpx=`<?xml version="1.0"?><gpx version="1.1"><trk><name>测试轨迹</name><trkseg><trkpt lat="36.0580" lon="120.3200"><ele>10</ele><time>2026-08-12T01:00:00Z</time></trkpt><trkpt lat="36.0590" lon="120.3210"><ele>18</ele></trkpt><trkpt lat="36.0600" lon="120.3220"><ele>15</ele></trkpt><trkpt lat="36.0615" lon="120.3240"><ele>32</ele><time>2026-08-12T01:25:00Z</time></trkpt></trkseg></trk></gpx>`;
    const parsed=TravelTrackStore.parseGpx(gpx);await TravelTrackStore.save('08-12',parsed.points,{name:'测试轨迹.gpx',source:'GPX',startTime:parsed.startTime,endTime:parsed.endTime});
    const measured=await TravelRiskMetrics.get(day,{force:true});
    const pureSearch=await TravelServiceFacade.invokePure('search','测试地点');
    const pureCompare=await TravelServiceFacade.invokePure('compareModes',[120.38,36.06],[120.40,36.08]);
    const input=document.getElementById('amapSearchInput');input.value='';const emptyControllerSearch=await TravelServiceFacade.invoke('search');
    const budget=TravelFinance.add({kind:'budget',category:'交通',amount:120,label:'交通预算',date:'08-12'}),actual=TravelFinance.add({kind:'actual',category:'交通',amount:45,label:'实际车费',date:'08-12'}),finance=TravelFinance.summary('08-12');
    const availability=TravelAvailability.set('underwater','closed',{note:'测试临时闭馆',sourceUrl:pointById('underwater').sourceUrl}),availabilityNow=TravelAvailability.get('underwater'),availabilityLabel=TravelAvailability.label('underwater');
    const cancelDay=SCHEDULES.find(item=>item.date==='08-16');for(const entry of TravelTripOperations.routeEntries(cancelDay))TravelTripOperations.setStop(cancelDay.date,entry.point.id,entry.occurrence,'skipped',{log:false});
    const calendarEvent=TravelCalendarExport.itineraryEvents().find(item=>item.id==='itinerary-08-16'),calendar=TravelCalendarExport.calendarIcs([calendarEvent],'测试取消','CANCEL');
    const booking=BOOKINGS.find(item=>/(?:提前|参观前)\s*\d+\s*日/.test(item.note||''));setBookingProgress(booking.id,'abandoned');const bookingEvent=TravelCalendarExport.bookingEvents().find(item=>item.sourceId===booking.id),bookingCalendar=TravelCalendarExport.calendarIcs([bookingEvent],'预约取消','CANCEL');
    const exported=TravelVersionedStorage.exportEntries(),validImport=TravelVersionedStorage.validateImport(exported).format;let invalidImport='';try{TravelVersionedStorage.validateImport({bad:true})}catch(error){invalidImport=error.message}
    const accessibility=TravelAccessibility.set({fontScale:1.15,contrast:'high',reduceMotion:true,simpleMode:true});
    return{
      hours,auto,correctedTransfer,correctedWalking,parsed,measured,pureSearch,pureCompare,emptyControllerSearch,budget,actual,finance,availability,availabilityNow,availabilityLabel,calendarEvent,calendar,bookingEvent,bookingCalendar,validImport,invalidImport,accessibility,
      resultShape:Object.keys(TravelServiceResult.success({ok:true},{source:'test'})).sort(),routeBridge:String(TravelAmapAssistantController.planRoute),services:TravelServiceFacade.snapshot(),store:TravelStore.snapshot(),selectors:TravelSelectors.routeEntries(day).length
    };
  });
  expect(result.hours).toEqual([9,17]);
  expect(result.auto.mode).toBe('walking');
  expect(result.correctedTransfer).toMatchObject({mode:'transfer',override:'taxi'});
  expect(result.correctedWalking).toMatchObject({mode:'walking',override:'walking'});
  expect(result.parsed.points.length).toBe(4);
  expect(result.parsed.distance).toBeGreaterThan(300);
  expect(result.measured).toMatchObject({ok:true,cached:false});
  expect(result.measured.data.walking.source).toContain('GPX');
  expect(result.measured.data.walking.track.points).toBe(4);
  expect(result.measured.data.elevation.source).toContain('GPX');
  expect(result.measured.data.elevation.ascent).toBeGreaterThan(0);
  expect(result.measured.data.hourly.activeHours[0]).toBeLessThanOrEqual(9);
  expect(result.measured.data.hourly.apparentMax).toBe(34);
  expect(result.measured.data.hourly.precipitationProbabilityMax).toBe(65);
  expect(result.measured.data.quality.walking).toBe('imported-track');
  expect(result.pureSearch).toMatchObject({ok:true,source:'高德地点搜索'});
  expect(result.pureSearch.data.pois[0].name).toBe('测试地点');
  expect(result.pureCompare).toMatchObject({ok:true,source:'高德多方式路线比较'});
  expect(Object.keys(result.pureCompare.data).sort()).toEqual(['driving','transit','walking']);
  expect(result.emptyControllerSearch).toMatchObject({ok:false,data:null,source:'高德地点搜索'});
  expect(result.finance).toMatchObject({budget:120,actual:45,remaining:75,perPersonActual:22.5,count:2});
  expect(result.availabilityNow).toMatchObject({status:'closed',note:'测试临时闭馆',expired:false});
  expect(result.availability.expiresAt).toBeGreaterThan(Date.now());
  expect(result.availabilityLabel).toBe('临时关闭/停运');
  expect(result.calendarEvent.status).toBe('CANCELLED');
  expect(result.calendar).toContain('METHOD:CANCEL');
  expect(result.calendar).toContain('STATUS:CANCELLED');
  expect(result.calendar).toContain('UID:itinerary-08-16@travel-plans.local');
  expect(result.bookingEvent.status).toBe('CANCELLED');
  expect(result.bookingEvent.sequence).toBe(1);
  expect(result.bookingCalendar).toContain('UID:booking-');
  expect(result.bookingCalendar).toContain('STATUS:CANCELLED');
  expect(result.validImport).toBe('travel-plans-local-data');
  expect(result.invalidImport).toContain('有效的旅行计划数据文件');
  expect(result.accessibility).toMatchObject({fontScale:1.15,contrast:'high',reduceMotion:true,simpleMode:true});
  expect(result.resultShape).toEqual(['cached','data','error','ok','reportedAt','source']);
  expect(result.routeBridge).toContain("TravelServiceFacade.invoke('route'");
  expect(result.routeBridge).not.toContain('installed.route');
  expect(result.services.controllerSeparated).toBe(true);
  expect(result.services.pureServices).toEqual(expect.arrayContaining(['search','route','compareModes','health']));
  expect(result.selectors).toBeGreaterThan(2);
});
