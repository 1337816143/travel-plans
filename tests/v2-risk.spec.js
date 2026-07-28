import {test,expect} from '@playwright/test';

test('v2.4 risk metrics use parsed activity hours and AMap walking geometry',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Run precision test once on desktop');
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();return route.abort()});
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.eyebrow')).toContainText('v2.4.0');
  await page.locator('[data-tab="tools"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});
  const result=await page.evaluate(async()=>{
    const hours=TravelRiskMetrics.activeHours({items:[['09:30–12:30','户外'],['14:15–17:20','室内']]});
    const geometry=TravelRiskMetrics.pathGeometry({steps:[{polyline:'120.380000,36.060000;120.381000,36.061000;120.382000,36.062000'}]});
    const sampled=TravelRiskMetrics.sampleGeometry(geometry,50,100);
    const comfort=TravelTripOperations.comfort({date:'08-10',items:[['09:30–12:30','公园慢游']]},{walking:{distance:0,transferSegments:2,unmappedSegments:1},elevation:{ascent:null},hourly:{apparentMax:30}});
    const walkingMode=TravelRiskMetrics.segmentMode({name:'琴屿路',lat:36.058,lng:120.32},{name:'小青岛',lat:36.057,lng:120.321,transport:'从琴屿路步行连接'});
    const transferMode=TravelRiskMetrics.segmentMode({name:'酒店',lat:36.065,lng:120.378},{name:'崂山',lat:36.17,lng:120.66,transport:'地铁换乘后乘景区观光车'});
    const input=document.getElementById('amapSearchInput');input.value='';const emptySearch=await TravelServiceFacade.invoke('search');
    amapEnsureServices=()=>Promise.resolve();amapPlaceSearch={search:(keyword,callback)=>callback('complete',{marker:'search-data',keyword,poiList:{pois:[]}})};input.value='测试地点';const successfulSearch=await TravelServiceFacade.invoke('search');
    return{hours,outdoorMinutes:comfort.outdoorMinutes,transferReasonCount:comfort.reasons.filter(reason=>reason.includes('交通转场')).length,unmappedReasonCount:comfort.reasons.filter(reason=>reason.includes('交通方式未明确')).length,walkingMode:walkingMode.mode,transferMode:transferMode.mode,geometryLength:geometry.length,sampledLength:sampled.length,first:geometry[0],resultShape:Object.keys(TravelServiceResult.success({ok:true},{source:'test'})).sort(),emptySearch,successfulSearch};
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
  expect(result.resultShape).toEqual(['cached','data','error','ok','reportedAt','source']);
  expect(result.emptySearch).toMatchObject({ok:false,data:null,source:'高德地点搜索',cached:false});
  expect(result.emptySearch.error.message).toContain('请输入地点');
  expect(result.successfulSearch).toMatchObject({ok:true,source:'高德地点搜索',cached:false});
  expect(result.successfulSearch.data.marker).toBe('search-data');
});
