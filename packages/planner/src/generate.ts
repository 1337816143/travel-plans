import { preparePlanningInput } from '@qingdao/domain';
import {
  ItineraryModuleSchema,
  PlaceSchema,
  PresetPlanSchema,
  TripPlanSchema,
  type ItineraryModule,
  type Place,
  type PlanningInput,
  type TripPlan,
} from '@qingdao/schema';

import { PlannerRunContextSchema, type PlannerRunContext } from './assumptions.js';
import { splitIntoGeographicDays } from './geography.js';
import { buildDay, stableId, type BuiltDay, type ScheduledPlace } from './schedule.js';

export interface GenerateTripPlanOptions {
  readonly places: readonly unknown[];
  readonly request: unknown;
  readonly context: unknown;
}

export interface GeneratePresetTripPlanOptions extends GenerateTripPlanOptions {
  readonly preset: unknown;
  readonly modules: readonly unknown[];
}

export class PresetPlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetPlanningError';
  }
}

function assembleTripPlan(input: {
  readonly planningInput: PlanningInput;
  readonly builtDays: readonly BuiltDay[];
  readonly context: PlannerRunContext;
  readonly leadingEstimationNotes?: readonly string[];
}): TripPlan {
  const { planningInput, builtDays, context } = input;
  const days = builtDays.map((built) => built.day);
  const activityIds = days.flatMap((day) => day.items.map((item) => item.id));
  const restItemIds = days.flatMap((day) =>
    day.items.filter((item) => item.kind === 'rest').map((item) => item.id),
  );
  const reservationItemIds = days.flatMap((day) =>
    day.items.filter((item) => item.reservationIds.length > 0).map((item) => item.id),
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
  const selectedButUnscheduled = planningInput.selectedPlaces.filter(
    (selection) => !scheduledPlaceIds.has(selection.place.id),
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
    reservationItemIds,
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
    rejectedPlaces: [
      ...planningInput.excludedPlaceIds.map((placeId) => ({
        placeId,
        reasonCode: 'user-excluded',
        explanation: '用户在 TripRequest 中明确设置为“不去”。',
      })),
      ...selectedButUnscheduled.map((selection) => ({
        placeId: selection.place.id,
        reasonCode: 'preset-module-not-selected',
        explanation: '地点在输入中保留，但当前预设没有把它安排到任何一天。',
      })),
    ],
    estimationNotes: [
      ...(input.leadingEstimationNotes ?? []),
      'Phase 2 尚未接入真实路线 Provider；直线距离仅用于降级展示，不代表真实道路距离或通行时间。',
      ...builtDays.flatMap((built) => built.estimationNotes),
    ],
    dataFreshness: 'unknown',
    markerNumbering: {
      schemaVersion: 1,
      createdAt: context.now,
      updatedAt: context.now,
      mode: 'per-day',
      startNumber: 1,
      customNumbers: {},
    },
    editHistory: [],
  });
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
  return assembleTripPlan({
    planningInput,
    builtDays,
    context,
  });
}

export function generateTripPlanFromPreset(options: GeneratePresetTripPlanOptions): TripPlan {
  const context: PlannerRunContext = PlannerRunContextSchema.parse(options.context);
  const places = options.places.map((place) => PlaceSchema.parse(place));
  const preset = PresetPlanSchema.parse(options.preset);
  const modules: readonly ItineraryModule[] = options.modules.map((module) =>
    ItineraryModuleSchema.parse(module),
  );
  const planningInput = preparePlanningInput({ places, request: options.request });
  if (planningInput.effectiveDays !== preset.totalDays) {
    throw new PresetPlanningError(
      `TripRequest 为 ${planningInput.effectiveDays} 天，但预设“${preset.name}”需要 ${preset.totalDays} 天。`,
    );
  }
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const selectedById = new Map(
    planningInput.selectedPlaces.map((selection) => [selection.place.id, selection]),
  );
  const builtDays = preset.dayAssignments.map((assignment) => {
    const dayModules = assignment.moduleIds.map((moduleId) => {
      const module = moduleById.get(moduleId);
      if (!module) {
        throw new PresetPlanningError(`预设“${preset.name}”引用了缺失模块：${moduleId}`);
      }
      return module;
    });
    const placeIds = [...new Set(dayModules.flatMap((module) => module.placeIds))];
    const scheduled = placeIds.flatMap((placeId): ScheduledPlace[] => {
      const selection = selectedById.get(placeId);
      if (!selection) return [];
      const reservationIds = [
        ...new Set(
          dayModules
            .filter((module) => module.placeIds.includes(placeId))
            .flatMap((module) => module.reservationIds),
        ),
      ];
      return [{ ...selection, reservationIds }];
    });
    const built = buildDay(assignment.dayNumber - 1, scheduled, planningInput.request, context);
    return {
      ...built,
      day: {
        ...built.day,
        title: `第 ${assignment.dayNumber} 天 · ${dayModules.map((module) => module.name).join('＋')}`,
      },
    };
  });
  return assembleTripPlan({
    planningInput,
    builtDays,
    context,
    leadingEstimationNotes: [
      `当前计划由“${preset.name}”预设生成；预设为可编辑起点，不是不可修改的固定日程。`,
      '模块中的开放、票务、天气和班次约束仍为 review-required，临行前必须由官方来源或运行时 Provider 复核。',
    ],
  });
}
