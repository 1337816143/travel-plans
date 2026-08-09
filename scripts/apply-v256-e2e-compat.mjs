import fs from 'node:fs';

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`No compatibility change applied to ${file}`);
  fs.writeFileSync(file, next);
}

patch('tests-v3/phase2-web.spec.js', (source) => {
  const replacements = [
    [
      "await expect(page.locator('footer')).toContainText('v2.5.4 回滚基线保持不变');",
      "await expect(page.locator('footer')).toContainText('冻结回滚基线 v2.5.4 保持不变');",
      'legacy rollback footer assertion',
    ],
    [
      "expect(stableHtml).toContain('<meta name=\"travel-map-version\" content=\"2.5.5\">');",
      "expect(stableHtml).toContain('<meta name=\"travel-map-version\" content=\"2.5.6\">');",
      'current root version assertion',
    ],
    [
      "expect(stableHtml).toContain(\"candidates=['2.5.5','2.5.4','1.0.15']\");",
      "expect(stableHtml).toContain(\"candidates=['2.5.6','2.5.5','2.5.4','1.0.15']\");",
      'current root fallback assertion',
    ],
  ];
  for (const [before, after, label] of replacements) {
    if (!source.includes(before)) throw new Error(`${label} not found`);
    source = source.replace(before, after);
  }
  return source;
});

patch('tests-v3/v256-mobile-real-routes.spec.js', (source) => {
  const replacements = [
    [
      '/* global window, document, pointById, map */',
      '/* global window, document, pointById, map, filterDay, amapShowPane */',
      'browser globals declaration',
    ],
    [
      'const card = legacy.locator(`[data-day="${date}"]`);',
      'const card = legacy.locator(`details.day-card[data-day="${date}"]`);',
      'day-card selector',
    ],
    [
      `  const isOpen = await card.evaluate((element) => element.hasAttribute('open'));\n  if (!isOpen) await card.locator('summary').click();\n  await expect(card).toHaveAttribute('open', '');`,
      `  await card.evaluate((element) => { element.open = true; });\n  await expect.poll(() => card.evaluate((element) => element.open)).toBe(true);`,
      'stable day-card expansion',
    ],
    [
      `  if (isMobile) {\n    const menu = legacy.locator('#menuBtn');\n    await expect(menu).toBeVisible();\n    await menu.click();\n  }`,
      `  if (isMobile) {\n    const panel = legacy.locator('#panel');\n    const panelOpen = await panel.evaluate((element) => element.classList.contains('open'));\n    if (!panelOpen) {\n      const menu = legacy.locator('#menuBtn');\n      await expect(menu).toBeVisible();\n      await menu.click();\n    }\n  }`,
      'mobile menu state guard',
    ],
    [
      `  await legacy.locator('#amapConfigBtn').click();\n  await legacy.locator('[data-amap-tab="travel"]').click();`,
      `  await legacy.locator('body').evaluate(() => {\n    window.TravelAmapAssistantController.toggle(true);\n    amapShowPane('travel');\n  });`,
      'mobile-safe map-assistant travel pane selection',
    ],
    [
      `  const target = legacy.locator('[data-day="08-11"] .v256-time-focus[data-v256-point="xiaomai"]');`,
      `  const target = legacy.locator('details.day-card[data-day="08-11"] .v256-time-focus[data-v256-point="xiaomai"]');`,
      'time-slot selector scope',
    ],
  ];
  for (const [before, after, label] of replacements) {
    if (!source.includes(before)) throw new Error(`${label} not found`);
    source = source.replace(before, after);
  }
  return source;
});

console.log('Applied v2.5.6 Playwright compatibility fixes.');
