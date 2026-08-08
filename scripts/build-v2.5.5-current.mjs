import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const basePath = path.join(ROOT, 'data/qingdao/rain/rain-guide.v1.json');
const opsPath = path.join(ROOT, 'data/qingdao/rain/current-ops-2026-08-08.json');
const original = fs.readFileSync(basePath, 'utf8');
const base = JSON.parse(original);
const ops = JSON.parse(fs.readFileSync(opsPath, 'utf8'));

const existingSources = Array.isArray(base.sourceNotes) ? base.sourceNotes : [];
const opsSources = Array.isArray(ops.sourceNotes) ? ops.sourceNotes : [];
const sourceKey = (item) => `${item.label ?? ''}|${item.url ?? ''}`;
const mergedSources = [...existingSources, ...opsSources].filter(
  (item, index, array) => array.findIndex((candidate) => sourceKey(candidate) === sourceKey(item)) === index,
);

const merged = {
  ...base,
  updatedAt: ops.checkedAt ?? base.updatedAt,
  forecastSnapshot: ops.forecastSnapshot ?? base.forecastSnapshot,
  additionalIndoorBackups:
    Array.isArray(ops.indoorBackups) && ops.indoorBackups.length > 0
      ? ops.indoorBackups
      : base.additionalIndoorBackups,
  sourceNotes: mergedSources,
};

try {
  fs.writeFileSync(basePath, `${JSON.stringify(merged, null, 2)}\n`);
  const result = spawnSync(process.execPath, ['scripts/build-v2.5.5.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  fs.writeFileSync(basePath, original);
}
