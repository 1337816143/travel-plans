import {
  RouteSegmentSchema,
  TripDaySchema,
  type Place,
  type PlacePriority,
  type RouteSegment,
  type TripDay,
  type TripItem,
  type TripRequest,
} from '@qingdao/schema';

import type { PlannerRunContext } from './assumptions.js';
import { straightLineDistanceMeters } from './geography.js';

export interface ScheduledPlace {
  readonly place: Place;
  readonly priority: Exclude<PlacePriority, 'exclude'>;
  readonly locked: boolean;
  readonly notes: string;
}

export interface BuiltDay {
  readonly day: TripDay;
  readonly conflicts: readonly PlannerConflict[];
  readonly estimationNotes: readonly string[];
}

export interface PlannerConflict {
  readonly id: string;
  readonly kind:
    | 'must-not-scheduled'
    | 'overlap'
    | 'opening-hours'
    | 'transport'
    | 'reservation'
    | 'accommodation'
    | 'weather'
    | 'locked-item'
    | 'provider-failure';
  readonly severity: 'info' | 'warning' | 'error';
  readonly itemIds: readonly string[];
  readonly message: string;
}

const DAY_MILLISECONDS = 86_400_000;

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export function stableId(prefix: string, value: string): string {
  const readable = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return `${prefix}-${readable || 'item'}-${stableHash(value)}`.slice(0, 160);
}

export function addDays(date: string, dayOffset: number): string {
  const milliseconds = Date.parse(`${date}T00:00:00Z`) + dayOffset * DAY_MILLISECONDS;
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function atQingdaoTime(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(Date.parse(timestamp) + minutes * 60_000).toISOString();
}

function timestampMinutes(timestamp: string): number {
  return Date.parse(timestamp) / 60_000;
}

function buildPlaceItem(
  scheduled: ScheduledPlace,
  dayId: string,
  mapNumber: number,
  startAt: string,
  context: PlannerRunContext,
): TripItem {
  const durationMinutes =
    scheduled.place.recommendedDurationMinutes ?? context.assumptions.defaultVisitMinutes;
  const itemId = stableId('place', `${dayId}-${scheduled.place.id}`);
  return {
    schemaVersion: 1,
    createdAt: context.now,
    updatedAt: context.now,
    id: itemId,
    dayId,
    kind: 'place',
    placeId: scheduled.place.id,
    customTitle: scheduled.place.name,
    startAt,
    endAt: addMinutes(startAt, durationMinutes),
    durationMinutes,
    address: scheduled.place.address ?? '',
    notes: scheduled.notes,
    detail: scheduled.place.summary,
    estimatedCost: null,
    reservationIds: [],
    reminders: [],
    attachments: [],
    locked: scheduled.locked,
    optional: scheduled.priority === 'optional',
    planB: false,
    markerStyleId: null,
    mapNumber: String(mapNumber),
    sourceRefIds: scheduled.place.sourceRefs.map((source) => source.id),
    estimateStatus:
      scheduled.place.recommendedDurationMinutes === null ? 'estimated' : 'verified',
  };
}

function buildLunchItem(
  dayId: string,
  startAt: string,
  request: TripRequest,
  context: PlannerRunContext,
): TripItem {
  const durationMinutes = request.lunchBreak.durationMinutes;
  return {
    schemaVersion: 1,
    createdAt: context.now,
    updatedAt: context.now,
    id: stableId('rest', `${dayId}-lunch`),
    dayId,
    kind: 'rest',
    placeId: null,
    customTitle: '午餐与午休',
    startAt,
    endAt: addMinutes(startAt, durationMinutes),
    durationMinutes,
    address: '',
    notes: '按 TripRequest 的午休约束插入；具体地点由用户确认。',
    detail: 'Planner 保留的午餐与休息时段。',
    estimatedCost: null,
    reservationIds: [],
    reminders: [],
    attachments: [],
    locked: false,
    optional: false,
    planB: false,
    markerStyleId: null,
    mapNumber: '',
    sourceRefIds: [],
    estimateStatus: 'estimated',
  };
}

function buildFallbackRoute(
  dayId: string,
  fromItem: TripItem,
  fromPlace: Place,
  toItem: TripItem,
  toPlace: Place,
  context: PlannerRunContext,
): RouteSegment {
  const distanceMeters = straightLineDistanceMeters(fromPlace.location, toPlace.location);
  const durationMinutes = Math.max(
    1,
    Math.ceil(distanceMeters / context.assumptions.fallbackWalkingMetersPerMinute),
  );

  return RouteSegmentSchema.parse({
    schemaVersion: 1,
    createdAt: context.now,
    updatedAt: context.now,
    id: stableId('route', `${dayId}-${fromItem.id}-${toItem.id}`),
    dayId,
    fromItemId: fromItem.id,
    toItemId: toItem.id,
    mode: 'walking',
    origin: fromPlace.location,
    destination: toPlace.location,
    distanceMeters,
    durationMinutes,
    polyline: [fromPlace.location, toPlace.location],
    provider: context.assumptions.routeFallbackProvider,
    queriedAt: context.now,
    expiresAt: null,
    estimated: true,
    confidence: context.assumptions.routeFallbackConfidence,
    routeStyleId: null,
  });
}

export function buildDay(
  dayIndex: number,
  scheduledPlaces: readonly ScheduledPlace[],
  request: TripRequest,
  context: PlannerRunContext,
): BuiltDay {
  const date = addDays(request.startDate, dayIndex);
  const dayId = `day-${String(dayIndex + 1).padStart(2, '0')}`;
  const dayStart = atQingdaoTime(date, request.dailyWindow.start);
  const dayEnd = atQingdaoTime(date, request.dailyWindow.end);
  const lunchEarliest = atQingdaoTime(date, request.lunchBreak.earliestStart);
  const lunchLatestStart = addMinutes(
    atQingdaoTime(date, request.lunchBreak.latestEnd),
    -request.lunchBreak.durationMinutes,
  );
  const items: TripItem[] = [];
  const routeSegments: RouteSegment[] = [];
  const conflicts: PlannerConflict[] = [];
  const estimationNotes: string[] = [];
  let currentAt = dayStart;
  let lunchInserted = false;
  let previousPlaceItem: TripItem | undefined;
  let previousPlace: Place | undefined;

  const insertLunch = (): void => {
    const proposedStart =
      timestampMinutes(currentAt) < timestampMinutes(lunchEarliest) ? lunchEarliest : currentAt;
    if (timestampMinutes(proposedStart) <= timestampMinutes(lunchLatestStart)) {
      const lunchItem = buildLunchItem(dayId, proposedStart, request, context);
      items.push(lunchItem);
      currentAt = lunchItem.endAt ?? proposedStart;
      lunchInserted = true;
    } else {
      conflicts.push({
        id: stableId('conflict', `${dayId}-lunch-window`),
        kind: 'overlap',
        severity: 'warning',
        itemIds: items.map((item) => item.id),
        message: '午餐与午休无法完整放入用户设置的时间窗口，需要手工调整。',
      });
      lunchInserted = true;
    }
  };

  scheduledPlaces.forEach((scheduled, index) => {
    let route: RouteSegment | undefined;
    const provisionalItem = buildPlaceItem(scheduled, dayId, index + 1, currentAt, context);
    if (previousPlaceItem && previousPlace) {
      route = buildFallbackRoute(
        dayId,
        previousPlaceItem,
        previousPlace,
        provisionalItem,
        scheduled.place,
        context,
      );
    }
    const routeMinutes = route?.durationMinutes ?? 0;
    const visitMinutes = provisionalItem.durationMinutes;
    const projectedEnd = addMinutes(currentAt, routeMinutes + visitMinutes);

    if (
      request.lunchBreak.required &&
      !lunchInserted &&
      timestampMinutes(projectedEnd) > timestampMinutes(lunchEarliest)
    ) {
      insertLunch();
    }

    const startAt = addMinutes(currentAt, routeMinutes);
    const item = buildPlaceItem(scheduled, dayId, index + 1, startAt, context);
    if (previousPlaceItem && previousPlace) {
      route = buildFallbackRoute(
        dayId,
        previousPlaceItem,
        previousPlace,
        item,
        scheduled.place,
        context,
      );
      routeSegments.push(route);
      conflicts.push({
        id: stableId('conflict', `${route.id}-provider`),
        kind: 'provider-failure',
        severity: 'warning',
        itemIds: [route.fromItemId, route.toItemId],
        message: '真实路线 Provider 尚未接入；当前仅显示直线距离与低置信度步行时间估算。',
      });
    }
    items.push(item);
    currentAt = item.endAt ?? startAt;
    previousPlaceItem = item;
    previousPlace = scheduled.place;

    if (scheduled.place.recommendedDurationMinutes === null) {
      estimationNotes.push(
        `${scheduled.place.name} 暂用 ${context.assumptions.defaultVisitMinutes} 分钟默认停留时间，待内容审核。`,
      );
    }
  });

  if (request.lunchBreak.required && !lunchInserted && scheduledPlaces.length > 0) insertLunch();

  const lastEnd = items.reduce(
    (latest, item) =>
      item.endAt && timestampMinutes(item.endAt) > timestampMinutes(latest) ? item.endAt : latest,
    dayStart,
  );
  if (timestampMinutes(lastEnd) > timestampMinutes(dayEnd)) {
    conflicts.push({
      id: stableId('conflict', `${dayId}-daily-window`),
      kind: 'transport',
      severity: 'warning',
      itemIds: items.map((item) => item.id),
      message: `日程超过用户设置的 ${request.dailyWindow.end} 结束时间，需要减少点位或调整节奏。`,
    });
  }

  const firstPlace = scheduledPlaces[0]?.place;
  return {
    day: TripDaySchema.parse({
      schemaVersion: 1,
      createdAt: context.now,
      updatedAt: context.now,
      id: dayId,
      date,
      timezone: 'Asia/Shanghai',
      title: firstPlace ? `第 ${dayIndex + 1} 天 · ${firstPlace.name}一带` : `第 ${dayIndex + 1} 天 · 自由安排`,
      items,
      routeSegments,
      accommodationId: null,
      planBItemIds: [],
    }),
    conflicts,
    estimationNotes,
  };
}
