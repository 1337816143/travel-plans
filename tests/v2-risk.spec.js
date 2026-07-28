import {test,expect} from '@playwright/test';

test('v2.4 risk metrics use parsed activity hours and AMap walking geometry',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Run precision test once on desktop');
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();return route.abort()});
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.eyebrow')).toContainText('v2.4.0');
  await page.locator('[data-tab="tools"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});
  const result=await page.evaluate(()=>{
    const hours=TravelRiskMetrics.activeHours({items:[['09:30–12:30','户外'],['14:15–17:20','室内']]});
    const geometry=TravelRiskMetrics.pathGeometry({steps:[{polyline:'120.380000,36.060000;120.381000,36.061000;120.382000,36.062000'}]});
    const sampled=TravelRiskMetrics.sampleGeometry(geometry,50,100);
    return{hours,geometryLength:geometry.length,sampledLength:sampled.length,first:geometry[0],resultShape:Object.keys(TravelServiceResult.success({ok:true},{source:'test'})).sort()};
  });
  expect(result.hours).toEqual([9,17]);
  expect(result.geometryLength).toBe(3);
  expect(result.sampledLength).toBeGreaterThanOrEqual(3);
  expect(result.first.lat).toBeGreaterThan(35.9);
  expect(result.resultShape).toEqual(['cached','data','error','ok','reportedAt','source']);
});
