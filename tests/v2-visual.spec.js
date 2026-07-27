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
  await expect(page.locator('.eyebrow')).toContainText('v2.0.0');
}

test('desktop layout, panel seam and traffic toggle preserve view',async({page},testInfo)=>{
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await openPreview(page);
  await expect(page.locator('#panelEdgeToggle')).toBeVisible();
  const dimensions=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,panel:document.getElementById('panel').getBoundingClientRect().toJSON(),toggle:document.getElementById('panelEdgeToggle').getBoundingClientRect().toJSON()}));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width+1);
  expect(Math.abs(dimensions.toggle.left-dimensions.panel.right)).toBeLessThanOrEqual(3);

  const state=await page.evaluate(async()=>{
    mapEngine='amap';amapTrafficVisible=true;
    let switchCalls=0,visibilityCalls=0,detailCalls=0,restored=null;
    amapInstance={getCenter:()=>({lng:120.321,lat:36.071}),getZoom:()=>14,setZoomAndCenter:(zoom,center)=>{restored={zoom,center}}};
    switchToAmap=()=>{switchCalls++;return Promise.resolve(amapInstance)};
    amapSetTrafficVisible=enabled=>{visibilityCalls++;amapTrafficVisible=enabled};
    amapTrafficAtCenter=()=>{detailCalls++;return Promise.resolve()};
    amapSetStatus=()=>{};
    await toggleAmapTraffic();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return{switchCalls,visibilityCalls,detailCalls,restored};
  });
  expect(state).toEqual({switchCalls:0,visibilityCalls:1,detailCalls:0,restored:{zoom:14,center:[120.321,36.071]}});
  expect(pageErrors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('desktop-v2.png'),fullPage:false});
});

test('mobile controls and route overview stay inside the visual viewport',async({page},testInfo)=>{
  await openPreview(page);
  const geometry=await page.evaluate(()=>{
    const menu=document.getElementById('menuBtn').getBoundingClientRect();
    const base=document.querySelector('.basemap-control').getBoundingClientRect();
    const legend=document.getElementById('legend').getBoundingClientRect();
    const overlap=Math.max(0,Math.min(menu.right,base.right)-Math.max(menu.left,base.left))*Math.max(0,Math.min(menu.bottom,base.bottom)-Math.max(menu.top,base.top));
    return{overlap,legendBottom:legend.bottom,legendTop:legend.top,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
  });
  expect(geometry.overlap).toBe(0);
  expect(geometry.legendBottom).toBeLessThanOrEqual(geometry.height+1);
  expect(geometry.legendTop).toBeGreaterThanOrEqual(-1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);

  await page.locator('#menuBtn').click();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('panel').getBoundingClientRect().left)).toBeGreaterThanOrEqual(-1);
  await page.locator('#panelEdgeToggle').click();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('panel').getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  await page.screenshot({path:testInfo.outputPath('mobile-v2.png'),fullPage:false});
});
