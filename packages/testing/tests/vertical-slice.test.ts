import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { preparePlanningInput, PlanningInputError } from '@qingdao/domain';
import {
  IconManifestSchema,
  PlaceSchema,
  TripRequestSchema,
  UnsupportedSchemaVersionError,
  migrateLegacyV2Point,
  migrateTripRequest,
  validationIssues,
} from '@qingdao/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

function fixture(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(`${repositoryRoot}${relativePath}`, 'utf8')) as unknown;
}

const signalPlaceInput = fixture('data/qingdao/places/signal-hill-west-gate.v1.json');
const tripRequestInput = fixture('packages/testing/fixtures/minimal-trip-request.v1.json');
const legacySignalInput = fixture('packages/testing/fixtures/legacy-v2-signal-point.json');
const iconManifestInput = fixture('packages/icon-system/manifest.placeholder.json');

describe('Qingdao Phase 1 vertical slice', () => {
  it('validates one existing place and one minimal TripRequest', () => {
    const place = PlaceSchema.parse(signalPlaceInput);
    const request = TripRequestSchema.parse(tripRequestInput);
    const planningInput = preparePlanningInput({ places: [place], request });

    expect(place.id).toBe('signal');
    expect(place.location.coordinateSystem).toBe('WGS84');
    expect(request.selections).toEqual(
      expect.arrayContaining([expect.objectContaining({ placeId: 'signal', priority: 'must' })]),
    );
    expect(planningInput.selectedPlaces).toHaveLength(1);
    expect(planningInput.selectedPlaces[0]?.place.id).toBe('signal');
    expect(planningInput.effectiveDays).toBe(1);
    expect(planningInput.timezone).toBe('Asia/Shanghai');
  });

  it('prepares the same PlanningInput deterministically', () => {
    const first = preparePlanningInput({ places: [signalPlaceInput], request: tripRequestInput });
    const second = preparePlanningInput({ places: [signalPlaceInput], request: tripRequestInput });

    expect(second).toStrictEqual(first);
  });

  it('migrates the exact Legacy v2 signal point without claiming fresh review', () => {
    const migrated = migrateLegacyV2Point(legacySignalInput, {
      now: '2026-08-01T00:00:00+08:00',
      district: 'shinan',
      address: '青岛市市南区龙山路16号甲（西门）',
      aliases: ['信号山公园西门', '信号山观景路线'],
      recommendedDurationMinutes: 70,
    });

    expect(migrated.id).toBe('signal');
    expect(migrated.location).toEqual({
      lat: 36.065839,
      lng: 120.324916,
      coordinateSystem: 'WGS84',
    });
    expect(migrated.sourceRefs[0]?.reviewStatus).toBe('review-required');
    expect(migrated.sourceRefs[0]?.observedAt).toBeNull();
  });

  it('adds deterministic metadata to a registered v0 TripRequest shape', () => {
    const request = TripRequestSchema.parse(tripRequestInput);
    const v0Request: Record<string, unknown> = structuredClone(request);
    delete v0Request.schemaVersion;
    delete v0Request.createdAt;
    delete v0Request.updatedAt;

    const migrated = migrateTripRequest(v0Request, { now: '2026-08-02T00:00:00+08:00' });

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.createdAt).toBe('2026-08-02T00:00:00+08:00');
    expect(migrated.updatedAt).toBe('2026-08-02T00:00:00+08:00');
  });

  it('rejects unsupported future Schema versions', () => {
    const request = TripRequestSchema.parse(tripRequestInput);

    expect(() =>
      migrateTripRequest({ ...request, schemaVersion: 99 }, { now: request.updatedAt }),
    ).toThrow(UnsupportedSchemaVersionError);
  });

  it('reports a precise path for contradictory duplicate selections', () => {
    const request = TripRequestSchema.parse(tripRequestInput);
    const result = TripRequestSchema.safeParse({
      ...request,
      selections: [request.selections[0], request.selections[0]],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected TripRequest validation to fail');
    expect(validationIssues(result.error)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '$.selections[1].placeId', code: 'custom' }),
      ]),
    );
  });

  it('rejects a selected place that is absent from the planning data', () => {
    expect(() => preparePlanningInput({ places: [], request: tripRequestInput })).toThrow(
      PlanningInputError,
    );
  });

  it('keeps day derivation deterministic for every supported totalDays value', () => {
    const request = TripRequestSchema.parse(tripRequestInput);

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (totalDays) => {
        const candidate = { ...request, endDate: null, totalDays };
        const first = preparePlanningInput({ places: [signalPlaceInput], request: candidate });
        const second = preparePlanningInput({ places: [signalPlaceInput], request: candidate });

        expect(first.effectiveDays).toBe(totalDays);
        expect(second).toStrictEqual(first);
      }),
      { numRuns: 100 },
    );
  });

  it('validates a placeholder icon manifest with numbering kept separate', () => {
    const manifest = IconManifestSchema.parse(iconManifestInput);
    const ids = manifest.entries.map((entry) => entry.id);

    expect(manifest.numberingSeparated).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(manifest.entries.every((entry) => entry.status === 'placeholder')).toBe(true);
    expect(manifest.entries.every((entry) => entry.assets.length === 0)).toBe(true);
  });
});
