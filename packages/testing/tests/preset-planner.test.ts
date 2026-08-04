import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  QINGDAO_CONTENT_CATALOG,
  classifyQingdaoPlace,
  missingQingdaoFacets,
} from '@qingdao/content';
import {
  DEFAULT_PLANNER_ASSUMPTIONS,
  PresetPlanningError,
  generateTripPlanFromPreset,
} from '@qingdao/planner';
import {
  PlaceSchema,
  TripRequestSchema,
  migrateLegacyV2RuntimePointBundle,
  type Place,
  type PresetPlan,
  type TripRequest,
} from '@qingdao/schema';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-02T08:00:00+08:00';

function fixture(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(`${repositoryRoot}${relativePath}`, 'utf8')) as unknown;
}

function qingdaoPlaces(): Place[] {
  const imported = migrateLegacyV2RuntimePointBundle(
    fixture('data/qingdao/places/imports/legacy-v2.5.4-runtime-points.v1.json'),
    { now: NOW },
  ).places;
  const curatedSignal = PlaceSchema.parse(
    fixture('data/qingdao/places/signal-hill-west-gate.v1.json'),
  );
  return imported.map((place) =>
    classifyQingdaoPlace(place.id === curatedSignal.id ? curatedSignal : place),
  );
}

function originalPreset(): PresetPlan {
  const preset = QINGDAO_CONTENT_CATALOG.presetPlans.find(
    (candidate) => candidate.originalV2EightDay,
  );
  if (!preset) throw new Error('original eight-day preset is missing');
  return preset;
}

function requestForPreset(preset: PresetPlan): TripRequest {
  const base = TripRequestSchema.parse(
    fixture('packages/testing/fixtures/minimal-trip-request.v1.json'),
  );
  const endDate = new Date(
    Date.parse(`${base.startDate}T00:00:00Z`) + (preset.totalDays - 1) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  return TripRequestSchema.parse({
    ...base,
    id: `request-${preset.id}`,
    name: preset.name,
    endDate,
    totalDays: preset.totalDays,
    selections: Object.entries(preset.selectionPriorities).map(([placeId, priority]) => ({
      placeId,
      priority,
      locked: false,
      notes: '',
    })),
  });
}

function context() {
  return {
    now: NOW,
    plannerVersion: '0.5.0-phase4',
    dataVersion: QINGDAO_CONTENT_CATALOG.dataVersion,
    assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
  } as const;
}

function generate(preset: PresetPlan, request = requestForPreset(preset)) {
  return generateTripPlanFromPreset({
    places: qingdaoPlaces(),
    request,
    preset,
    modules: QINGDAO_CONTENT_CATALOG.itineraryModules,
    context: context(),
  });
}

describe('Qingdao Phase 4 preset planner', () => {
  it('classifies all 49 existing places and reports service categories that are still missing', () => {
    const places = qingdaoPlaces();
    const missing = missingQingdaoFacets(places);

    expect(places).toHaveLength(49);
    expect(places.every((place) => place.facets.length > 0)).toBe(true);
    expect(missing).toEqual(
      expect.arrayContaining(['hospital', 'pharmacy', 'toilet', 'parking', 'charging-station']),
    );
  });

  it('restores the original eight-day themes and core route points as an editable plan', () => {
    const plan = generate(originalPreset());
    const dayPlaceIds = plan.days.map((day) =>
      day.items.flatMap((item) => (item.placeId === null ? [] : [item.placeId])),
    );

    expect(plan.days).toHaveLength(8);
    expect(dayPlaceIds[0]).toEqual(expect.arrayContaining(['hotel-zone']));
    expect(dayPlaceIds[1]).toEqual(expect.arrayContaining(['rent-zone', 'signal', 'zhanqiao']));
    expect(dayPlaceIds[2]).toEqual(
      expect.arrayContaining(['sculpture', 'sea-love', 'xiaomai', 'shilaoren']),
    );
    expect(dayPlaceIds[3]).toEqual(
      expect.arrayContaining(['xiaoyushan', 'qinyu', 'xiaoqingdao', 'badaguan']),
    );
    expect(dayPlaceIds[4]).toEqual(expect.arrayContaining(['dhedong', 'taiqing']));
    expect(dayPlaceIds[5]).toEqual(
      expect.arrayContaining(['tianmushan', 'golden', 'dayroom', 'yumingzui']),
    );
    expect(dayPlaceIds[6]).toEqual(
      expect.arrayContaining(['beer', 'yanerdao', 'aofan', 'mayfourth']),
    );
    expect(dayPlaceIds[7]).toEqual(expect.arrayContaining(['buffer']));
    expect(plan.reservationItemIds.length).toBeGreaterThan(0);
    expect(
      plan.days[4]?.items
        .filter((item) => item.placeId === 'taiqing' || item.placeId === 'dhedong')
        .every((item) => item.reservationIds.includes('reservation-laoshan-entry-check')),
    ).toBe(true);
    expect(plan.estimationNotes[0]).toContain('可编辑起点');
    expect(plan.editHistory).toEqual([]);
  });

  it('is deterministic for the same preset, request, versions and clock', () => {
    const preset = originalPreset();
    const request = requestForPreset(preset);

    expect(generate(preset, request)).toStrictEqual(generate(preset, request));
  });

  it('honors an explicit exclusion instead of silently restoring the point', () => {
    const preset = originalPreset();
    const request = requestForPreset(preset);
    const excluded = TripRequestSchema.parse({
      ...request,
      selections: request.selections.map((selection) =>
        selection.placeId === 'signal' ? { ...selection, priority: 'exclude' } : selection,
      ),
    });
    const plan = generate(preset, excluded);

    expect(plan.days.flatMap((day) => day.items).some((item) => item.placeId === 'signal')).toBe(
      false,
    );
    expect(plan.rejectedPlaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ placeId: 'signal', reasonCode: 'user-excluded' }),
      ]),
    );
  });

  it('emits an explainable conflict for a must place outside the preset modules', () => {
    const preset = originalPreset();
    const request = requestForPreset(preset);
    const withExtraMust = TripRequestSchema.parse({
      ...request,
      selections: [
        ...request.selections,
        {
          placeId: 'wishmap-laoshan-drinks',
          priority: 'must',
          locked: false,
          notes: '测试预设外必去项。',
        },
      ],
    });
    const plan = generate(preset, withExtraMust);

    expect(plan.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'must-not-scheduled', severity: 'error' }),
      ]),
    );
    expect(plan.rejectedPlaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placeId: 'wishmap-laoshan-drinks',
          reasonCode: 'preset-module-not-selected',
        }),
      ]),
    );
  });

  it('rejects a TripRequest whose duration disagrees with the preset', () => {
    const preset = originalPreset();
    const request = requestForPreset(preset);

    expect(() =>
      generate(preset, {
        ...request,
        endDate: null,
        totalDays: 7,
      }),
    ).toThrow(PresetPlanningError);
  });
});
