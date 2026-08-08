import { expect, test } from '@playwright/test';

test('shows canonical rainy-day additions, screenshot guidance and beach live-check boundaries', async ({
  page,
}) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('./');

  const trigger = page.getByRole('button', { name: /雨天专栏/ });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const panel = page.getByLabel('青岛雨天避坑和备用方案');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('小麦岛草坪看日落·吹海风·戴耳机听音乐');
  await expect(panel).toContainText('笨蛤蜊地标小吃大排档');
  await expect(panel).toContainText('沙子口休闲广场');
  await expect(panel).toContainText('Vya无涯coffee');
  await expect(panel).toContainText('青岛云上海天');
  await expect(panel).toContainText('私人游艇避坑');
  await expect(panel).toContainText('“青岛大虾”价格避坑');
  await expect(panel).toContainText('崂山白花蛇草水·只买一瓶尝鲜');

  await panel.getByRole('button', { name: '雨天可去' }).click();
  await expect(panel).toContainText('青岛科技馆');
  await expect(panel).toContainText('海信探索中心');
  await expect(panel).toContainText('北九水');
  await expect(panel).toContainText('中到大雨、雷暴、山洪地质风险时不去');

  await panel.getByRole('button', { name: '避坑' }).click();
  await expect(panel.locator('.rain-center-card.is-avoid')).toHaveCount(12);
  await expect(panel).toContainText('小麦岛');
  await expect(panel).toContainText('崂山风景区');

  await panel.getByRole('button', { name: '浴场封海' }).click();
  await expect(panel.locator('.rain-beach-table tbody tr')).toHaveCount(9);
  await expect(panel).toContainText('石老人海水浴场');
  await expect(panel).toContainText('0532-88899636');
  await expect(panel).toContainText('不等于九处均已被实时确认开放');
  await expect(panel).toContainText('爱山东');
  await expect(panel).toContainText('点靓青岛');

  expect(runtimeErrors).toEqual([]);
});

test('keeps the rainy-day drawer inside desktop and mobile viewports', async ({ page }) => {
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
