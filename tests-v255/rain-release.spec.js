import {test,expect} from '@playwright/test';

async function openPage(page,path='/index.html'){
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    return route.abort();
  });
  await page.goto(path,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('[data-tab="rain"]')&&window.TravelRainGuide,{timeout:12000});
}

test('v2.5.5 exposes complete rain contingency and official beach table',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openPage(page);
  await expect(page.locator('[data-tab="rain"]')).toHaveText('雨天攻略');
  await page.locator('[data-tab="rain"]').click();
  const panel=page.locator('[data-panel="rain"]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('固定行程不重排');
  for(const text of ['小麦岛草坪看日落','笨蛤蜊地标小吃大排档','私人游艇避坑','沙子口休闲广场','Vya无涯coffee','青岛云上海天'])await expect(panel).toContainText(text);
  await expect(panel.locator('.beach-table tbody tr')).toHaveCount(9);
  await expect(panel).toContainText('天气风险提示 ≠ 官方封海状态');
  await expect(panel).toContainText('北九水');
  await page.locator('[data-rain-filter-button="beach"]').click();
  await expect(panel.locator('[data-rain-section="beach"]')).toBeVisible();
  const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,version:document.querySelector('meta[name="travel-map-version"]')?.content,app:typeof window.TravelRainGuide}));
  expect(geometry.version).toBe('2.5.5');
  expect(geometry.app).toBe('object');
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+2);
  expect(errors).toEqual([]);
});

test('v3 complete-guide workspace loads current v2.5.5 while retaining rollback wording',async({page})=>{
  await page.goto('/v3/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toContainText('v2.5.5 当前完整攻略');
  await expect(page.locator('body')).toContainText('v2.5.4');
  const frame=page.frameLocator('[data-testid="legacy-v2-frame"]');
  await expect(frame.locator('[data-tab="rain"]')).toHaveText('雨天攻略',{timeout:15000});
  await frame.locator('[data-tab="rain"]').click();
  await expect(frame.locator('[data-panel="rain"]')).toContainText('9处海水浴场');
});
