import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  LegacyV2RuntimePointBundleSchema,
  PlaceImportBundleSchema,
  migrateLegacyV2RuntimePointBundle,
  validationIssues,
} from '@qingdao/schema';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const importTime = '2026-08-01T00:00:00+08:00';

function fixture(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(`${repositoryRoot}${relativePath}`, 'utf8')) as unknown;
}

const runtimePointInput = fixture(
  'data/qingdao/places/imports/legacy-v2.5.4-runtime-points.v1.json',
);
const v2SchemaReportInput = fixture('DATA_SCHEMA_REPORT_v2.5.4.json');

describe('v2.5.4 runtime point read-only migration', () => {
  it('reconciles the canonical 39 + 10 = 49 counts with the v2 report', () => {
    const snapshot = LegacyV2RuntimePointBundleSchema.parse(runtimePointInput);
    const v2Report = v2SchemaReportInput as {
      counts: { points: number; wishlistMapPoints: number; runtimePoints: number };
    };

    expect(snapshot.counts).toEqual({
      primaryPoints: 39,
      wishlistMapPoints: 10,
      runtimePoints: 49,
    });
    expect(snapshot.counts.primaryPoints).toBe(v2Report.counts.points);
    expect(snapshot.counts.wishlistMapPoints).toBe(v2Report.counts.wishlistMapPoints);
    expect(snapshot.counts.runtimePoints).toBe(v2Report.counts.runtimePoints);
    expect(snapshot.sourceCommit).toBe('95ecff2595c02cf550bada9ab5c318ee97768699');
  });

  it('migrates all 49 IDs deterministically without publishing unreviewed facts', () => {
    const first = migrateLegacyV2RuntimePointBundle(runtimePointInput, { now: importTime });
    const second = migrateLegacyV2RuntimePointBundle(runtimePointInput, { now: importTime });

    expect(PlaceImportBundleSchema.parse(first)).toStrictEqual(first);
    expect(second).toStrictEqual(first);
    expect(first.places).toHaveLength(49);
    expect(new Set(first.places.map((place) => place.id)).size).toBe(49);
    expect(first.reviewStatus).toBe('review-required');
    expect(first.places.every((place) => place.reviewStatus === 'review-required')).toBe(true);
    expect(first.places.every((place) => place.dynamicObservations.length === 0)).toBe(true);
    expect(first.places.every((place) => place.sourceRefs[0]?.observedAt === null)).toBe(true);
    expect(first.places.every((place) => place.address === null)).toBe(true);
    expect(first.places.every((place) => place.recommendedDurationMinutes === null)).toBe(true);
  });

  it('preserves origin and exact final v2.5.4 wishlist corrections', () => {
    const migrated = migrateLegacyV2RuntimePointBundle(runtimePointInput, { now: importTime });
    const primary = migrated.places.filter((place) => place.legacyV2?.origin === 'primary');
    const wishlist = migrated.places.filter((place) => place.legacyV2?.origin === 'wishlist-map');
    const xiaomujia = migrated.places.find((place) => place.id === 'wishmap-xiaomujia');
    const yunnan = migrated.places.find((place) => place.id === 'wishmap-yunnan-noodle');

    expect(primary).toHaveLength(39);
    expect(wishlist).toHaveLength(10);
    expect(xiaomujia?.name).toBe('小木家韩式烤肉（漳州二路店）');
    expect(yunnan?.name).toBe('云南锅锅米线（漳州二路附近核店范围）');
    expect(yunnan?.legacyV2?.sourceUrl).toBeNull();
    expect(yunnan?.sourceRefs[0]?.url).toBe(yunnan?.legacyV2?.mapUrl);
  });

  it('classifies linked source tiers conservatively instead of calling every source government', () => {
    const migrated = migrateLegacyV2RuntimePointBundle(runtimePointInput, { now: importTime });
    const byId = new Map(migrated.places.map((place) => [place.id, place]));

    expect(byId.get('signal')?.sourceRefs[0]?.tier).toBe('government');
    expect(byId.get('holiday-inn')?.sourceRefs[0]?.tier).toBe('commercial-platform');
    expect(byId.get('yumingzui')?.sourceRefs[0]?.tier).toBe('map-platform');
    expect(byId.get('wishmap-yunnan-noodle')?.sourceRefs[0]?.tier).toBe('map-platform');
  });

  it('reports the duplicate runtime ID at the exact wishlist path', () => {
    const candidate = structuredClone(LegacyV2RuntimePointBundleSchema.parse(runtimePointInput));
    const duplicateId = candidate.primaryPoints[0]?.id;
    if (!duplicateId || !candidate.wishlistMapPoints[0]) throw new Error('fixture is incomplete');
    candidate.wishlistMapPoints[0].id = duplicateId;

    const result = LegacyV2RuntimePointBundleSchema.safeParse(candidate);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected duplicate ID validation to fail');
    expect(validationIssues(result.error)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '$.wishlistMapPoints[0].id', code: 'custom' }),
      ]),
    );
  });
});
