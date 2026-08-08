import { expect, test } from '@playwright/test';

async function openCompleteGuide(page) {
  await page.route('**/api.open-meteo.com/**', async (route) => {
    const times = [];
    const temperature = [];
    const apparent = [];
    const precipitation = [];
    const rain = [];
    const codes = [];
    const wind = [];
    const visibility = [];
    for (const day of ['10', '11', '12', '13', '14', '15', '16']) {
      for (let hour = 0; hour < 24; hour += 1) {
        times.push(`2026-08-${day}T${String(hour).padStart(2, '0')}:00`);
        temperature.push(27 + (hour % 4));
        apparent.push(29 + (hour % 3));
        precipitation.push(hour >= 12 && hour <= 17 ? 68 : 18);
        rain.push(hour >= 13 && hour <= 15 ? 1.2 : 0);
        codes.push(hour >= 13 && hour <= 15 ? 80 : 3);
        wind.push(14);
        visibility.push(9000);
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hourly: {
          time: times,
          temperature_2m: temperature,
          apparent_temperature: apparent,
          precipitation_probability: precipitation,
          rain,
          weather_code: codes,
          wind_speed_10m: wind,
          visibility,
        },
      }),
    });
  });
  await page.goto('./');
  await page.getByRole('button', { name: '完整攻略', exact: true }).click();
  const legacy = page.frameLocator('[data-testid="legacy-v2-frame"]');
  await expect(legacy.locator('#mapLoadingMask')).toBeHidden({ timeout: 15_000 });
  await legacy.locator('#basemapSelect').selectOption('osm');
  await expect(legacy.locator('#map')).not.toHaveClass(/leaflet-map-hidden/);
  await legacy.locator('body').evaluate(() => {
    window.TravelActualRoutes.setProvider(async ({ from, to, mode, index }) => {
      const start = window.TravelCoordinates.wgs84ToGcj02(from.lat, from.lng);
      const end = window.TravelCoordinates.wgs84ToGcj02(to.lat, to.lng);
      const mid = [(start[1] + end[1]) / 2 + 0.0005, (start[0] + end[0]) / 2 + 0.0004];
      return {
        distanceMeters: 1200 + index * 240,
        durationMinutes: 12 + index * 3,
        polyline: [
          [start[1], start[0]],
          mid,
          [end[1], end[0]],
        ],
        provider: `test-${mode}`,
        queriedAt: new Date().toISOString(),
        estimated: false,
      };
    });
  });
  return legacy;
}

test('v2.5.6 hides route metrics by default and loads actual route details on demand', async ({ page }) => {
  const legacy = await openCompleteGuide(page);
  await legacy.getByRole('tab', { name: '逐日行程' }).click();
  await legacy.locator('[data-day="08-11"] [data-day-focus="08-11"]').click();
  const details = legacy.locator('[data-v256-route-details="08-11"]');
  await expect(details).toBeHidden();
  await legacy.locator('[data-v256-route-toggle]').click();
  await expect(details).toBeVisible();
  await expect(details).toContainText('高德实际道路路线');
  await expect(details).toContainText('km');
  await expect(details).toContainText('分钟');
  await expect(details).not.toContainText('直线');
});

test('each day switches horizontally between original itinerary and nearby rain plan', async ({ page }) => {
  const legacy = await openCompleteGuide(page);
  await legacy.getByRole('tab', { name: '逐日行程' }).click();
  const card = legacy.locator('[data-day="08-11"]');
  await card.locator('summary').click();
  const pager = card.locator('.v256-day-plan-pager');
  await expect(pager).toBeVisible();
  const geometry = await pager.evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.width * 1.5);
  await card.getByRole('button', { name: '雨天备选' }).click();
  await expect(card).toContainText('青岛市博物馆');
  await expect
    .poll(() => pager.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(10);
});

test('double click on a time slot shows previous current next and actual route context', async ({ page }) => {
  const legacy = await openCompleteGuide(page);
  await legacy.getByRole('tab', { name: '逐日行程' }).click();
  const target = legacy.locator('[data-day="08-11"] .v256-time-focus[data-v256-point="xiaomai"]');
  await target.dblclick();
  const context = legacy.locator('#dayRouteCard .v256-route-context');
  await expect(context).toBeVisible();
  await expect(context).toContainText('当前');
  await expect(context).toContainText('小麦岛');
  await expect(context).toContainText('到达');
  await expect(context).toContainText('离开');
  await expect(context).toContainText('分钟');
});

test('selected-day hourly weather includes the full-day precipitation probability view', async ({ page }) => {
  const legacy = await openCompleteGuide(page);
  await legacy.getByRole('tab', { name: '逐日行程' }).click();
  await legacy.locator('[data-day="08-11"] [data-day-focus="08-11"]').click();
  await legacy.locator('#amapConfigBtn').click();
  await legacy.locator('[data-amap-tab="travel"]').click();
  await expect(legacy.locator('.v256-hourly-weather')).toBeVisible();
  await legacy.locator('[data-v256-hourly-refresh]').click();
  await expect(legacy.locator('#v256HourlyWeather')).toContainText('2026-08-11');
  await expect(legacy.locator('#v256HourlyWeather')).toContainText('降雨 68%');
  await expect(legacy.locator('.v256-hourly-scroll article')).toHaveCount(24);
});

test('official status and user additions are present without invented POIs', async ({ page }) => {
  const legacy = await openCompleteGuide(page);
  await legacy.getByRole('tab', { name: '雨天攻略' }).click();
  await expect(legacy.locator('.v256-status-panel')).toContainText('9处海水浴场');
  await expect(legacy.locator('.v256-status-panel')).toContainText('崂山风景区');
  await legacy.getByRole('tab', { name: '其他推荐' }).click();
  await expect(legacy.locator('.v256-leisure-panel')).toContainText('沙子口休闲广场');
  await expect(legacy.locator('.v256-leisure-panel')).toContainText('Vya无涯coffee');
  await expect(legacy.locator('.v256-leisure-panel')).toContainText('青岛云上海天');
  await legacy.getByRole('tab', { name: /美食/ }).click();
  await expect(legacy.locator('[data-v256-ben-geli]')).toContainText('笨蛤蜊地标小吃大排档');
  await expect(legacy.locator('[data-v256-ben-geli]')).toContainText('精确门店待核验');
});

test('mobile drawer swipes dates and focused point stays above the expanded drawer', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only interaction');
  const legacy = await openCompleteGuide(page);
  await legacy.getByRole('tab', { name: '逐日行程' }).click();
  await legacy.locator('[data-day="08-11"] [data-day-focus="08-11"]').click();
  const drawer = legacy.locator('#mobileRouteDrawer');
  await expect(drawer).toBeVisible();
  await drawer.locator('[data-drawer-state="half"]').click();
  await expect(drawer).toHaveAttribute('data-state', 'half');
  const content = drawer.locator('.mobile-drawer-content');
  await content.dispatchEvent('pointerdown', {
    pointerId: 42,
    pointerType: 'touch',
    clientX: 350,
    clientY: 300,
  });
  await content.dispatchEvent('pointerup', {
    pointerId: 42,
    pointerType: 'touch',
    clientX: 220,
    clientY: 304,
  });
  await expect(legacy.locator('#dayRouteCard')).toHaveAttribute('data-day', '08-12');
  await legacy.locator('body').evaluate(() => window.TravelLeisureBackups.focus('xiaomai'));
  await page.waitForTimeout(500);
  const geometry = await legacy.locator('body').evaluate(() => {
    const p = pointById('xiaomai');
    const mapRect = document.getElementById('map').getBoundingClientRect();
    const drawerRect = document.getElementById('mobileRouteDrawer').getBoundingClientRect();
    const pixel = map.latLngToContainerPoint([p.lat, p.lng]);
    return {
      pointY: pixel.y,
      unobscuredBottom: drawerRect.top - mapRect.top,
      cover: window.TravelMobileDaySwipe.drawerCover(),
    };
  });
  expect(geometry.cover).toBeGreaterThan(200);
  expect(geometry.pointY).toBeLessThan(geometry.unobscuredBottom - 12);
});
