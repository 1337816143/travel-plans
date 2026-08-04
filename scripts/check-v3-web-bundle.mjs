import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const assetsDirectory = path.join(repositoryRoot, 'apps/web/dist/assets');
const budgets = {
  javascript: 250 * 1024,
  stylesheet: 40 * 1024,
  total: 300 * 1024,
};

if (!fs.existsSync(assetsDirectory)) {
  throw new Error('apps/web/dist/assets is missing; run npm run build:web:v3 first');
}

const files = fs
  .readdirSync(assetsDirectory)
  .filter((file) => file.endsWith('.js') || file.endsWith('.css'))
  .sort();
const measured = files.map((file) => {
  const contents = fs.readFileSync(path.join(assetsDirectory, file));
  return {
    file,
    gzipBytes: gzipSync(contents, { level: 9 }).byteLength,
    kind: file.endsWith('.js') ? 'javascript' : 'stylesheet',
  };
});
const totals = measured.reduce(
  (result, entry) => ({
    ...result,
    [entry.kind]: result[entry.kind] + entry.gzipBytes,
    total: result.total + entry.gzipBytes,
  }),
  { javascript: 0, stylesheet: 0, total: 0 },
);

for (const [kind, budget] of Object.entries(budgets)) {
  if (totals[kind] > budget) {
    throw new Error(
      `v3 web ${kind} bundle exceeds budget: ${totals[kind]} bytes > ${budget} bytes gzip`,
    );
  }
}

console.log(
  `v3 web bundle budget passed: JS ${(totals.javascript / 1024).toFixed(1)} KiB, CSS ${(totals.stylesheet / 1024).toFixed(1)} KiB, total ${(totals.total / 1024).toFixed(1)} KiB gzip`,
);
