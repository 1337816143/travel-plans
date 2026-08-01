import { preparePlanningInput } from '@qingdao/domain';
import {
  PlaceSchema,
  TripPlanSchema,
  type Place,
  type TripPlan,
} from '@qingdao/schema';

import { PlannerRunContextSchema, type PlannerRunContext } from './assumptions.js';
import { splitIntoGeographicDays } from './geography.js';
import { buildDay, stableId, type ScheduledPlace } from './schedule.js';

export interface GenerateTripPlanOptions {
  readonly places: readonly unknown[];
  readonly request: unknown;
  readonly context: unknown;
}

export function generateTripPlan(options: GenerateTripPlanOptions): TripPlan {
  const context: PlannerRunContext = PlannerRunContextSchema.parse(options.context);
  const places = options.places.map((place) => PlaceSchema.parse(place));
  const planningInput = preparePlanningInput({ places, request: options.request });
  const selectedById = new Map(
    planningInput.selectedPlaces.map((selection) => [selection.place.id, selection]),
  );
  const placeDays = splitIntoGeographicDays(
    planningInput.selectedPlaces.map((selection) => selection.place),
    planningInput.effectiveDays,
  );
  const builtDays = placeDays.map((dayPlaces: readonly Place[], dayIndex) => {
    const scheduled: ScheduledPlace[] = dayPlaces.map((place) => {
      const selection = selectedById.get(place.id);
      if (!selection) throw new Error(`Planner internal selection mismatch: ${place.id}`);
      return selection;
    });
    return buildDay(dayIndex, scheduled, planningInput.request, context);
  });
  const days = builtDays.map((built) => built.day);
  const activityIds = days.flatMap((day) => day.items.map((item) => item.id));
  const restItemIds = days.flatMap((day) =>
    day.items.filter((item) => item.kind === 'rest').map((item) => item.id),
  );
  const scheduledPlaceIds = new Set(
    days.flatMap((day) =>
      day.items.flatMap((item) => (item.placeId === null ? [] : [item.placeId])),
    ),
  );
  const mustMissing = planningInput.selectedPlaces.filter(
    (selection) => selection.priority === 'must' && !scheduledPlaceIds.has(selection.place.id),
  );
  const missingConflicts = mustMissing.map((selection) => ({
    id: stableId('conflict', `missing-${selection.place.id}`),
    kind: 'must-not-scheduled' as const,
    severity: 'error' as const,
    itemIds: [],
    message: `必去地点“${selection.place.name}”未能排入日程。`,
  }));
  const estimatedPlaces = planningInput.selectedPlaces.filter(
    (selection) => selection.place.recommendedDurationMinutes === null,
  );

  return TripPlanSchema.parse({
    schemaVersion: 1,
    createdAt: context.now,
    updatedAt: context.now,
    id: stableId('plan', planningInput.request.id),
    name: planningInput.request.name,
    inputVersion: String(planningInput.request.schemaVersion),
    plannerVersion: context.plannerVersion,
    dataVersion: context.dataVersion,
    generatedAt: context.now,
    request: planningInput.request,
    days,
    placeIds: planningInput.selectedPlaces.map((selection) => selection.place.id),
    activityIds,
    accommodationItemIds: [],
    reservationItemIds: [],
    mealItemIds: [],
    restItemIds,
    conflicts: [...builtDays.flatMap((built) => built.conflicts), ...missingConflicts],
    risks:
      estimatedPlaces.length > 0
        ? [
            {
              id: stableId('risk', 'unreviewed-duration-data'),
              kind: 'data-quality',
              level: 'medium',
              itemIds: days.flatMap((day) =>
                day.items
                  .filter(
                    (item) =>
                      item.placeId !== null &&
                      estimatedPlaces.some((selection) => selection.place.id === item.placeId),
                  )
                  .map((item) => item.id),
              ),
              explanation: '部分 Legacy v2.5.4 点位尚无审核后的推荐停留时长，当前使用显式默认值。',
            },
          ]
        : [],
    planBItemIds: [],
    rejectedPlaces: planningInput.excludedPlaceIds.map((placeId) => ({
      placeId,
      reasonCode: 'user-excluded',
      explanation: '用户在 TripRequest 中明确设置为“不去”。',
    })),
    estimationNotes: [
      'Phase 2 尚未接入真实路线 Provider；直线距离仅用于降级展示，不代表真实道路距离或通行时间。',
      ...builtDays.flatMap((built) => built.estimationNotes),
    ],
    dataFreshness: 'unknown',
    editHistory: [],
  });
}
