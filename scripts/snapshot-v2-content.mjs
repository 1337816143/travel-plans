import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import prettier from 'prettier';

const ROOT = process.cwd();
const BASELINE_COMMIT = '95ecff2595c02cf550bada9ab5c318ee97768699';
const SNAPSHOT_TIME = '2026-08-02T00:00:00+08:00';
const TARGET = path.join(ROOT, 'data/qingdao/content/imports/legacy-v2.5.4-content.v1.json');
const SOURCE_FILES = [
  'src-v2/data/generated/sources.js',
  'src-v2/data/generated/bookings.js',
  'src-v2/data/generated/hotels.js',
  'src-v2/data/generated/wishlist.js',
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function evaluateCanonicalContent() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox, {
    name: 'v2.5.4-content-snapshot',
    codeGeneration: { strings: false, wasm: false },
  });

  for (const sourceFile of SOURCE_FILES) {
    new vm.Script(read(sourceFile), { filename: sourceFile }).runInContext(context);
  }

  return {
    sources: JSON.parse(vm.runInContext('JSON.stringify(SOURCES)', context)),
    reservations: JSON.parse(vm.runInContext('JSON.stringify(BOOKINGS)', context)),
    hotels: JSON.parse(vm.runInContext('JSON.stringify(HOTELS)', context)),
    wishlist: JSON.parse(vm.runInContext('JSON.stringify(GIRLFRIEND_WISHLIST)', context)),
  };
}

function assertUniqueIds(values, label) {
  const ids = values.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} IDs are not unique`);
}

function buildSnapshot() {
  const canonical = evaluateCanonicalContent();
  assertUniqueIds(canonical.reservations, 'Reservation');
  assertUniqueIds(canonical.wishlist.attractions, 'Wishlist attraction');
  assertUniqueIds(canonical.wishlist.mapPoints, 'Wishlist map point');
  assertUniqueIds(canonical.wishlist.food, 'Wishlist item');

  return {
    schemaVersion: 1,
    createdAt: SNAPSHOT_TIME,
    updatedAt: SNAPSHOT_TIME,
    id: 'legacy-v2.5.4-content',
    sourceVersion: '2.5.4',
    sourceCommit: BASELINE_COMMIT,
    importMode: 'read-only-review-required',
    reviewStatus: 'review-required',
    sourceFiles: SOURCE_FILES,
    counts: {
      sources: canonical.sources.length,
      reservations: canonical.reservations.length,
      hotels: canonical.hotels.length,
      wishlistAttractions: canonical.wishlist.attractions.length,
      wishlistMapPoints: canonical.wishlist.mapPoints.length,
      wishlistItems: canonical.wishlist.food.length,
    },
    sources: canonical.sources,
    reservations: canonical.reservations,
    hotels: canonical.hotels,
    wishlist: {
      version: canonical.wishlist.version,
      title: canonical.wishlist.title,
      note: canonical.wishlist.note,
      attractions: canonical.wishlist.attractions,
      mapPoints: canonical.wishlist.mapPoints,
      items: canonical.wishlist.food,
      seafoodRule: canonical.wishlist.seafoodRule,
    },
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
  console.log('v2.5.4 content snapshot matches canonical source: 24 / 8 / 3 / 17 / 10 / 12');
} else {
  throw new Error(`Unsupported mode ${mode}; use --check or --write`);
}
