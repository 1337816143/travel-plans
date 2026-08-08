import { expect, test } from '@playwright/test';

test('v3 exposes the rain contingency workspace from the main navigation', async ({ page }) => {
  await page.goto('./index.html', { waitUntil: 'domcontentloaded' });
  const entry = page.locator('[data-rain-guide-entry]');
  await expect(entry).toBeVisible();
  await expect(entry).toHaveText('雨天备用');
  await expect(entry).toHaveAttribute('href', './rain.html');
  await expect(page.locator('body')).toContainText('v2.5.5');
});

test('rain guide preserves uploaded recommendations and safety overrides', async ({ page }) => {
  await page.goto('./rain.html', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '新增到计划' })).toBeVisible();
  await expect(page.locator('body')).toContainText('小麦岛草坪看日落');
  await expect(page.locator('body')).toContainText('笨蛤蜊地标小吃大排档');
  await expect(page.locator('body')).toContainText('私人游艇避坑');
  await expect(page.locator('body')).toContainText('沙子口休闲广场');
  await expect(page.locator('body')).toContainText('Vya无涯coffee');
  await expect(page.locator('body')).toContainText('青岛云上海天');
  await expect(page.locator('body')).toContainText('北九水');
  await expect(page.locator('body')).toContainText('中到大雨、雷暴、山洪地质风险时不去');
  await expect(page.locator('body')).toContainText('门店/信息待核');
});

test('rain guide renders all nine official bathing beaches and exact trip windows', async ({
  page,
}) => {
  await page.goto('./rain.html', { waitUntil: 'networkidle' });
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(9);
  await expect(rows.filter({ hasText: '第一海水浴场' })).toContainText('09:00–21:00');
  await expect(rows.filter({ hasText: '第一海水浴场' })).toContainText('09:00–18:00');
  await expect(rows.filter({ hasText: '第二海水浴场' })).toContainText('09:00–17:30');
  await expect(rows.filter({ hasText: '石老人海水浴场' })).toContainText('09:00–18:00');
  await expect(rows.filter({ hasText: '金沙滩海水浴场' })).toContainText('09:00–19:00');
  await expect(rows.filter({ hasText: '灵山湾海水浴场' })).toContainText('09:00–19:00');
  await expect(page.locator('.live-rule')).toContainText('爱山东');
  await expect(page.locator('.live-rule')).toContainText('点靓青岛');
  await expect(page.locator('.live-rule')).toContainText(
    '未发现2026-08-08针对九处浴场的统一当日临时关闭公告',
  );
});

test('rain page remains usable on desktop and mobile without page-level horizontal overflow', async ({
  page,
}) => {
  await page.goto('./rain.html', { waitUntil: 'networkidle' });
  const geometry = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    tableScrollWidth: document.querySelector('.table-wrap')?.scrollWidth ?? 0,
    tableClientWidth: document.querySelector('.table-wrap')?.clientWidth ?? 0,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.tableScrollWidth).toBeGreaterThanOrEqual(geometry.tableClientWidth);
  await page.getByRole('button', { name: '纯室内' }).click();
  await expect(page.locator('[data-card]:visible')).not.toHaveCount(0);
  await expect(page.locator('[data-section="beach"]')).toBeHidden();
  await page.getByRole('button', { name: '浴场封海' }).click();
  await expect(page.locator('[data-section="beach"]')).toBeVisible();
});
