import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PLANNER_ASSUMPTIONS,
  PlannerEditError,
  deterministicCommandId,
  generateTripPlan,
  moveItemWithinDay,
} from '@qingdao/planner';
import {
  PlaceSchema,
  TripRequestSchema,
  migrateLegacyV2RuntimePointBundle,
  type Place,
  type TripRequest,
} from '@qingdao/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-01T08:00:00+08:00';

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
  return imported.map((place) => (place.id === curatedSignal.id ? curatedSignal : place));
}

function request(totalDays = 2): TripRequest {
  const base = TripRequestSchema.parse(
    fixture('packages/testing/fixtures/minimal-trip-request.v1.json'),
  );
  const endDate = new Date(Date.parse(`${base.startDate}T00:00:00Z`) + (totalDays - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return TripRequestSchema.parse({
    ...base,
    id: `phase2-${totalDays}-day-request`,
    name: `青岛 Phase 2 · ${totalDays} 日自定义计划`,
    endDate,
    totalDays,
    selections: [
      { placeId: 'signal', priority: 'must', locked: false, notes: '一定要去' },
      { placeId: 'zhanqiao', priority: 'must', locked: false, notes: '' },
      { placeId: 'xiaoyushan', priority: 'want', locked: false, notes: '' },
      { placeId: 'beer', priority: 'want', locked: false, notes: '' },
      { placeId: 'yanerdao', priority: 'optional', locked: false, notes: '' },
      { placeId: 'mayfourth', priority: 'want', locked: false, notes: '' },
      { placeId: 'xiaoqingdao', priority: 'exclude', locked: false, notes: '本次不去' },
    ],
  });
}

function context(now = NOW) {
  return {
    now,
    plannerVersion: '0.2.0-phase2',
    dataVersion: 'legacy-v2.5.4-review-required',
    assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
  } as const;
}

describe('deterministic Qingdao Phase 2 planner', () => {
  it('generates the same plan for the same versioned input and clock', () => {
    const options = { places: qingdaoPlaces(), request: request(), context: context() };
    const first = generateTripPlan(options);
    const second = generateTripPlan(options);

    expect(second).toStrictEqual(first);
    expect(first.days).toHaveLength(2);
    expect(first.placeIds).toHaveLength(6);
    expect(first.rejectedPlaces).toEqual([
      expect.objectContaining({ placeId: 'xiaoqingdao', reasonCode: 'user-excluded' }),
    ]);
    expect(first.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'provider-failure' })]),
    );
    expect(first.estimationNotes[0]).toContain('直线距离');
  });

  it('keeps activities non-overlapping and preserves the requested lunch break', () => {
    const plan = generateTripPlan({
      places: qingdaoPlaces(),
      request: request(),
      context: context(),
    });

    for (const day of plan.days) {
      const ordered = [...day.items].sort(
        (left, right) => Date.parse(left.startAt ?? '') - Date.parse(right.startAt ?? ''),
      );
      ordered.slice(1).forEach((item, index) => {
        const previous = ordered[index];
        expect(Date.parse(item.startAt ?? '')).toBeGreaterThanOrEqual(
          Date.parse(previous?.endAt ?? ''),
        );
      });
      expect(day.items.filter((item) => item.kind === 'rest')).toHaveLength(1);
      expect(day.routeSegments).toHaveLength(
        Math.max(0, day.items.filter((item) => item.kind === 'place').length - 1),
      );
      expect(day.routeSegments.every((segment) => segment.estimated)).toBe(true);
      expect(
        day.routeSegments.every((segment) => segment.provider === 'straight-line-fallback'),
      ).toBe(true);
    }
  });

  it('moves one same-day item and only rebuilds the affected day', () => {
    const places = qingdaoPlaces();
    const original = generateTripPlan({ places, request: request(), context: context() });
    const firstDay = original.days[0];
    const firstItem = firstDay?.items.find((item) => item.kind === 'place');
    if (!firstDay || !firstItem) throw new Error('expected a place item on day one');
    const result = moveItemWithinDay({
      plan: original,
      places,
      dayId: firstDay.id,
      itemId: firstItem.id,
      toPlaceIndex: firstDay.items.filter((item) => item.kind === 'place').length - 1,
      commandId: deterministicCommandId(original, firstItem.id, 2),
      context: context('2026-08-01T08:05:00+08:00'),
    });

    const movedPlaceIds = result.plan.days[0]?.items
      .filter((item) => item.kind === 'place')
      .map((item) => item.placeId);
    expect(movedPlaceIds?.at(-1)).toBe(firstItem.placeId);
    expect(result.plan.days[1]).toStrictEqual(original.days[1]);
    expect(result.plan.editHistory).toHaveLength(1);
    expect(result.explanation).toContain('相邻交通段');
    expect(result.plan.days[0]?.items.filter((item) => item.kind === 'rest')).toHaveLength(1);
  });

  it('does not allow a locked place to disappear through reordering', () => {
    const places = qingdaoPlaces();
    const lockedRequest = request();
    const selections = lockedRequest.selections.map((selection) =>
      selection.placeId === 'signal' ? { ...selection, locked: true } : selection,
    );
    const plan = generateTripPlan({
      places,
      request: { ...lockedRequest, selections },
      context: context(),
    });
    const lockedItem = plan.days
      .flatMap((day) => day.items)
      .find((item) => item.placeId === 'signal');
    if (!lockedItem) throw new Error('expected the locked signal item');

    expect(() =>
      moveItemWithinDay({
        plan,
        places,
        dayId: lockedItem.dayId,
        itemId: lockedItem.id,
        toPlaceIndex: 1,
        commandId: 'locked-move-command',
        context: context(),
      }),
    ).toThrow(PlannerEditError);
  });

  it('schedules every must place or emits a must-not-scheduled conflict for 1–3 days', () => {
    const places = qingdaoPlaces();
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), (totalDays) => {
        const tripRequest = request(totalDays);
        const plan = generateTripPlan({ places, request: tripRequest, context: context() });
        const scheduled = new Set(
          plan.days.flatMap((day) => day.items.map((item) => item.placeId)),
        );

        for (const selection of tripRequest.selections.filter(
          (candidate) => candidate.priority === 'must',
        )) {
          expect(
            scheduled.has(selection.placeId) ||
              plan.conflicts.some((conflict) => conflict.kind === 'must-not-scheduled'),
          ).toBe(true);
        }
      }),
      { numRuns: 30 },
    );
  });
});
