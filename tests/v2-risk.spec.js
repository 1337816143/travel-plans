import {test,expect} from '@playwright/test';

test('v2.4 risk metrics use measured walking geometry, elevation and active-hour weather',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Run precision test once on desktop');
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    if(url.hostname==='restapi.amap.com'&&url.pathname.includes('/v3/direction/walking'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'1',route:{paths:[{distance:'1350',duration:'1080',steps:[{polyline:'120.320000,36.060000;120.321500,36.061500;120.323000,36.063000'}]}]}})});
    if(url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/elevation'){
      const count=(url.searchParams.get('latitude')||'').split(',').filter(Boolean).length;
      return route.fulfill({contentType:'application/json',body:JSON.stringify({elevation:Array.from({length:count},(_,index)=>20+index*8)})});
    }
    if(url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/forecast'){
      const time=[],apparent_temperature=[],precipitation_probability=[],weather_code=[];
      for(let hour=0;hour<24;hour++){
        time.push(`2026-08-10T${String(hour).padStart(2,'0')}:00`);
        apparent_temperature.push(hour>=9&&hour<=12?34:27);
        precipitation_probability.push(hour===11?65:15);
        weather_code.push(hour===11?61:1);
      }
      return route.fulfill({contentType:'application/json',body:JSON.stringify({hourly:{time,apparent_temperature,precipitation_probability,weather_code}})});
    }
    return route.abort();
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.eyebrow')).toContainText('v2.4.0');
  await page.locator('[data-tab="tools"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});
  const result=await page.evaluate(async()=>{
    TravelRiskMetrics.clear();
    const hours=TravelRiskMetrics.activeHours({items:[['09:30–12:30','户外'],['14:15–17:20','室内']]});
    const geometry=TravelRiskMetrics.pathGeometry({steps:[{polyline:'120.380000,36.060000;120.381000,36.061000;120.382000,36.062000'}]});
    const sampled=TravelRiskMetrics.sampleGeometry(geometry,50,100);
    const comfort=TravelTripOperations.comfort({date:'08-10',items:[['09:30–12:30','公园慢游']]},{walking:{distance:0,transferSegments:2,unmappedSegments:1},elevation:{ascent:null},hourly:{apparentMax:30}});
    const walkingMode=TravelRiskMetrics.segmentMode({name:'琴屿路',lat:36.058,lng:120.32},{name:'小青岛',lat:36.057,lng:120.321,transport:'从琴屿路步行连接'});
    const transferMode=TravelRiskMetrics.segmentMode({name:'酒店',lat:36.065,lng:120.378},{name:'崂山',lat:36.17,lng:120.66,transport:'地铁换乘后乘景区观光车'});
    const measured=await TravelRiskMetrics.get({date:'08-10',route:['qinyu','xiaoqingdao'],items:[['09:30–12:30','琴屿路步行至小青岛公园']]},{force:true});
    const input=document.getElementById('amapSearchInput');input.value='';const emptySearch=await TravelServiceFacade.invoke('search');
    amapEnsureServices=()=>Promise.resolve();amapPlaceSearch={search:(keyword,callback)=>callback('complete',{marker:'search-data',keyword,poiList:{pois:[]}})};input.value='测试地点';const successfulSearch=await TravelServiceFacade.invoke('search');
    return{
      hours,
      outdoorMinutes:comfort.outdoorMinutes,
      transferReasonCount:comfort.reasons.filter(reason=>reason.includes('交通转场')).length,
      unmappedReasonCount:comfort.reasons.filter(reason=>reason.includes('交通方式未明确')).length,
      walkingMode:walkingMode.mode,
      transferMode:transferMode.mode,
      geometryLength:geometry.length,
      sampledLength:sampled.length,
      first:geometry[0],
      measured,
      resultShape:Object.keys(TravelServiceResult.success({ok:true},{source:'test'})).sort(),
      routeBridge:String(TravelAmapAssistantController.planRoute),
      emptySearch,
      successfulSearch
    };
  });
  expect(result.hours).toEqual([9,17]);
  expect(result.outdoorMinutes).toBe(180);
  expect(result.transferReasonCount).toBe(1);
  expect(result.unmappedReasonCount).toBe(1);
  expect(result.walkingMode).toBe('walking');
  expect(result.transferMode).toBe('transfer');
  expect(result.geometryLength).toBe(3);
  expect(result.sampledLength).toBeGreaterThanOrEqual(3);
  expect(result.first.lat).toBeGreaterThan(35.9);
  expect(result.measured).toMatchObject({ok:true,cached:false});
  expect(result.measured.data.walking).toMatchObject({distance:1350,walkingSegments:1,transferSegments:0,unmappedSegments:0});
  expect(result.measured.data.walking.geometry.length).toBeGreaterThanOrEqual(3);
  expect(result.measured.data.elevation.sampleCount).toBeGreaterThan(0);
  expect(result.measured.data.elevation.ascent).toBeGreaterThanOrEqual(0);
  expect(result.measured.data.hourly.activeHours).toEqual([9,12]);
  expect(result.measured.data.hourly.apparentMax).toBe(34);
  expect(result.measured.data.hourly.precipitationProbabilityMax).toBe(65);
  expect(result.resultShape).toEqual(['cached','data','error','ok','reportedAt','source']);
  expect(result.routeBridge).toContain("TravelServiceFacade.invoke('route'");
  expect(result.routeBridge).not.toContain('installed.route');
  expect(result.emptySearch).toMatchObject({ok:false,data:null,source:'高德地点搜索',cached:false});
  expect(result.emptySearch.error.message).toContain('请输入地点');
  expect(result.successfulSearch).toMatchObject({ok:true,source:'高德地点搜索',cached:false});
  expect(result.successfulSearch.data.marker).toBe('search-data');
});
