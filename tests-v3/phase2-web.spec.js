import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /排成属于你的几天/ })).toBeVisible();
  await expect(page.locator('[data-testid="schedule-days"]')).toBeVisible();
});

test('shows the Phase 2 planner and produces desktop/mobile evidence', async ({
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
    name: 'qingdao-phase2-plan.json',
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
