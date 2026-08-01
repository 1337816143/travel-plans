import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import prettier from 'prettier';

const ROOT = process.cwd();
const BASELINE_COMMIT = '95ecff2595c02cf550bada9ab5c318ee97768699';
const SNAPSHOT_TIME = '2026-08-01T00:00:00+08:00';
const TARGET = path.join(ROOT, 'data/qingdao/places/imports/legacy-v2.5.4-runtime-points.v1.json');
const SOURCE_FILES = [
  'src-v2/data/generated/points.js',
  'src-v2/data/generated/wishlist.js',
  'src-v2/data/wishlist-map-points.js',
  'src-v2/data/food-precision-v2.5.4.js',
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function evaluateCanonicalRuntime() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox, {
    name: 'v2.5.4-runtime-point-snapshot',
    codeGeneration: { strings: false, wasm: false },
  });

  new vm.Script(read(SOURCE_FILES[0]), { filename: SOURCE_FILES[0] }).runInContext(context);
  const primaryIds = JSON.parse(
    vm.runInContext('JSON.stringify(POINTS.map((point) => point.id))', context),
  );

  for (const sourceFile of SOURCE_FILES.slice(1)) {
    new vm.Script(read(sourceFile), { filename: sourceFile }).runInContext(context);
  }

  const runtimePoints = JSON.parse(vm.runInContext('JSON.stringify(POINTS)', context));
  const wishlistMapPoints = JSON.parse(
    vm.runInContext('JSON.stringify(window.WISHLIST_MAP_POINTS)', context),
  );
  const primaryIdSet = new Set(primaryIds);
  const primaryPoints = runtimePoints.filter((point) => primaryIdSet.has(point.id));

  return { primaryPoints, wishlistMapPoints, runtimePoints };
}

function buildSnapshot() {
  const { primaryPoints, wishlistMapPoints, runtimePoints } = evaluateCanonicalRuntime();
  const expectedRuntimePoints = primaryPoints.length + wishlistMapPoints.length;
  const runtimeIds = runtimePoints.map((point) => point.id);

  if (runtimePoints.length !== expectedRuntimePoints) {
    throw new Error(
      `Runtime point count mismatch: ${runtimePoints.length} !== ${expectedRuntimePoints}`,
    );
  }
  if (new Set(runtimeIds).size !== runtimeIds.length) {
    throw new Error('Canonical v2.5.4 runtime point IDs are not unique');
  }

  return {
    schemaVersion: 1,
    createdAt: SNAPSHOT_TIME,
    updatedAt: SNAPSHOT_TIME,
    id: 'legacy-v2.5.4-runtime-points',
    sourceVersion: '2.5.4',
    sourceCommit: BASELINE_COMMIT,
    coordinateSystem: 'WGS84',
    importMode: 'read-only-review-required',
    sourceFiles: SOURCE_FILES,
    counts: {
      primaryPoints: primaryPoints.length,
      wishlistMapPoints: wishlistMapPoints.length,
      runtimePoints: runtimePoints.length,
    },
    primaryPoints,
    wishlistMapPoints,
  };
}

const prettierOptions = JSON.parse(read('.prettierrc.json'));
const expected = await prettier.format(JSON.stringify(buildSnapshot()), {
  ...prettierOptions,
  parser: 'json',
});
const mode = process.argv[2] ?? '--check';

if (mode === '--write') {
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, expected);
  console.log(`Wrote ${path.relative(ROOT, TARGET)}`);
} else if (mode === '--check') {
  if (!fs.existsSync(TARGET)) {
    throw new Error(`Missing ${path.relative(ROOT, TARGET)}; run with --write to create it`);
  }
  const actual = fs.readFileSync(TARGET, 'utf8');
  if (actual !== expected) {
    throw new Error(
      `${path.relative(ROOT, TARGET)} is stale; review canonical v2 changes and run with --write`,
    );
  }
  console.log('v2.5.4 runtime point snapshot matches canonical source: 39 + 10 = 49');
} else {
  throw new Error(`Unsupported mode ${mode}; use --check or --write`);
}
