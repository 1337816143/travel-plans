import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('青岛旅行规划 v3 · 完整版预览');
  await expect(page.locator('.phase-badge')).toHaveText('v3 · 完整版预览');
  await expect(page.locator('footer')).toContainText('完整攻略＋自定义规划');
  await expect(page.locator('footer')).toContainText('v2.5.4 回滚基线保持不变');
  await expect(page.getByRole('link', { name: '独立打开 v2.5.5' })).toHaveAttribute(
    'href',
    '../index.html',
  );
  await expect(page.locator('[data-testid="legacy-full-guide"]')).toBeVisible();
  await page.getByRole('button', { name: '自定义规划', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Phase 4 候选内容与完整编辑工具' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /在完整攻略之上/ })).toBeVisible();
  await expect(page.locator('[data-testid="schedule-days"]')).toBeVisible();
});

test('serves the exact complete v2.5.5 guide beside the custom planner', async ({
  page,
  request,
}, testInfo) => {
  const stableResponse = await request.get('../index.html');
  expect(stableResponse.ok()).toBeTruthy();
  const stableHtml = await stableResponse.text();
  expect(stableHtml).toContain('<meta name="travel-map-version" content="2.5.5">');
  expect(stableHtml).toContain("candidates=['2.5.5','2.5.4','1.0.15']");

  const previewResponse = await request.get('./');
  expect(previewResponse.ok()).toBeTruthy();
  const previewHtml = await previewResponse.text();
  expect(previewHtml).toContain(
    'name="qingdao-deployment" content="v3-rain-contingency-planner-preview"',
  );
  expect(previewHtml).toContain('<title>青岛旅行规划 v3 · 完整版预览</title>');

  await page.getByRole('button', { name: '完整攻略', exact: true }).click();
  await expect(page.locator('[data-testid="legacy-v2-frame"]')).toHaveAttribute(
    'src',
    '../index.html?embedded=v3',
  );
  const legacy = page.frameLocator('[data-testid="legacy-v2-frame"]');
  await expect(legacy.getByRole('tab', { name: '必约清单' })).toBeVisible();
  await expect(legacy.getByRole('tab', { name: '逐日行程' })).toBeVisible();
  await expect(legacy.getByRole('tab', { name: '住宿分析' })).toBeVisible();
  await expect(legacy.getByRole('tab', { name: '雨天攻略' })).toBeVisible();
  await expect(legacy.getByLabel('青岛旅行地图')).toBeAttached();
  await expect(legacy.getByLabel('高德地图')).toBeAttached();
  await expect(legacy.locator('#mapLoadingMask')).toBeHidden({ timeout: 15_000 });
  await expect(
    legacy.locator('#map:not(.leaflet-map-hidden), #amapMap.active').first(),
  ).toBeVisible();
  await legacy.locator('#basemapSelect').selectOption('osm');
  await expect(legacy.locator('#map')).not.toHaveClass(/leaflet-map-hidden/);
  await expect(legacy.locator('#map img.leaflet-tile-loaded').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(legacy.locator('#basemapState')).toContainText('OSM 标准 · 正常');

  const screenshotDirectory = path.resolve('artifacts/v3-web');
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, `${testInfo.project.name}-complete-guide.png`),
    fullPage: true,
  });
});

test('shows the Phase 4 planner and produces desktop/mobile evidence', async ({
  page,
}, testInfo) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await expect(page.locator('[data-testid="schedule-days"] [data-day]')).toHaveCount(2);
  await expect(page.locator('[data-testid="map-stage"] [data-map-item]')).toHaveCount(7);
  await expect(page.locator('[data-testid="route-segment"]')).toHaveCount(5);
  await expect(page.locator('[data-testid="map-stage"]')).toHaveAttribute(
    'data-real-basemap',
    'true',
  );
  const initialTileRequest = page.locator('[data-leaflet-map] img.leaflet-tile').first();
  await expect(initialTileRequest).toBeAttached();
  await expect(initialTileRequest).toHaveAttribute(
    'src',
    /(?:openstreetmap\.org|cartocdn\.com|openstreetmap\.fr|opentopomap\.org)/,
  );
  await expect(page.getByLabel('选择真实地图底图')).toHaveValue('carto-voyager');
  await expect(page.getByLabel('选择地图点位范围')).toHaveValue('all');
  await expect(page.locator('[data-map-catalog-place]')).toHaveCount(42);
  await expect(page.locator('[data-map-catalog-pane]')).toHaveCSS('z-index', '625');
  await expect(page.locator('.map-caption')).toContainText('真实地图瓦片');
  await expect(page.getByText('无真实底图', { exact: true })).toHaveCount(0);

  await page.getByLabel('选择真实地图底图').selectOption('osm');
  await expect(page.getByLabel('选择真实地图底图')).toHaveValue('osm');
  await expect(page.locator('[data-map-provider-state]')).toContainText('OSM 标准');
  const firstMarker = page.locator('[data-testid="map-stage"] [data-map-item]').first();
  const firstItemId = await firstMarker.getAttribute('data-map-item');
  if (!firstItemId) throw new Error('real map marker is missing its planner item ID');
  await firstMarker.click({ force: true });
  await expect(page.locator(`[data-plan-item="${firstItemId}"]`)).toHaveClass(/is-selected/);
  await expect(page.locator('.leaflet-popup-content')).toContainText('在高德地图中打开');

  await page.locator('.leaflet-popup-close-button').click();
  const clickableCatalogId = await page
    .locator('[data-map-catalog-place]')
    .evaluateAll((markers) => {
      for (const marker of [...markers].reverse()) {
        const bounds = marker.getBoundingClientRect();
        const target = marker.ownerDocument.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        );
        if (target === marker || marker.contains(target)) {
          return marker.getAttribute('data-map-catalog-place');
        }
      }
      return null;
    });
  expect(clickableCatalogId).not.toBeNull();
  const catalogMarker = page.locator(`[data-map-catalog-place="${String(clickableCatalogId)}"]`);
  await expect(catalogMarker).toBeVisible();
  await catalogMarker.click();
  const catalogPopup = page.locator('.leaflet-popup-content').filter({
    has: page.locator('[data-add-map-place]'),
  });
  await expect(catalogPopup).toBeVisible();
  await catalogPopup.locator('[data-add-map-place]').click();
  await expect(page.locator('[data-testid="map-stage"] [data-map-item]')).toHaveCount(8);
  await expect(page.locator('[data-map-catalog-place]')).toHaveCount(41);

  const screenshotDirectory = path.resolve('artifacts/v3-web');
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, `${testInfo.project.name}-overview.png`),
    fullPage: true,
  });

  let blockedTileRequests = 0;
  await page.route(
    /(?:tile\.openstreetmap\.org|basemaps\.cartocdn\.com|tile\.openstreetmap\.fr|tile\.opentopomap\.org)/,
    async (route) => {
      blockedTileRequests += 1;
      await route.abort('failed');
    },
  );
  await page.getByLabel('选择真实地图底图').selectOption('carto-dark');
  await expect(page.locator('[data-map-provider-state]')).toContainText('已停止自动重试', {
    timeout: 15_000,
  });
  await page.waitForTimeout(1_000);
  const settledRequestCount = blockedTileRequests;
  await page.waitForTimeout(1_000);
  expect(blockedTileRequests).toBe(settledRequestCount);
  expect(runtimeErrors).toEqual([]);
});

test('shows the governed Phase 4 catalog and opens the original eight-day preset for editing', async ({
  page,
}) => {
  const governance = page.locator('[data-testid="phase4-content-governance"]');
  await expect(governance).toContainText('49');
  await expect(governance).toContainText('17');
  await expect(page.locator('[data-testid="phase4-legacy-migration"]')).toContainText(
    '24 Legacy来源',
  );
  await expect(page.locator('[data-testid="phase4-legacy-migration"]')).toContainText('8 预约');
  await expect(page.locator('[data-testid="phase4-legacy-migration"]')).toContainText('3 酒店');
  await expect(page.locator('[data-testid="phase4-legacy-migration"]')).toContainText('17+12 愿望');
  await expect(page.locator('[data-testid="phase4-service-candidates"] > article')).toHaveCount(7);
  await expect(page.locator('[data-testid="phase4-service-candidates"]')).toContainText(
    '青岛市市立医院（东院）',
  );
  await expect(page.locator('[data-testid="phase4-service-candidates"]')).toContainText(
    '路线附近公共充电站（运行时查询）',
  );
  await expect(governance).toContainText('review-required');
  await expect(governance).toContainText('发布已被人工审核门禁阻止');
  await expect(page.locator('[data-testid="preset-grid"] > article')).toHaveCount(17);

  const original = page.locator('article[data-preset-id="preset-qingdao-original-v2-8d"]');
  await expect(original).toContainText('原版青岛 8 日舒适旅行方案');
  await original.getByRole('button', { name: '载入并生成' }).click();

  await expect(page.locator('[data-testid="schedule-days"] [data-day]')).toHaveCount(8);
  await expect(page.locator('[data-testid="app-status"]')).toContainText(
    '原版青岛 8 日舒适旅行方案',
  );
  await expect(page.locator('[data-day="day-02"]')).toContainText('信号山');
  await expect(page.locator('[data-day="day-07"]')).toContainText('五四广场');
  await expect(page.getByRole('button', { name: /^撤销/ })).toBeVisible();
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
  const totalDays = page.locator('[data-field="total-days"]');
  await expect(totalDays).toHaveAttribute('type', 'number');
  await expect(totalDays).not.toHaveAttribute('max', /.+/);
  await totalDays.fill('1');
  await totalDays.press('Tab');
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
  await expect(page.locator('[data-tool="search"] .provider-message')).toContainText(
    '降级检索 49 个',
  );
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
  await expect(
    page
      .locator('[data-plan-item]')
      .filter({ hasText: '我的海边观景点' })
      .locator('.item-copy strong'),
  ).toHaveText('我的海边观景点');
  await expect(cards).toHaveCount(initialCount + 2);
  await expect(page.locator('[data-testid="app-status"]')).toContainText('加入第');
});

test('runs batch priority, separate Logo/custom numbering, route styling, accommodation and multi-plan flows', async ({
  page,
}) => {
  const checkboxes = page.locator('[data-batch-item]');
  const selectedItemIds = await checkboxes.evaluateAll((inputs) =>
    inputs.slice(0, 2).map((input) => input.getAttribute('data-batch-item')),
  );
  for (const itemId of selectedItemIds) {
    if (!itemId) throw new Error('batch selection did not expose two item IDs');
    await page.locator(`[data-batch-item="${itemId}"]`).check();
  }
  const selectedItemId = selectedItemIds[0];
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
  await routeForm.locator('input[name="color"]').evaluate((input) => {
    input.value = '#ff765e';
  });
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
