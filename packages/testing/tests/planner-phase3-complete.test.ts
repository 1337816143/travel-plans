import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildTripMapRenderModel } from '@qingdao/map-core';
import {
  DEFAULT_PLANNER_ASSUMPTIONS,
  addCustomPoiToDay,
  addItineraryModuleToDay,
  analyzeAccommodationAreas,
  createPlannerHistoryState,
  generateTripPlan,
  persistPlannerHistory,
  recordPlannerEdit,
  removeItems,
  restoreRemovedItems,
  setItemsLocked,
  setItemsMarkerStyle,
  setItemsPriority,
  setMarkerNumbering,
  setRouteStyleForSegments,
  undoPlannerEdit,
} from '@qingdao/planner';
import {
  AmapJsPlaceSearchProvider,
  CuratedQingdaoSearchProvider,
  gcj02ToWgs84,
} from '@qingdao/providers';
import {
  AccommodationAreaCandidateSchema,
  CustomPoiSchema,
  MarkerNumberingSettingsSchema,
  MarkerStyleSchema,
  PlaceSchema,
  PlaceSearchQuerySchema,
  RouteStyleSchema,
  StoredPlanCollectionSchema,
  TripRequestSchema,
  migrateLegacyV2RuntimePointBundle,
  type Place,
  type TripPlan,
} from '@qingdao/schema';
import { InMemoryPlanStorage, type StorageResult } from '@qingdao/storage';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-01T10:00:00+08:00';

function fixture(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(`${repositoryRoot}${relativePath}`, 'utf8')) as unknown;
}

function places(): Place[] {
  const imported = migrateLegacyV2RuntimePointBundle(
    fixture('data/qingdao/places/imports/legacy-v2.5.4-runtime-points.v1.json'),
    { now: NOW },
  ).places;
  const signal = PlaceSchema.parse(fixture('data/qingdao/places/signal-hill-west-gate.v1.json'));
  return imported.map((place) => (place.id === signal.id ? signal : place));
}

function request() {
  const base = TripRequestSchema.parse(
    fixture('packages/testing/fixtures/minimal-trip-request.v1.json'),
  );
  return TripRequestSchema.parse({
    ...base,
    id: 'phase3-complete-request',
    name: '青岛 Phase 3 完整编辑计划',
    endDate: '2026-08-12',
    totalDays: 3,
    selections: [
      { placeId: 'signal', priority: 'must', locked: false, notes: '' },
      { placeId: 'zhanqiao', priority: 'must', locked: false, notes: '' },
      { placeId: 'xiaoyushan', priority: 'want', locked: false, notes: '' },
      { placeId: 'beer', priority: 'want', locked: false, notes: '' },
      { placeId: 'mayfourth', priority: 'want', locked: false, notes: '' },
      { placeId: 'yanerdao', priority: 'optional', locked: false, notes: '' },
    ],
  });
}

function context(now = NOW) {
  return {
    now,
    plannerVersion: '0.4.0-phase3',
    dataVersion: 'legacy-v2.5.4-review-required',
    assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
  } as const;
}

function plan(): TripPlan {
  return generateTripPlan({ places: places(), request: request(), context: context() });
}

function unwrap<T>(result: StorageResult<T>): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe('Qingdao Phase 3 complete editor domain', () => {
  it('adds a custom POI, persists explicit review boundaries, and can undo after reload', async () => {
    const original = plan();
    const allPlaces = places();
    const customPoi = CustomPoiSchema.parse({
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
      id: 'custom-sea-cafe',
      name: '自定义海边咖啡点',
      alias: '',
      address: '青岛市市南区测试地址',
      location: { lat: 36.06, lng: 120.39, coordinateSystem: 'WGS84' },
      category: 'custom',
      iconId: 'placeholder-coffee',
      color: '#14a9a3',
      priority: 'want',
      recommendedDate: null,
      arrivalTime: null,
      durationMinutes: 60,
      openingHours: '',
      estimatedCost: null,
      notes: '用户输入，待核验。',
      detail: '不自动生成营业状态。',
      reservation: '',
      reminders: [],
      sourceUrls: [],
      participatesInPlanning: true,
      locked: false,
      planB: false,
    });
    const targetDay = original.days[1];
    if (!targetDay) throw new Error('expected target day');
    const added = addCustomPoiToDay({
      plan: original,
      places: allPlaces,
      customPoi,
      dayId: targetDay.id,
      toPlaceIndex: targetDay.items.filter((item) => item.kind === 'place').length,
      commandId: 'phase3-add-custom',
      context: context('2026-08-01T10:01:00+08:00'),
    });
    expect(added.result.plan.customPois).toEqual([
      expect.objectContaining({ id: customPoi.id, openingHours: '' }),
    ]);
    expect(added.place.reviewStatus).toBe('review-required');
    expect(added.place.sourceRefs[0]).toEqual(
      expect.objectContaining({ confidence: 0.35, independentEvidenceCount: 0 }),
    );
    const history = recordPlannerEdit(createPlannerHistoryState(), original, added.result);
    const persisted = persistPlannerHistory(added.result.plan.id, history, NOW);
    const collection = StoredPlanCollectionSchema.parse({
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
      id: 'phase3-collection',
      plans: [original],
      snapshots: [],
      archivedPlanIds: [],
      deletedPlanIds: [],
    });
    const storage = new InMemoryPlanStorage(collection, {
      now: () => '2026-08-01T10:02:00+08:00',
      appVersion: '0.4.0',
      dataVersion: 'legacy-v2.5.4-review-required',
      checksum: (value) => `sha-${JSON.stringify(value).length}`,
    });
    unwrap(
      await storage.saveWorkspace(added.result.plan, persisted, {
        expectedUpdatedAt: original.updatedAt,
      }),
    );
    const reloadedPlan = unwrap(await storage.getPlan(original.id));
    const reloadedHistory = unwrap(await storage.getPlanHistory(original.id));
    const undone = undoPlannerEdit({
      plan: reloadedPlan,
      history: createPlannerHistoryState(reloadedHistory),
      context: context('2026-08-01T10:03:00+08:00'),
    });
    expect(undone.plan.placeIds).toStrictEqual(original.placeIds);
    expect(undone.plan.customPois).toStrictEqual(original.customPois);
  });

  it('keeps Logo, numbering and route appearance independent from route calculation', () => {
    const original = plan();
    const item = original.days[0]?.items.find((candidate) => candidate.kind === 'place');
    if (!item) throw new Error('expected item');
    const markerStyle = MarkerStyleSchema.parse({
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
      id: 'marker-mountain-coral',
      iconId: 'placeholder-mountain',
      color: '#ff765e',
      numberingMode: 'per-day',
      startNumber: 1,
      customNumber: null,
      scaleWithMap: true,
      clusterShowsCount: true,
      state: 'pending',
    });
    const styledMarker = setItemsMarkerStyle({
      plan: original,
      itemIds: [item.id],
      style: markerStyle,
      commandId: 'marker-style-command',
      context: context(),
    }).plan;
    const numbered = setMarkerNumbering({
      plan: styledMarker,
      settings: MarkerNumberingSettingsSchema.parse({
        schemaVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        mode: 'day-prefixed',
        startNumber: 3,
        customNumbers: {},
      }),
      commandId: 'numbering-command',
      context: context(),
    }).plan;
    const routeStyle = RouteStyleSchema.parse({
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
      id: 'route-coral-dotted',
      color: '#ff765e',
      width: 6,
      opacity: 0.8,
      pattern: 'dotted',
      arrowsVisible: true,
      arrowDirection: 'forward',
      arrowSize: 8,
      arrowSpacing: 64,
      startMarkerStyleId: null,
      endMarkerStyleId: null,
      zIndex: 2,
      visible: true,
      scope: 'segment',
    });
    const segmentIds = numbered.days.flatMap((day) =>
      day.routeSegments.map((segment) => segment.id),
    );
    const beforeMetrics = numbered.days.flatMap((day) =>
      day.routeSegments.map(({ id, distanceMeters, durationMinutes, polyline, provider }) => ({
        id,
        distanceMeters,
        durationMinutes,
        polyline,
        provider,
      })),
    );
    const routeStyled = setRouteStyleForSegments({
      plan: numbered,
      segmentIds,
      style: routeStyle,
      commandId: 'route-style-command',
      context: context(),
    }).plan;
    const afterMetrics = routeStyled.days.flatMap((day) =>
      day.routeSegments.map(({ id, distanceMeters, durationMinutes, polyline, provider }) => ({
        id,
        distanceMeters,
        durationMinutes,
        polyline,
        provider,
      })),
    );
    expect(afterMetrics).toStrictEqual(beforeMetrics);
    expect(
      routeStyled.days[0]?.items.find((candidate) => candidate.id === item.id)?.mapNumber,
    ).toBe('D1-3');
    const map = buildTripMapRenderModel({ plan: routeStyled, places: places() });
    expect(map.markers.find((marker) => marker.itemId === item.id)).toEqual(
      expect.objectContaining({ iconId: 'placeholder-mountain', mapNumber: 'D1-3' }),
    );
    expect(map.routes[0]?.style).toEqual(
      expect.objectContaining({ color: '#ff765e', pattern: 'dotted', width: 6 }),
    );

    const customNumbered = setMarkerNumbering({
      plan: routeStyled,
      settings: MarkerNumberingSettingsSchema.parse({
        schemaVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        mode: 'custom',
        startNumber: 1,
        customNumbers: { [item.id]: '海-A' },
      }),
      commandId: 'custom-number-command',
      context: context(),
    }).plan;
    expect(
      customNumbered.days[0]?.items.find((candidate) => candidate.id === item.id)?.mapNumber,
    ).toBe('海-A');
    expect(
      customNumbered.days[0]?.items.find((candidate) => candidate.id === item.id)?.markerStyleId,
    ).toBe(markerStyle.id);
  });

  it('changes priority in a reversible batch command without moving or unlocking items', () => {
    const original = plan();
    const selected = original.days
      .flatMap((day) => day.items)
      .filter((item) => item.kind === 'place')
      .slice(0, 2);
    const beforeLocations = selected.map((item) => ({ id: item.id, dayId: item.dayId }));
    const edited = setItemsPriority({
      plan: original,
      itemIds: selected.map((item) => item.id),
      priority: 'optional',
      commandId: 'batch-priority-command',
      context: context('2026-08-01T10:03:30+08:00'),
    });
    expect(edited.command.type).toBe('batch-set-priority');
    expect(
      edited.plan.request.selections
        .filter((selection) => selected.some((item) => item.placeId === selection.placeId))
        .every((selection) => selection.priority === 'optional'),
    ).toBe(true);
    expect(
      edited.plan.days
        .flatMap((day) => day.items)
        .filter((item) => selected.some((selectedItem) => selectedItem.placeId === item.placeId))
        .every((item) => item.optional),
    ).toBe(true);
    expect(
      edited.plan.days.flatMap((day) =>
        day.items.flatMap((item) =>
          selected.some((selectedItem) => selectedItem.placeId === item.placeId)
            ? [{ id: item.id, dayId: item.dayId }]
            : [],
        ),
      ),
    ).toStrictEqual(beforeLocations);
  });

  it('deletes and restores reversibly while respecting locks', () => {
    const original = plan();
    const day = original.days.find(
      (candidate) => candidate.items.filter((item) => item.kind === 'place').length >= 2,
    );
    const item = day?.items.filter((candidate) => candidate.kind === 'place').at(-1);
    if (!day || !item) throw new Error('expected removable item');
    const removed = removeItems({
      plan: original,
      places: places(),
      itemIds: [item.id],
      mode: 'deleted',
      commandId: 'remove-command',
      context: context('2026-08-01T10:04:00+08:00'),
    });
    expect(removed.plan.placeIds).not.toContain(item.placeId);
    expect(removed.plan.removedItems).toHaveLength(1);
    const restored = restoreRemovedItems({
      plan: removed.plan,
      places: places(),
      removedItemIds: [removed.plan.removedItems[0]?.id ?? ''],
      commandId: 'restore-command',
      context: context('2026-08-01T10:05:00+08:00'),
    });
    expect(restored.plan.placeIds.sort()).toStrictEqual([...original.placeIds].sort());
    expect(restored.plan.removedItems).toHaveLength(0);
    const locked = setItemsLocked({
      plan: restored.plan,
      itemIds: [restored.focusItemId ?? ''],
      locked: true,
      commandId: 'lock-command',
      context: context(),
    }).plan;
    expect(() =>
      removeItems({
        plan: locked,
        places: places(),
        itemIds: [restored.focusItemId ?? ''],
        mode: 'deleted',
        commandId: 'locked-remove',
        context: context(),
      }),
    ).toThrow(/锁定/);
  });

  it('applies an editable itinerary module without rebuilding unrelated days', () => {
    const original = plan();
    const target = original.days[0];
    const unaffected = original.days[2];
    if (!target || !unaffected) throw new Error('expected days');
    const applied = addItineraryModuleToDay({
      plan: original,
      places: places(),
      moduleId: 'rainy-module',
      moduleName: '雨天室内替代',
      placeIds: ['underwater', 'naval'],
      dayId: target.id,
      commandId: 'module-command',
      context: context('2026-08-01T10:06:00+08:00'),
    });
    expect(applied.command.type).toBe('apply-itinerary-module');
    expect(applied.plan.placeIds).toEqual(expect.arrayContaining(['underwater', 'naval']));
    expect(applied.plan.days[2]).toStrictEqual(unaffected);
  });

  it('ranks accommodation areas using explicit straight-line estimates only', () => {
    const original = plan();
    const allPlaces = places();
    const anchors = ['rent-zone', 'hotel-zone', 'shilaoren'].map((id, index) => {
      const anchor = allPlaces.find((place) => place.id === id);
      if (!anchor) throw new Error(`missing ${id}`);
      return AccommodationAreaCandidateSchema.parse({
        schemaVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        id: `area-${index}`,
        name: anchor.name,
        districtLabel: anchor.district,
        center: anchor.location,
        description: '测试候选区域。',
        strengths: [],
        tradeoffs: [],
        sourceRefIds: anchor.sourceRefs.map((source) => source.id),
      });
    });
    const result = analyzeAccommodationAreas({
      plan: original,
      places: allPlaces,
      candidates: anchors,
      commandId: 'accommodation-command',
      context: context(),
    });
    expect(result.analysis.method).toBe('weighted-straight-line-area-comparison');
    expect(result.analysis.estimated).toBe(true);
    expect(result.analysis.scores.map((score) => score.rank).sort()).toStrictEqual([1, 2, 3]);
    expect(result.analysis.warnings.join(' ')).toContain('不显示为道路距离');
  });
});

describe('Phase 3 place search and coordinate boundary', () => {
  it('searches all curated Qingdao points without pretending to be AMap', async () => {
    const provider = new CuratedQingdaoSearchProvider(places());
    const result = await provider.search(
      PlaceSearchQuerySchema.parse({
        schemaVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        id: 'offline-search',
        keyword: '石老人',
        city: '青岛',
        center: null,
        limit: 8,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.provider).toBe('qingdao-curated-offline');
    expect(result.data.degraded).toBe(true);
    expect(result.data.candidates[0]?.providerPlaceId).toBe('shilaoren');
  });

  it('normalizes runtime AMap GCJ-02 coordinates to explicit WGS84', async () => {
    const provider = new AmapJsPlaceSearchProvider({
      search: () =>
        Promise.resolve([
          {
            id: 'amap-poi-1',
            name: '高德候选点',
            address: '青岛市市南区',
            lat: 36.067,
            lng: 120.382,
            type: '风景名胜',
          },
        ]),
    });
    const result = await provider.search(
      PlaceSearchQuerySchema.parse({
        schemaVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        id: 'amap-search',
        keyword: '候选点',
        city: '青岛',
        center: null,
        limit: 8,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.candidates[0]?.location.coordinateSystem).toBe('WGS84');
    expect(result.data.candidates[0]?.requiresReview).toBe(true);
    const converted = gcj02ToWgs84({ lat: 36.067, lng: 120.382, coordinateSystem: 'GCJ02' });
    expect(converted.lat).not.toBe(36.067);
  });
});

describe('Phase 3 multi-plan storage lifecycle', () => {
  it('duplicates, renames, snapshots, deletes, recovers and restores plans', async () => {
    const original = plan();
    const collection = StoredPlanCollectionSchema.parse({
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
      id: 'multi-plan-collection',
      plans: [original],
      snapshots: [],
      archivedPlanIds: [],
      deletedPlanIds: [],
    });
    const storage = new InMemoryPlanStorage(collection, {
      now: () => '2026-08-01T11:00:00+08:00',
      appVersion: '0.4.0',
      dataVersion: 'legacy-v2.5.4-review-required',
      checksum: (value) => `sha-${JSON.stringify(value).length}`,
    });
    const duplicate = unwrap(await storage.duplicatePlan(original.id, 'copied-plan', '青岛副本'));
    expect(duplicate.id).toBe('copied-plan');
    expect(unwrap(await storage.renamePlan(duplicate.id, '青岛重命名')).name).toBe('青岛重命名');
    const snapshot = unwrap(await storage.createSnapshot(duplicate.id, '修改前'));
    unwrap(await storage.softDeletePlan(duplicate.id));
    expect(unwrap(await storage.loadCollection()).deletedPlanIds).toContain(duplicate.id);
    unwrap(await storage.recoverPlan(duplicate.id));
    expect(unwrap(await storage.loadCollection()).deletedPlanIds).not.toContain(duplicate.id);
    const restored = unwrap(await storage.restoreSnapshot(snapshot.id));
    expect(restored.name).toBe('青岛重命名');
    expect(unwrap(await storage.loadCollection()).activePlanId).toBe(duplicate.id);
  });
});
