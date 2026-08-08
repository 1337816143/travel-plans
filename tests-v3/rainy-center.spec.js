import { expect, test } from '@playwright/test';

test('opens the rainy-day center with new trip items, risk gates and nine official beach rows', async ({
  page,
}) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('./');
  const toggle = page.getByRole('button', { name: /雨天专栏/ });
  await expect(toggle).toBeVisible();
  await toggle.click();

  const panel = page.getByLabel('青岛雨天避坑和备用方案');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('小麦岛草坪 · 日落耳机时刻');
  await expect(panel).toContainText('笨蛤蜊地标小吃大排档');
  await expect(panel).toContainText('崂山区沙子口广场');
  await expect(panel).toContainText('Vya无涯coffee');
  await expect(panel).toContainText('青岛云上海天');
  await expect(panel).toContainText('私人游艇');
  await expect(panel).toContainText('168元/只');
  await expect(panel).toContainText('白花蛇草水');
  await expect(panel.locator('.rain-beach-table tbody tr')).toHaveCount(9);
  await expect(panel).toContainText('石老人海水浴场');
  await expect(panel).toContainText('0532-88899636');
  await expect(panel).toContainText('未发现封海公告”不等于“确认开放');
  await expect(panel.locator('.rain-level')).toHaveCount(3);
  await expect(panel.locator('.rain-place-card.tone-avoid')).not.toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

test('rainy center remains usable on desktop and flagship mobile widths', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /雨天专栏/ }).click();
  const panel = page.getByLabel('青岛雨天避坑和备用方案');
  const geometry = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
});

test('v2.5.5 compatibility page keeps frozen v2.5.4 underneath and exposes the same rain plan', async ({
  page,
}) => {
  await page.goto('../v2.5.5/');
  await expect(page).toHaveTitle('青岛旅行计划 v2.5.5 · 雨天兼容增强版');
  await expect(page.locator('.v255-frame')).toHaveAttribute('src', '../index.html?embedded=v2.5.5-rain');
  await expect(page.getByText('v2.5.4 本体未修改，可随时原样回退')).toBeVisible();
  await page.getByRole('button', { name: /雨天专栏/ }).click();
  const drawer = page.getByLabel('雨天避坑与备用方案');
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('小麦岛草坪 · 日落耳机时刻');
  await page.getByRole('button', { name: '浴场封海' }).click();
  await expect(drawer.locator('.rain-table tbody tr')).toHaveCount(9);
  await expect(drawer).toContainText('本次检索未发现8/8临时封海官方公告；不等于确认开放');
});
