import {test,expect} from '@playwright/test';

async function openOffline(page){
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    return route.abort();
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.eyebrow')).toContainText('v2.5.3');
  await page.evaluate(()=>window.TravelAmapStartup?.hide());
  await page.waitForTimeout(250);
}

test('food search preserves personal recommendations and synchronizes point search',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Desktop precision workflow');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openOffline(page);

  await expect(page.locator('[data-tab="food"]')).toHaveText('美食检索');
  await page.locator('[data-tab="food"]').click();
  await expect(page.locator('[data-panel="food"]')).toHaveClass(/active/);
  await expect(page.locator('.food-search-card.girlfriend-must')).toHaveCount(12);
  await expect(page.locator('[data-food-id="food-xiaomujia"]')).toContainText('小木家韩式烤肉（漳州二路店）');
  await expect(page.locator('[data-food-id="food-xiaomujia"]')).toContainText('参鸡汤（朋友亲测推荐）');
  await expect(page.locator('[data-food-id="food-xiaomujia"]')).toContainText('漳州二路49号');
  await expect(page.locator('[data-food-id="food-yunnan-rice-noodle"]')).toContainText('精确门店待确认');
  await expect(page.locator('[data-food-id="food-yunnan-rice-noodle"]')).toContainText('薄荷炸排骨');
  await expect(page.locator('[data-food-id="food-yunnan-rice-noodle"]')).toContainText('真实核验范围');
  await expect(page.locator('.food-search-logo.special-seven').first()).toBeVisible();

  await page.locator('[data-tab="search"]').click();
  await page.locator('#searchInput').fill('参鸡汤');
  await expect(page.locator('#searchResults')).toContainText('小木家韩式烤肉（漳州二路店）');
  await expect(page.locator('#presetDestination optgroup[label="小七必吃必买"] option')).toHaveCount(10);
  await expect(page.locator('#presetDestination option[value="wishmap-xiaomujia"]')).toContainText('小木家参鸡汤');
  await expect(page.locator('#presetDestination option[value="wishmap-yunnan-noodle"]')).toContainText('锅锅米线核店');

  const data=await page.evaluate(()=>({
    xiaomujia:GIRLFRIEND_WISHLIST.food.find(item=>item.id==='food-xiaomujia'),
    yunnan:GIRLFRIEND_WISHLIST.food.find(item=>item.id==='food-yunnan-rice-noodle'),
    runtimeXiaomujia:pointById('wishmap-xiaomujia'),
    runtimeYunnan:pointById('wishmap-yunnan-noodle'),
    marker:TravelRenderModel.markerHtml(pointById('wishmap-xiaomujia'))
  }));
  expect(data.xiaomujia).toMatchObject({girlfriendMust:true,address:'青岛市市南区漳州二路49号（燕儿岛路地铁站B口步行约300米）',verification:{store:'verified',dish:'trusted-personal-recommendation'}});
  expect(data.yunnan).toMatchObject({girlfriendMust:true,target:'薄荷炸排骨',verification:{store:'unverified',dish:'trusted-personal-recommendation'}});
  expect(data.runtimeXiaomujia.name).toBe('小木家韩式烤肉（漳州二路店）');
  expect(data.runtimeYunnan.status).toContain('精确门店尚未核实');
  expect(data.marker).toContain('girlfriend-seven-marker');
  expect(data.marker).toContain('girlfriend-seven-svg');
  expect(errors).toEqual([]);
});

test('food focus finishes at logo-level zoom on AMap and keeps Leaflet zoom logic',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Run focus behavior once on desktop');
  await openOffline(page);
  const result=await page.evaluate(async()=>{
    const amapCalls=[];
    mapEngine='amap';
    syncAmapView=()=>{};
    amapInstance={setZoomAndCenter:(zoom,center)=>amapCalls.push({zoom,center})};
    window.amapOpenPoint=()=>amapInstance.setZoomAndCenter(16,[0,0]);
    TravelFoodSearch.focusFood('wishmap-xiaomujia');
    await new Promise(resolve=>setTimeout(resolve,300));
    return{amapCalls,focusSource:TravelFoodSearch.focusFood.toString()};
  });
  expect(result.amapCalls.at(-1).zoom).toBe(18);
  expect(result.focusSource).toContain('map.setView([point.lat,point.lng],zoom)');
  expect(result.focusSource).toContain('clusters.zoomToShowLayer');
});

test('travel tools dashboard keeps a horizontal readable hierarchy',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('desktop'),'Desktop layout geometry');
  await openOffline(page);
  await page.locator('[data-tab="tools"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-trip-tools-loaded','true',{timeout:15000});
  const geometry=await page.evaluate(()=>{
    const dashboard=document.getElementById('tripToolsDashboard'),title=dashboard.querySelector('.trip-tools-dashboard-title'),controls=dashboard.querySelector('.trip-tools-dashboard-controls'),select=dashboard.querySelector('select');
    return{dashboard:dashboard.getBoundingClientRect().toJSON(),title:title.getBoundingClientRect().toJSON(),controls:controls.getBoundingClientRect().toJSON(),select:select.getBoundingClientRect().toJSON()};
  });
  expect(geometry.title.width).toBeGreaterThan(180);
  expect(geometry.title.height).toBeLessThan(100);
  expect(geometry.controls.left).toBeGreaterThanOrEqual(geometry.dashboard.left-1);
  expect(geometry.controls.right).toBeLessThanOrEqual(geometry.dashboard.right+1);
  expect(geometry.select.right).toBeLessThanOrEqual(geometry.dashboard.right+1);
});
