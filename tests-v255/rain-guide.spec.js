import { expect, test } from '@playwright/test';

async function openOffline(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    return route.abort();
  });
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.eyebrow')).toContainText('v2.5.5');
  await page.evaluate(() => window.TravelAmapStartup?.hide?.());
  const mobileToggle = page.locator('.mobile-toggle');
  if (await mobileToggle.isVisible()) {
    await mobileToggle.click();
    await expect(page.locator('.panel')).toHaveClass(/open/);
  }
}

test('v2.5.5 adds a dedicated rain tab without changing the fixed itinerary', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openOffline(page);
  await expect(page.locator('[data-tab="rain"]')).toHaveText('雨天攻略');
  await page.locator('[data-tab="rain"]').click();
  await expect(page.locator('[data-panel="rain"]')).toHaveClass(/active/);
  await expect(page.locator('[data-panel="rain"]')).toContainText('固定行程不重排');
  await expect(page.locator('[data-panel="rain"]')).toContainText('小麦岛草坪看日落');
  await expect(page.locator('[data-panel="rain"]')).toContainText('笨蛤蜊地标小吃大排档');
  await expect(page.locator('[data-panel="rain"]')).toContainText('私人游艇避坑');
  await expect(page.locator('[data-panel="rain"]')).toContainText('沙子口休闲广场');
  await expect(page.locator('[data-panel="rain"]')).toContainText('Vya无涯coffee');
  await expect(page.locator('[data-panel="rain"]')).toContainText('青岛云上海天');
  const scheduleCount = await page.evaluate(() => SCHEDULES.length);
  expect(scheduleCount).toBe(8);
  expect(errors).toEqual([]);
});

test('v2.5.5 preserves screenshot advice but overrides unsafe mountain and coastal advice', async ({ page }) => {
  await openOffline(page);
  await page.locator('[data-tab="rain"]').click();
  await expect(page.locator('[data-panel="rain"]')).toContainText('青岛啤酒博物馆');
  await expect(page.locator('[data-panel="rain"]')).toContainText('第二海水浴场');
  await expect(page.locator('[data-panel="rain"]')).toContainText('北九水');
  await expect(page.locator('[data-panel="rain"]')).toContainText('中到大雨、雷暴、山洪地质风险时不去');
  await expect(page.locator('[data-panel="rain"]')).toContainText('天气风险提示 ≠ 官方封海状态');
});

test('v2.5.5 shows all nine beach rows with trip-specific time windows', async ({ page }) => {
  await openOffline(page);
  await page.locator('[data-tab="rain"]').click();
  const rows = page.locator('.beach-table tbody tr');
  await expect(rows).toHaveCount(9);
  await expect(rows.filter({ hasText: '第一海水浴场' })).toContainText('09:00–21:00');
  await expect(rows.filter({ hasText: '第一海水浴场' })).toContainText('09:00–18:00');
  await expect(rows.filter({ hasText: '第二海水浴场' })).toContainText('09:00–17:30');
  await expect(rows.filter({ hasText: '金沙滩海水浴场' })).toContainText('09:00–19:00');
  await expect(rows.filter({ hasText: '灵山湾海水浴场' })).toContainText('09:00–19:00');
  await expect(page.locator('.beach-live-rule')).toContainText('爱山东');
  await expect(page.locator('.beach-live-rule')).toContainText('点靓青岛');
});

test('rain panel is responsive and filters do not create page overflow', async ({ page }) => {
  await openOffline(page);
  await page.locator('[data-tab="rain"]').click();
  const geometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    panelWidth: document.querySelector('[data-panel="rain"]')?.getBoundingClientRect().width ?? 0,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
  expect(geometry.panelWidth).toBeGreaterThan(0);
  await page.getByRole('button', { name: '纯室内' }).click();
  await expect(page.locator('[data-rain-card]:visible')).not.toHaveCount(0);
  await page.getByRole('button', { name: '浴场封海' }).click();
  await expect(page.locator('[data-rain-section="beach"]')).toBeVisible();
});
