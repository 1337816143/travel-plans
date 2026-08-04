import console from 'node:console';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

const BASELINE_COMMIT = '95ecff2595c02cf550bada9ab5c318ee97768699';
const ROLLBACK_BRANCH = 'archive/v2.5.4-stable';
const EXPECTED_AGGREGATE_SHA256 =
  'b4f87f77477c5fe88354143978a0486075dff265d171bd31c8b2f304a30e5400';

const protectedPaths = [
  'index.html',
  'service-worker.js',
  'src-v2',
  'src/v2.5.4.html',
  'versions/2026-07-31-v2.5.4.html',
  'assets/v2.5.4',
  'src/v1.0.15.html',
  'versions/2026-07-27-v1.0.15.html',
  'assets/v1.0.15',
  'PAGES_SETUP.md',
  'DEPLOYMENT.md',
  'MIGRATION_V2.5.4.json',
  'DATA_SCHEMA_REPORT_v2.5.4.json',
  'BUNDLE_BUDGET_v2.5.4.json',
  'scripts/build-v2.mjs',
  'scripts/migrate-v2.5.4.mjs',
  'scripts/validate-v2.mjs',
  'scripts/validate-v2.5-practical.mjs',
  'scripts/validate-v1.0.11-payload.mjs',
  'scripts/validate-data-schema.mjs',
  'tests',
  'playwright.config.js',
];

function collectFiles(relativePath, output) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`v2.5.4 freeze path is missing: ${relativePath}`);
  }
  const stats = fs.lstatSync(absolutePath);
  if (stats.isSymbolicLink()) {
    throw new Error(`v2.5.4 freeze path must not be a symbolic link: ${relativePath}`);
  }
  if (stats.isFile()) {
    output.push(relativePath.split(path.sep).join('/'));
    return;
  }
  if (!stats.isDirectory()) {
    throw new Error(`Unsupported v2.5.4 freeze entry: ${relativePath}`);
  }
  for (const child of fs.readdirSync(absolutePath).sort()) {
    collectFiles(path.join(relativePath, child), output);
  }
}

const files = [];
for (const protectedPath of protectedPaths) collectFiles(protectedPath, files);
files.sort();

const aggregate = createHash('sha256');
for (const relativePath of files) {
  const contents = fs.readFileSync(path.join(repositoryRoot, relativePath));
  const fileHash = createHash('sha256').update(contents).digest('hex');
  aggregate.update(relativePath);
  aggregate.update('\0');
  aggregate.update(fileHash);
  aggregate.update('\n');
}
const actualAggregateSha256 = aggregate.digest('hex');

const rootHtml = fs.readFileSync(path.join(repositoryRoot, 'index.html'), 'utf8');
if (!rootHtml.includes('<meta name="travel-map-version" content="2.5.4">')) {
  throw new Error('The frozen root entry no longer identifies v2.5.4.');
}
if (!rootHtml.includes("candidates=['2.5.4','1.0.15']")) {
  throw new Error('The frozen v2.5.4 → v1.0.15 fallback order is missing.');
}

if (process.argv.includes('--print')) {
  console.log(
    JSON.stringify(
      {
        baselineCommit: BASELINE_COMMIT,
        rollbackBranch: ROLLBACK_BRANCH,
        fileCount: files.length,
        aggregateSha256: actualAggregateSha256,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (actualAggregateSha256 !== EXPECTED_AGGREGATE_SHA256) {
  throw new Error(
    `v2.5.4 production freeze changed: ${actualAggregateSha256} != ${EXPECTED_AGGREGATE_SHA256}`,
  );
}

console.log(
  `v2.5.4 production freeze passed: ${files.length} files, ${actualAggregateSha256}, ${ROLLBACK_BRANCH}@${BASELINE_COMMIT}`,
);
