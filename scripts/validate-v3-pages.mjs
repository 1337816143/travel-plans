import console from 'node:console';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const outputDirectory = path.join(repositoryRoot, 'v3');
const manifestPath = path.join(outputDirectory, 'release-manifest.json');

if (!fs.existsSync(manifestPath)) {
  throw new Error('v3/release-manifest.json is missing; run npm run build:pages:v3 first.');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const expectedMetadata = {
  schemaVersion: 1,
  release: 'qingdao-v3-rain-contingency-planner-preview',
  status: 'review-required-preview',
  publicPath: '/travel-plans/v3/',
  stableEntry: '../index.html',
  embeddedStableEntry: '../index.html?embedded=v3',
  currentGuideVersion: 'v2.5.5',
  rollbackVersion: 'v2.5.4',
  stableBaselineCommit: '95ecff2595c02cf550bada9ab5c318ee97768699',
  rollbackBranch: 'archive/v2.5.4-stable',
  serviceWorker: 'v3-does-not-register; embedded-root-retains-current-worker',
  plannerBasemap: 'leaflet-real-wgs84-tiles',
};

for (const [key, value] of Object.entries(expectedMetadata)) {
  if (manifest[key] !== value) {
    throw new Error(`Unexpected v3 release manifest ${key}: ${manifest[key]}`);
  }
}
if (!Array.isArray(manifest.workspaces) || !manifest.workspaces.includes('rain-contingency')) {
  throw new Error('The v3 release manifest has no rain contingency workspace.');
}
if (manifest.rainGuide?.page !== 'rain.html' || manifest.rainGuide?.data !== 'rain-guide.json') {
  throw new Error('The v3 release manifest does not bind the shared rain guide.');
}
if (!Array.isArray(manifest.files) || manifest.files.length < 5) {
  throw new Error('The v3 release manifest has no deployable file inventory.');
}

for (const entry of manifest.files) {
  const absolutePath = path.join(outputDirectory, entry.path);
  if (!fs.existsSync(absolutePath) || !fs.lstatSync(absolutePath).isFile()) {
    throw new Error(`Manifest file is missing: v3/${entry.path}`);
  }
  const contents = fs.readFileSync(absolutePath);
  const sha256 = createHash('sha256').update(contents).digest('hex');
  if (contents.byteLength !== entry.bytes || sha256 !== entry.sha256) {
    throw new Error(`Manifest digest mismatch: v3/${entry.path}`);
  }
}

const html = fs.readFileSync(path.join(outputDirectory, 'index.html'), 'utf8');
for (const token of [
  'name="qingdao-deployment" content="v3-rain-contingency-planner-preview"',
  'name="qingdao-current-guide-version" content="2.5.5"',
  'name="qingdao-rollback-version" content="2.5.4"',
  '<title>青岛旅行规划 v3 · 完整版预览</title>',
]) {
  if (!html.includes(token)) throw new Error(`v3/index.html is missing ${token}`);
}
if (/\b(?:src|href)="\/(?:src|assets)\//.test(html)) {
  throw new Error('v3/index.html contains a root-absolute source or asset URL.');
}

const assetReferences = [...html.matchAll(/\b(?:src|href)="(\.\/assets\/[^"]+)"/g)].map(
  (match) => match[1],
);
if (assetReferences.length < 2) {
  throw new Error('v3/index.html must reference relative JavaScript and CSS assets.');
}
for (const reference of assetReferences) {
  const assetPath = path.join(outputDirectory, reference.slice(2));
  if (!fs.existsSync(assetPath)) throw new Error(`Referenced v3 asset is missing: ${reference}`);
}

const rainHtml = fs.readFileSync(path.join(outputDirectory, 'rain.html'), 'utf8');
const rainGuide = JSON.parse(fs.readFileSync(path.join(outputDirectory, 'rain-guide.json'), 'utf8'));
for (const token of ['雨天备用', '9处海水浴场', '北九水', '根站 v2.5.5']) {
  if (!rainHtml.includes(token)) throw new Error(`v3/rain.html is missing ${token}`);
}
if (rainGuide.beachStatus?.beaches?.length !== 9) {
  throw new Error('v3 rain guide must include all nine official bathing beaches.');
}
if (rainGuide.uploadedScreenshotGuide?.avoidOrLowValue?.length !== 12) {
  throw new Error('v3 rain guide lost the uploaded avoid list.');
}
if ((rainGuide.uploadedScreenshotGuide?.recommendedWithConditions?.length ?? 0) < 15) {
  throw new Error('v3 rain guide lost the uploaded recommendation list.');
}

const deployedSource = manifest.files
  .filter((entry) => /\.(?:html|js|css)$/.test(entry.path))
  .map((entry) => fs.readFileSync(path.join(outputDirectory, entry.path), 'utf8'))
  .join('\n');
if (!deployedSource.includes('../index.html')) {
  throw new Error('The v3 package does not link back to the current root guide.');
}
if (!deployedSource.includes('../index.html?embedded=v3')) {
  throw new Error('The v3 package does not embed the current complete root guide.');
}
if (!deployedSource.includes('rain.html')) {
  throw new Error('The v3 package does not expose the rain contingency page.');
}
if (!deployedSource.includes('data-real-basemap="true"')) {
  throw new Error('The v3 planner no longer declares its real Leaflet basemap surface.');
}
if (deployedSource.includes('无真实底图')) {
  throw new Error('The deployed v3 package regressed to a no-basemap preview.');
}
if (!deployedSource.includes('review-required')) {
  throw new Error('The v3 package no longer exposes its review-required content boundary.');
}
if (/serviceWorker\s*\.\s*register\s*\(/.test(deployedSource)) {
  throw new Error('The v3 sidecar must not register a Service Worker.');
}

const rootHtml = fs.readFileSync(path.join(repositoryRoot, 'index.html'), 'utf8');
if (!rootHtml.includes('<meta name="travel-map-version" content="2.5.5">')) {
  throw new Error('The GitHub Pages root no longer serves v2.5.5.');
}
if (!rootHtml.includes("candidates=['2.5.5','2.5.4','1.0.15']")) {
  throw new Error('The GitHub Pages root lost the v2.5.4 and v1.0.15 fallbacks.');
}

console.log(
  `v3 complete guide + rain contingency + planner passed: /v3/ (${manifest.files.length} files) beside v2.5.5 root with frozen v2.5.4 rollback`,
);
