import console from 'node:console';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const sourceDirectory = path.join(repositoryRoot, 'apps/web/dist');
const outputDirectory = path.join(repositoryRoot, 'v3');

if (!fs.existsSync(path.join(sourceDirectory, 'index.html'))) {
  throw new Error('apps/web/dist is missing; run npm run build:web:v3 first.');
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.cpSync(sourceDirectory, outputDirectory, { recursive: true });
fs.copyFileSync(path.join(repositoryRoot, 'apps/web/rain.html'), path.join(outputDirectory, 'rain.html'));
fs.copyFileSync(
  path.join(repositoryRoot, 'data/qingdao/rain/rain-guide.v1.json'),
  path.join(outputDirectory, 'rain-guide.json'),
);

for (const name of fs.readdirSync(path.join(outputDirectory, 'assets'))) {
  const absolutePath = path.join(outputDirectory, 'assets', name);
  if (name.endsWith('.map')) {
    fs.rmSync(absolutePath);
    continue;
  }
  if (name.endsWith('.js')) {
    const source = fs.readFileSync(absolutePath, 'utf8');
    fs.writeFileSync(
      absolutePath,
      source.replace(/\n\/\/# sourceMappingURL=[^\n]+\s*$/, '\n').replace(/[ \t]+$/gm, ''),
    );
  }
}

function listFiles(directory, prefix = '') {
  const results = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const absolutePath = path.join(directory, name);
    const relativePath = path.posix.join(prefix, name);
    const stats = fs.lstatSync(absolutePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`The v3 Pages package must not contain symbolic links: ${relativePath}`);
    }
    if (stats.isDirectory()) results.push(...listFiles(absolutePath, relativePath));
    else if (stats.isFile()) results.push(relativePath);
  }
  return results;
}

const files = listFiles(outputDirectory).map((relativePath) => {
  const contents = fs.readFileSync(path.join(outputDirectory, relativePath));
  return {
    path: relativePath,
    bytes: contents.byteLength,
    sha256: createHash('sha256').update(contents).digest('hex'),
  };
});

const manifest = {
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
  workspaces: ['complete-v2.5.5-guide', 'rain-contingency', 'custom-planner'],
  plannerBasemap: 'leaflet-real-wgs84-tiles',
  rainGuide: {
    page: 'rain.html',
    data: 'rain-guide.json',
    source: 'data/qingdao/rain/rain-guide.v1.json',
  },
  files,
};

fs.writeFileSync(
  path.join(outputDirectory, 'release-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`Packaged v3 complete guide + rain contingency + planner: ${files.length} files → v3/`);
