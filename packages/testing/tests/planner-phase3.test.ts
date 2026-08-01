import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildTripMapRenderModel } from '@qingdao/map-core';
import {
  DEFAULT_PLANNER_ASSUMPTIONS,
  PlannerEditError,
  PlannerHistoryError,
  createPlannerHistoryState,
  deterministicAcrossDayCommandId,
  deterministicCommandId,
  generateTripPlan,
  moveItemAcrossDay,
  moveItemWithinDay,
  recordPlannerEdit,
  redoPlannerEdit,
  undoPlannerEdit,
} from '@qingdao/planner';
import {
  PlaceSchema,
  TripRequestSchema,
  migrateLegacyV2RuntimePointBundle,
  type Place,
  type TripPlan,
  type TripRequest,
} from '@qingdao/schema';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-01T09:00:00+08:00';

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

function request(totalDays = 3, lockedPlaceId: string | null = null): TripRequest {
  const base = TripRequestSchema.parse(
    fixture('packages/testing/fixtures/minimal-trip-request.v1.json'),
  );
  const endDate = new Date(Date.parse(`${base.startDate}T00:00:00Z`) + (totalDays - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return TripRequestSchema.parse({
    ...base,
    id: `phase3-${totalDays}-day-request`,
    name: `青岛 Phase 3 · ${totalDays} 日编辑计划`,
    endDate,
    totalDays,
    selections: [
      { placeId: 'signal', priority: 'must', locked: lockedPlaceId === 'signal', notes: '' },
      { placeId: 'zhanqiao', priority: 'must', locked: lockedPlaceId === 'zhanqiao', notes: '' },
      { placeId: 'xiaoyushan', priority: 'want', locked: false, notes: '' },
      { placeId: 'beer', priority: 'want', locked: false, notes: '' },
      { placeId: 'yanerdao', priority: 'optional', locked: false, notes: '' },
      { placeId: 'mayfourth', priority: 'want', locked: false, notes: '' },
      { placeId: 'xiaoqingdao', priority: 'exclude', locked: false, notes: '' },
    ],
  });
}

function context(now = NOW) {
  return {
    now,
    plannerVersion: '0.3.0-phase3',
    dataVersion: 'legacy-v2.5.4-review-required',
    assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
  } as const;
}

function scheduleState(plan: TripPlan): unknown {
  return plan.days.map((day) => ({
    id: day.id,
    title: day.title,
    places: day.items
      .filter((item) => item.kind === 'place')
      .map((item) => ({
        id: item.id,
        placeId: item.placeId,
        dayId: item.dayId,
        startAt: item.startAt,
        endAt: item.endAt,
        mapNumber: item.mapNumber,
      })),
    rests: day.items.filter((item) => item.kind === 'rest'),
    routes: day.routeSegments,
  }));
}

function placeItems(plan: TripPlan, dayId: string) {
  return (
    plan.days.find((day) => day.id === dayId)?.items.filter((item) => item.kind === 'place') ?? []
  );
}

describe('Qingdao Phase 3 reversible cross-day editing', () => {
  it('moves a place across days and only rebuilds the two affected dates', () => {
    const places = qingdaoPlaces();
    const original = generateTripPlan({ places, request: request(), context: context() });
    const fromDay = original.days[0];
    const toDay = original.days[1];
    const unaffectedDay = original.days[2];
    const movedItem = fromDay?.items.find((item) => item.kind === 'place');
    if (!fromDay || !toDay || !unaffectedDay || !movedItem) {
      throw new Error('expected three generated days and one source place');
    }
    const targetIndex = placeItems(original, toDay.id).length;
    const result = moveItemAcrossDay({
      plan: original,
      places,
      fromDayId: fromDay.id,
      toDayId: toDay.id,
      itemId: movedItem.id,
      toPlaceIndex: targetIndex,
      commandId: deterministicAcrossDayCommandId(original, movedItem.id, toDay.id, targetIndex),
      context: context('2026-08-01T09:05:00+08:00'),
    });

    expect(result.command.type).toBe('move-across-day');
    expect(result.inverseCommand.type).toBe('move-across-day');
    expect(result.command.inverseCommandId).toBe(result.inverseCommand.id);
    expect(result.inverseCommand.inverseCommandId).toBe(result.command.id);
    expect(result.plan.days[2]).toStrictEqual(unaffectedDay);
    expect(
      placeItems(result.plan, fromDay.id).some((item) => item.placeId === movedItem.placeId),
    ).toBe(false);
    const movedAfter = placeItems(result.plan, toDay.id).find(
      (item) => item.placeId === movedItem.placeId,
    );
    expect(movedAfter?.id).toBe(result.movedItemId);
    expect(movedAfter?.id).not.toBe(movedItem.id);

    const beforePlaceIds = original.days
      .flatMap((day) => day.items)
      .flatMap((item) => (item.placeId ? [item.placeId] : []))
      .sort();
    const afterPlaceIds = result.plan.days
      .flatMap((day) => day.items)
      .flatMap((item) => (item.placeId ? [item.placeId] : []))
      .sort();
    expect(afterPlaceIds).toStrictEqual(beforePlaceIds);
    expect(
      result.plan.days.every(
        (day) =>
          day.routeSegments.length ===
          Math.max(0, day.items.filter((item) => item.kind === 'place').length - 1),
      ),
    ).toBe(true);
    expect(
      result.plan.risks
        .flatMap((risk) => risk.itemIds)
        .every((id) => result.plan.activityIds.includes(id)),
    ).toBe(true);

    const map = buildTripMapRenderModel({ plan: result.plan, places });
    expect(map.markers.find((marker) => marker.placeId === movedItem.placeId)?.dayId).toBe(
      toDay.id,
    );
    expect(map.routes).toHaveLength(
      result.plan.days.reduce((sum, day) => sum + day.routeSegments.length, 0),
    );
  });

  it('never permits a locked place to cross dates', () => {
    const places = qingdaoPlaces();
    const plan = generateTripPlan({
      places,
      request: request(3, 'signal'),
      context: context(),
    });
    const lockedItem = plan.days
      .flatMap((day) => day.items)
      .find((item) => item.placeId === 'signal');
    const targetDay = plan.days.find((day) => day.id !== lockedItem?.dayId);
    if (!lockedItem || !targetDay) throw new Error('expected a locked item and target date');

    expect(() =>
      moveItemAcrossDay({
        plan,
        places,
        fromDayId: lockedItem.dayId,
        toDayId: targetDay.id,
        itemId: lockedItem.id,
        toPlaceIndex: 0,
        commandId: 'locked-cross-day-command',
        context: context(),
      }),
    ).toThrow(PlannerEditError);

    const boundaryPlan = generateTripPlan({
      places,
      request: request(3, 'zhanqiao'),
      context: context(),
    });
    const lockedBoundary = boundaryPlan.days
      .flatMap((day) => day.items)
      .find((item) => item.placeId === 'zhanqiao');
    const sourceDay = boundaryPlan.days.find(
      (day) =>
        day.id !== lockedBoundary?.dayId &&
        day.items.some((item) => item.kind === 'place' && !item.locked),
    );
    const sourceItem = sourceDay?.items.find((item) => item.kind === 'place' && !item.locked);
    const boundaryDay = boundaryPlan.days.find((day) => day.id === lockedBoundary?.dayId);
    const boundaryIndex = boundaryDay
      ? placeItems(boundaryPlan, boundaryDay.id).findIndex((item) => item.id === lockedBoundary?.id)
      : -1;
    if (!lockedBoundary || !sourceDay || !sourceItem || !boundaryDay || boundaryIndex < 0) {
      throw new Error('expected a locked insertion boundary');
    }
    expect(() =>
      moveItemAcrossDay({
        plan: boundaryPlan,
        places,
        fromDayId: sourceDay.id,
        toDayId: boundaryDay.id,
        itemId: sourceItem.id,
        toPlaceIndex: boundaryIndex,
        commandId: 'locked-boundary-command',
        context: context(),
      }),
    ).toThrow(PlannerEditError);
  });

  it('undoes and redoes a cross-day move without losing schedule semantics', () => {
    const places = qingdaoPlaces();
    const original = generateTripPlan({ places, request: request(), context: context() });
    const fromDay = original.days[0];
    const toDay = original.days[1];
    const movedItem = fromDay?.items.find((item) => item.kind === 'place');
    if (!fromDay || !toDay || !movedItem) throw new Error('expected movable item');
    const moved = moveItemAcrossDay({
      plan: original,
      places,
      fromDayId: fromDay.id,
      toDayId: toDay.id,
      itemId: movedItem.id,
      toPlaceIndex: placeItems(original, toDay.id).length,
      commandId: 'phase3-history-cross-day',
      context: context('2026-08-01T09:05:00+08:00'),
    });
    const recorded = recordPlannerEdit(createPlannerHistoryState(), original, moved);
    const undone = undoPlannerEdit({
      plan: moved.plan,
      history: recorded,
      context: context('2026-08-01T09:06:00+08:00'),
    });

    expect(scheduleState(undone.plan)).toStrictEqual(scheduleState(original));
    expect(undone.plan.editHistory.at(-1)?.commandType).toBe('undo');
    expect(undone.history.past).toHaveLength(0);
    expect(undone.history.future).toHaveLength(1);

    const redone = redoPlannerEdit({
      plan: undone.plan,
      history: undone.history,
      context: context('2026-08-01T09:07:00+08:00'),
    });
    expect(scheduleState(redone.plan)).toStrictEqual(scheduleState(moved.plan));
    expect(redone.plan.editHistory.at(-1)?.commandType).toBe('redo');
    expect(redone.history.past).toHaveLength(1);
    expect(redone.history.future).toHaveLength(0);
  });

  it('clears the redo branch after a new edit and reports empty history explicitly', () => {
    const places = qingdaoPlaces();
    const original = generateTripPlan({ places, request: request(), context: context() });
    const sourceDay = original.days.find(
      (day) => day.items.filter((item) => item.kind === 'place').length >= 2,
    );
    const sourceItems = sourceDay ? placeItems(original, sourceDay.id) : [];
    const firstItem = sourceItems[0];
    if (!sourceDay || !firstItem) throw new Error('expected a day with two places');
    const firstMove = moveItemWithinDay({
      plan: original,
      places,
      dayId: sourceDay.id,
      itemId: firstItem.id,
      toPlaceIndex: 1,
      commandId: deterministicCommandId(original, firstItem.id, 1),
      context: context('2026-08-01T09:05:00+08:00'),
    });
    const firstHistory = recordPlannerEdit(createPlannerHistoryState(), original, firstMove);
    const undone = undoPlannerEdit({
      plan: firstMove.plan,
      history: firstHistory,
      context: context('2026-08-01T09:06:00+08:00'),
    });
    const refreshedItems = placeItems(undone.plan, sourceDay.id);
    const secondItem = refreshedItems[1];
    if (!secondItem) throw new Error('expected a second place after undo');
    const secondMove = moveItemWithinDay({
      plan: undone.plan,
      places,
      dayId: sourceDay.id,
      itemId: secondItem.id,
      toPlaceIndex: 0,
      commandId: deterministicCommandId(undone.plan, secondItem.id, 0),
      context: context('2026-08-01T09:07:00+08:00'),
    });
    const branched = recordPlannerEdit(undone.history, undone.plan, secondMove);

    expect(branched.future).toHaveLength(0);
    expect(() =>
      redoPlannerEdit({
        plan: secondMove.plan,
        history: branched,
        context: context('2026-08-01T09:08:00+08:00'),
      }),
    ).toThrow(PlannerHistoryError);
    expect(() =>
      undoPlannerEdit({
        plan: original,
        history: createPlannerHistoryState(),
        context: context(),
      }),
    ).toThrow(PlannerHistoryError);
  });
});
