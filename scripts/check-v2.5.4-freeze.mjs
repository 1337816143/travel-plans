import console from 'node:console';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASELINE_COMMIT = '95ecff2595c02cf550bada9ab5c318ee97768699';
const ROLLBACK_BRANCH = 'archive/v2.5.4-stable';
const VERSION = '2.5.4';
const EXPECTED_HTML_SHA256 =
  '264fda8953fda2773cfe73f77372f20963ed0821acfa1701ac76bea872f2c027';
const EXPECTED_LAZY_SHA256 =
  '90b4c2af96fc3bb5745f20ec15f130d18a4282603263ea58894bbdbc2a87c5d8';
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts));
const text = (...parts) => read(...parts).toString('utf8');
const sha = (value) => createHash('sha256').update(value).digest('hex');

const source = read('src', 'v2.5.4.html');
if (sha(source) !== EXPECTED_HTML_SHA256) {
  throw new Error('Frozen v2.5.4 source HTML changed.');
}
const manifest = JSON.parse(text('assets', 'v2.5.4', 'manifest.json'));
if (
  manifest.version !== VERSION ||
  manifest.sha256 !== EXPECTED_HTML_SHA256 ||
  manifest.lazySha256 !== EXPECTED_LAZY_SHA256
) {
  throw new Error('Frozen v2.5.4 manifest identity changed.');
}
const chunks = ['payload-0.b64', 'payload-1.b64', 'payload-2.b64', 'payload-3.b64'].map((name) =>
  Buffer.from(text('assets', 'v2.5.4', name).replace(/\s+/g, ''), 'base64'),
);
const payload = gunzipSync(Buffer.concat(chunks));
if (!payload.equals(source)) {
  throw new Error('Frozen v2.5.4 payload no longer decodes to the frozen source.');
}
const lazy = read('assets', 'v2.5.4', 'lazy-tools.js');
if (sha(lazy) !== EXPECTED_LAZY_SHA256) {
  throw new Error('Frozen v2.5.4 lazy tools changed.');
}
const historical = text('versions', '2026-07-31-v2.5.4.html');
if (!historical.includes("candidates=['2.5.4']")) {
  throw new Error('Frozen v2.5.4 historical loader is not pinned.');
}
for (const file of [
  'src/v1.0.15.html',
  'versions/2026-07-27-v1.0.15.html',
  'assets/v1.0.15/payload-0.b64',
  'assets/v1.0.15/payload-1.b64',
  'assets/v1.0.15/payload-2.b64',
  'assets/v1.0.15/payload-3.b64',
]) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    throw new Error(`Stable v1.0.15 rollback asset missing: ${file}`);
  }
}

const report = {
  baselineCommit: BASELINE_COMMIT,
  rollbackBranch: ROLLBACK_BRANCH,
  version: VERSION,
  sourceSha256: EXPECTED_HTML_SHA256,
  lazySha256: EXPECTED_LAZY_SHA256,
  payloadChunks: 4,
  historicalPinned: true,
  productionRootMayAdvance: true,
};
if (process.argv.includes('--print')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(
    `v2.5.4 rollback artifact passed: ${ROLLBACK_BRANCH}@${BASELINE_COMMIT}, ${EXPECTED_HTML_SHA256}`,
  );
}
