import fs from 'node:fs';

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`No compatibility change applied to ${file}`);
  fs.writeFileSync(file, next);
}

patch('tests-v3/phase2-web.spec.js', (source) => {
  const before = "await expect(page.locator('footer')).toContainText('v2.5.4 回滚基线保持不变');";
  const after = "await expect(page.locator('footer')).toContainText('冻结回滚基线 v2.5.4 保持不变');";
  if (!source.includes(before)) throw new Error('legacy rollback footer assertion not found');
  return source.replace(before, after);
});

patch('tests-v3/v256-mobile-real-routes.spec.js', (source) => {
  const before = '/* global window, document, pointById, map */';
  const after = '/* global window, document, pointById, map, filterDay */';
  if (!source.includes(before)) throw new Error('browser globals declaration not found');
  return source.replace(before, after);
});

console.log('Applied v2.5.6 Playwright compatibility fixes.');
