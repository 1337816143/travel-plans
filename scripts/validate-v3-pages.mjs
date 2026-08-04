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
  release: 'qingdao-v3-phase4-sidecar-preview',
  status: 'review-required-preview',
  publicPath: '/travel-plans/v3/',
  stableEntry: '../index.html',
  stableVersion: 'v2.5.4',
  stableBaselineCommit: '95ecff2595c02cf550bada9ab5c318ee97768699',
  rollbackBranch: 'archive/v2.5.4-stable',
  serviceWorker: 'not-registered-by-v3',
};

for (const [key, value] of Object.entries(expectedMetadata)) {
  if (manifest[key] !== value) {
    throw new Error(`Unexpected v3 release manifest ${key}: ${manifest[key]}`);
  }
}
if (!Array.isArray(manifest.files) || manifest.files.length < 3) {
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
  'name="qingdao-deployment" content="v3-sidecar-preview"',
  'name="qingdao-stable-version" content="2.5.4"',
  '<title>青岛自由行 Lab · Phase 4</title>',
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

const deployedSource = manifest.files
  .filter((entry) => /\.(?:html|js|css)$/.test(entry.path))
  .map((entry) => fs.readFileSync(path.join(outputDirectory, entry.path), 'utf8'))
  .join('\n');
if (!deployedSource.includes('../index.html')) {
  throw new Error('The v3 package does not link back to the stable v2.5.4 root.');
}
if (!deployedSource.includes('review-required')) {
  throw new Error('The v3 package no longer exposes its review-required content boundary.');
}
if (/serviceWorker\s*\.\s*register\s*\(/.test(deployedSource)) {
  throw new Error('The v3 sidecar must not register a Service Worker.');
}

const rootHtml = fs.readFileSync(path.join(repositoryRoot, 'index.html'), 'utf8');
if (!rootHtml.includes('<meta name="travel-map-version" content="2.5.4">')) {
  throw new Error('The GitHub Pages root no longer serves v2.5.4.');
}
if (!rootHtml.includes("candidates=['2.5.4','1.0.15']")) {
  throw new Error('The GitHub Pages root lost the v1.0.15 fallback.');
}

console.log(
  `v3 Pages sidecar passed: /v3/ (${manifest.files.length} files) beside immutable v2.5.4 root`,
);
