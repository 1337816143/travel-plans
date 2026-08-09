/* global window */
import { expect, test } from '@playwright/test';

const requiredCheckins=[
  '琴屿路','海之恋Park','宫崎骏漫画墙','龙江路','黄岛鱼鸣嘴','黄岛站路牌','小鱼山','黄县路与黄县支路交汇口','福山支路','燕儿岛山公园','OHMO CAFE'
];
const requiredFood=['双合园','万和春','海平馄饨','宽哥烧烤海鲜大排档','hey妞酸奶','SOJU笑猪食堂','一抹崂山绿','班布大叔的店','WUYOO韩国冰奶冰茶咖啡'];

async function openCheckin(page){
  await page.goto('./checkin.html');
  await expect(page).toHaveTitle('青岛打卡机位 · v3');
  const legacy=page.frameLocator('iframe.frame');
  await expect(legacy.locator('#mapLoadingMask')).toBeHidden({timeout:15_000});
  await expect(legacy.locator('[data-panel="checkin"]')).toHaveClass(/active/);
  return legacy;
}

test('v2.5.7 and v3 ship the complete check-in data without fabricated search-only coordinates',async({request})=>{
  const root=await request.get('../index.html');
  expect(root.ok()).toBeTruthy();
  const html=await root.text();
  expect(html).toContain('<meta name="travel-map-version" content="2.5.7">');
  expect(html).toContain("candidates=['2.5.7','2.5.6','2.5.5','2.5.4','1.0.15']");
  const response=await request.get('./checkin-guide.json');
  expect(response.ok()).toBeTruthy();
  const data=await response.json();
  expect(data.routes.map(route=>route.name)).toEqual(expect.arrayContaining([
    expect.stringContaining('龙口路 → 龙江路 → 黄县路'),
    expect.stringContaining('福山支路 → 金口一路')
  ]));
  for(const name of requiredCheckins)expect(JSON.stringify(data.locations)).toContain(name);
  const sign=data.locations.find(item=>item.id==='huangdao-sign');
  expect(sign.searchOnly).toBe(true);expect(sign.lat).toBeUndefined();expect(sign.lng).toBeUndefined();
  const wuren=data.locations.find(item=>item.id==='wuren-shop');
  expect(wuren.priority).toBe(true);expect(wuren.searchOnly).toBe(true);
  const ohmo=data.locations.find(item=>item.id==='ohmo-cafe');
  expect(ohmo.priority).toBe(true);expect(ohmo.cameras.length).toBeGreaterThanOrEqual(2);
});

test('check-in tab shows every requested spot, highlighted routes and multiple camera positions',async({page})=>{
  const legacy=await openCheckin(page);
  const panel=legacy.locator('[data-panel="checkin"]');
  for(const name of requiredCheckins)await expect(panel).toContainText(name);
  await expect(panel).toContainText('五仁杂货铺');
  await expect(panel).toContainText('龙口路 → 龙江路 → 黄县路');
  await expect(panel).toContainText('福山支路 → 金口一路');
  await expect(panel.locator('.v257-priority')).toHaveCount(8);
  const qinyu=panel.locator('[data-v257-location-card="qinyu-checkin"]');
  await qinyu.locator('details').evaluate(element=>{element.open=true});
  await expect(qinyu.locator('.v257-camera')).toHaveCount(2);
  await expect(qinyu.locator('.v257-gallery').first().locator('a,span')).toHaveCount(3);
  const ohmo=panel.locator('[data-v257-location-card="ohmo-cafe"]');
  await expect(ohmo.locator('.v257-gallery').first().locator('img')).toHaveCount(3);
});

test('new photo routes and spots are integrated into the corresponding daily itinerary cards',async({page})=>{
  const legacy=await openCheckin(page);
  await legacy.getByRole('tab',{name:'逐日行程'}).click();
  const checks=[
    ['08-10','龙口路 → 龙江路 → 黄县路'],
    ['08-11','海之恋Park重点拍照'],
    ['08-12','福山支路 → 金口一路'],
    ['08-14','黄岛鱼鸣嘴重点'],
    ['08-14','OHMO CAFE'],
    ['08-15','燕儿岛山公园']
  ];
  for(const [date,text] of checks){const card=legacy.locator(`details.day-card[data-day="${date}"]`);await expect(card).toContainText(text);}
});

test('food additions, BBQ reference pool and delivery items are all present',async({page})=>{
  const legacy=await openCheckin(page);
  const foodTab=legacy.getByRole('tab',{name:/美食/});
  await foodTab.click();
  const panel=legacy.locator('[data-panel="food"]');
  for(const name of requiredFood)await expect(panel).toContainText(name);
  for(const name of ['东门韩国烤肉','本家韩国料理','火桶韩国烤肉','安三胖韩国烤肉','韩象','肉加韩国料理','小木家韩式烤肉','一心亭烤肉'])await expect(panel).toContainText(name);
  await expect(panel).toContainText('味乐通炸鸡');
  await expect(panel).toContainText('老西镇臭豆腐');
});

test('beach play distinguishes official bathing beaches from beach-only candidates',async({page})=>{
  const legacy=await openCheckin(page);
  const panel=legacy.locator('[data-panel="checkin"]');
  await expect(panel).toContainText('石老人海水浴场');
  await expect(panel).toContainText('第一海水浴场');
  await expect(panel).toContainText('即墨区滨海公园');
  await expect(panel).toContainText('月牙湾海滩');
  await expect(panel.locator('.v257-beach-type.official')).toHaveCount(2);
  await expect(panel.locator('.v257-beach-type.visit')).toHaveCount(2);
  await expect(panel).toContainText('沙滩可去 ≠ 允许下水');
});

test('camera map stays mobile-safe and search-only locations do not create fake markers',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.includes('mobile'),'mobile-only map interaction');
  const legacy=await openCheckin(page);
  const panel=legacy.locator('[data-panel="checkin"]');
  await panel.locator('[data-v257-focus="sea-love-checkin"]').click();
  await page.waitForTimeout(250);
  const geometry=await legacy.locator('body').evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:window.innerWidth,sign:window.TravelCheckinSpots.data.locations.find(item=>item.id==='huangdao-sign')}));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+2);
  expect(geometry.sign.searchOnly).toBe(true);
  expect(geometry.sign.lat).toBeUndefined();
  expect(geometry.sign.lng).toBeUndefined();
});
