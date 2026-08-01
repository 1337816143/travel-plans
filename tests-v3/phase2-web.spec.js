import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /排成属于你的几天/ })).toBeVisible();
  await expect(page.locator('[data-testid="schedule-days"]')).toBeVisible();
});

test('shows the Phase 3 planner and produces desktop/mobile evidence', async ({
  page,
}, testInfo) => {
  await expect(page.locator('[data-testid="schedule-days"] [data-day]')).toHaveCount(2);
  await expect(page.locator('[data-testid="map-stage"] [data-map-item]')).toHaveCount(7);
  await expect(page.locator('[data-testid="route-segment"]')).toHaveCount(5);
  await expect(page.getByText('无真实底图', { exact: true })).toBeVisible();
  await expect(page.getByText('Logo', { exact: true })).toBeVisible();
  await expect(page.locator('.map-caption')).toContainText('独立编号');

  const screenshotDirectory = path.resolve('artifacts/v3-web');
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, `${testInfo.project.name}-overview.png`),
    fullPage: true,
  });
});

test('moves across days and keeps undo, redo, map numbering and routes synchronized', async ({
  page,
}) => {
  const firstDayCards = page.locator('[data-day="day-01"] [data-plan-item][draggable="true"]');
  const secondDayCards = page.locator('[data-day="day-02"] [data-plan-item][draggable="true"]');
  const firstDayCount = await firstDayCards.count();
  const secondDayCount = await secondDayCards.count();
  const movedTitle = await firstDayCards.first().locator('.item-copy strong').textContent();
  if (!movedTitle) throw new Error('cross-day source item is missing its title');

  await firstDayCards.first().getByRole('button', { name: '后一天' }).click();
  await expect(firstDayCards).toHaveCount(firstDayCount - 1);
  await expect(secondDayCards).toHaveCount(secondDayCount + 1);
  await expect(page.locator('[data-testid="app-status"]')).toContainText('第 1 天移至第 2 天');
  const movedCard = page
    .locator('[data-day="day-02"] [data-plan-item][draggable="true"]')
    .filter({ hasText: movedTitle });
  await expect(movedCard).toHaveCount(1);
  const movedItemId = await movedCard.getAttribute('data-plan-item');
  if (!movedItemId) throw new Error('cross-day move did not create a target item ID');
  await expect(
    page.locator(`[data-map-item="${movedItemId}"]`).locator('.marker-number text'),
  ).toHaveText(String(secondDayCount + 1));

  await page.getByRole('button', { name: /^撤销/ }).click();
  await expect(firstDayCards).toHaveCount(firstDayCount);
  await expect(secondDayCards).toHaveCount(secondDayCount);
  await expect(page.locator('[data-testid="app-status"]')).toContainText('已撤销');

  await page.getByRole('button', { name: /^重做/ }).click();
  await expect(firstDayCards).toHaveCount(firstDayCount - 1);
  await expect(secondDayCards).toHaveCount(secondDayCount + 1);
  await expect(page.locator('[data-testid="app-status"]')).toContainText('已重做');
  await expect(page.locator('[data-testid="route-segment"]')).toHaveCount(5);
});

test('regenerates from priorities and incrementally recalculates a move', async ({ page }) => {
  await page.locator('[data-field="total-days"]').selectOption('1');
  await page.locator('[data-priority-place="yanerdao"]').selectOption('exclude');
  await page.getByRole('button', { name: /重新生成我的日程/ }).click();

  await expect(page.locator('[data-testid="schedule-days"] [data-day]')).toHaveCount(1);
  await expect(page.locator('[data-testid="map-stage"] [data-map-item]')).toHaveCount(6);
  const cards = page.locator('[data-day="day-01"] [data-plan-item][draggable="true"]');
  const firstTitle = await cards.nth(0).locator('.item-copy strong').textContent();
  const firstItemId = await cards.nth(0).getAttribute('data-plan-item');
  if (!firstItemId) throw new Error('first schedule item is missing its stable ID');
  await cards.nth(0).getByRole('button', { name: '下移' }).click();

  await expect(cards.nth(1).locator('.item-copy strong')).toHaveText(firstTitle ?? '');
  await expect(page.locator('[data-testid="app-status"]')).toContainText('相邻交通段');
  await expect(
    page.locator(`[data-map-item="${firstItemId}"]`).locator('.marker-number text'),
  ).toHaveText('2');
});

test('saves, exports, reimports and rejects corrupt data atomically', async ({ page }) => {
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('[data-testid="app-status"]')).toContainText('保存到 IndexedDB');
  await expect(page.getByText('已存入 IndexedDB', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('download did not produce a local path');
  const exported = fs.readFileSync(downloadPath);

  await page.locator('[data-import-file]').setInputFiles({
    name: 'qingdao-phase3-plan.json',
    mimeType: 'application/json',
    buffer: exported,
  });
  await expect(page.locator('[data-testid="app-status"]')).toContainText('原子替换');

  const before = await page
    .locator('[data-plan-item][draggable="true"] .item-copy strong')
    .first()
    .textContent();
  const corrupt = JSON.parse(exported.toString('utf8'));
  corrupt.checksum = 'sha256-corrupt';
  await page.locator('[data-import-file]').setInputFiles({
    name: 'qingdao-corrupt-plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(corrupt)),
  });
  await expect(page.locator('[data-testid="app-status"]')).toContainText('当前计划保持不变');
  await expect(
    page.locator('[data-plan-item][draggable="true"] .item-copy strong').first(),
  ).toHaveText(before ?? '');
});

test('searches the Qingdao provider, adds a result, and creates a fully described custom POI', async ({
  page,
}) => {
  const cards = page.locator('[data-plan-item][draggable="true"]');
  const initialCount = await cards.count();
  await page.locator('[data-field="search-query"]').fill('海底世界');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('.provider-message').first()).toContainText('降级检索 49 个');
  const result = page.locator('[data-search-result]').filter({ hasText: '海底世界' }).first();
  await expect(result).toBeVisible();
  await result.getByRole('button', { name: '加入行程', exact: true }).click();
  await expect(cards).toHaveCount(initialCount + 1);
  await expect(page.locator('[data-testid="app-status"]')).toContainText('加入第');

  const form = page.locator('[data-custom-poi-form]');
  await form.locator('[name="name"]').fill('我的海边观景点');
  await form.locator('[name="alias"]').fill('自定义测试点');
  await form.locator('[name="recommendedDate"]').fill('2026-08-11');
  await form.locator('[name="arrivalTime"]').fill('16:30');
  await form.locator('[name="estimatedCost"]').fill('18.5');
  await form.locator('[name="reservation"]').fill('用户自行核验预约信息');
  await form.locator('[name="reminders"]').fill('带水\n注意大风');
  await form.locator('[name="detail"]').fill('用户自定义内容，不作为官方事实。');
  await form.getByRole('button', { name: '创建并加入所选日期' }).click();
  await expect(page.getByText('我的海边观景点', { exact: true })).toBeVisible();
  await expect(cards).toHaveCount(initialCount + 2);
  await expect(page.locator('[data-testid="app-status"]')).toContainText('加入第');
});

test('runs batch priority, separate Logo/custom numbering, route styling, accommodation and multi-plan flows', async ({
  page,
}) => {
  const checkboxes = page.locator('[data-batch-item]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  const selectedItemId = await checkboxes.nth(0).getAttribute('data-batch-item');
  if (!selectedItemId) throw new Error('batch selection did not expose its item ID');

  const priorityForm = page.locator('[data-batch-priority-form]');
  await priorityForm.locator('select[name="priority"]').selectOption('optional');
  await priorityForm.getByRole('button', { name: '设置优先级' }).click();
  await expect(page.locator('[data-testid="app-status"]')).toContainText('优先级设为 optional');

  const markerForm = page.locator('[data-marker-style-form]');
  await markerForm.locator('select[name="iconId"]').selectOption('placeholder-mountain');
  await markerForm.getByRole('button', { name: '应用 Logo' }).click();
  await expect(page.locator(`[data-map-item="${selectedItemId}"]`)).toHaveAttribute(
    'data-marker-icon',
    'placeholder-mountain',
  );

  const numberingForm = page.locator('[data-numbering-form]');
  await numberingForm.locator('select[name="mode"]').selectOption('custom');
  await numberingForm.locator(`input[name="customNumber:${selectedItemId}"]`).fill('海-A');
  await numberingForm.getByRole('button', { name: '同步编号' }).click();
  await expect(
    page.locator(`[data-map-item="${selectedItemId}"]`).locator('.marker-number text'),
  ).toHaveText('海-A');
  await expect(page.locator(`[data-map-item="${selectedItemId}"]`)).toHaveAttribute(
    'data-marker-icon',
    'placeholder-mountain',
  );

  const routeForm = page.locator('[data-route-style-form]');
  await routeForm.locator('input[name="color"]').fill('#ff765e');
  await routeForm.locator('select[name="pattern"]').selectOption('dotted');
  await routeForm.locator('select[name="arrowDirection"]').selectOption('both');
  await routeForm.locator('input[name="arrowSpacing"]').fill('48');
  await routeForm.getByRole('button', { name: /应用到所选地点相邻路线/ }).click();
  const styledRoute = page
    .locator('.map-route[data-route-style]:not([data-route-style=""])')
    .first();
  await expect(styledRoute).toHaveAttribute('stroke', '#ff765e');
  await expect(styledRoute).toHaveAttribute('data-arrow-spacing', '48');

  await page.getByRole('button', { name: '重新分析当前日程' }).click();
  await expect(page.locator('.accommodation-results article')).toHaveCount(3);
  await expect(page.locator('.accommodation-results .is-top-match')).toHaveCount(1);

  await page.getByRole('button', { name: '复制当前' }).click();
  await expect(page.locator('[data-testid="app-status"]')).toContainText('已复制为独立计划');
  await expect(page.locator('.plan-list article')).toHaveCount(2);
});
