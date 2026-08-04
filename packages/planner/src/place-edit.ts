import {
  CustomPoiSchema,
  PlaceSchema,
  TripPlanSchema,
  type CustomPoi,
  type EditCommand,
  type Place,
  type PlacePriority,
  type RemovedTripItem,
  type TripDay,
  type TripItem,
  type TripPlan,
} from '@qingdao/schema';

import { PlannerRunContextSchema, type PlannerRunContext } from './assumptions.js';
import { placeItems, rebuildPlan, scheduledPlaces } from './edit.js';
import { createEditCommand, type PlannerEditResult } from './edit-result.js';
import { buildDay, stableId, type BuiltDay, type ScheduledPlace } from './schedule.js';

export class PlannerPlaceEditError extends Error {
  readonly code:
    | 'day-not-found'
    | 'item-not-found'
    | 'place-not-found'
    | 'already-scheduled'
    | 'locked-item'
    | 'invalid-index';

  constructor(code: PlannerPlaceEditError['code'], message: string) {
    super(message);
    this.name = 'PlannerPlaceEditError';
    this.code = code;
  }
}

function commandPair(input: {
  readonly plan: TripPlan;
  readonly commandId: string;
  readonly type:
    'add-place' | 'create-custom-poi' | 'delete' | 'disable' | 'restore' | 'batch-set-date';
  readonly inverseType: 'delete' | 'restore' | 'batch-set-date';
  readonly targetIds: readonly string[];
  readonly context: PlannerRunContext;
  readonly reason: string;
  readonly inverseReason: string;
  readonly fromDayId?: string | null;
  readonly toDayId?: string | null;
  readonly priority?: PlacePriority | null;
}): { readonly command: EditCommand; readonly inverseCommand: EditCommand } {
  const inverseCommandId = stableId('command', `${input.commandId}-inverse`);
  const command = createEditCommand({
    id: input.commandId,
    inverseCommandId,
    type: input.type,
    plan: input.plan,
    targetIds: input.targetIds,
    context: input.context,
    reason: input.reason,
    fromDayId: input.fromDayId,
    toDayId: input.toDayId,
    priority: input.priority,
  });
  const inverseCommand = createEditCommand({
    id: inverseCommandId,
    inverseCommandId: command.id,
    type: input.inverseType,
    plan: input.plan,
    targetIds: input.targetIds,
    context: input.context,
    reason: input.inverseReason,
    fromDayId: input.toDayId,
    toDayId: input.fromDayId,
  });
  return { command, inverseCommand };
}

export function addItineraryModuleToDay(input: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
  readonly moduleId: string;
  readonly moduleName: string;
  readonly placeIds: readonly string[];
  readonly dayId: string;
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const context = PlannerRunContextSchema.parse(input.context);
  const places = input.places.map((place) => PlaceSchema.parse(place));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const active = activePlaceIds(plan);
  const addedPlaces = Array.from(new Set(input.placeIds))
    .filter((placeId) => !active.has(placeId))
    .map((placeId) => {
      const place = placeById.get(placeId);
      if (!place) throw new PlannerPlaceEditError('place-not-found', `模块地点不存在：${placeId}`);
      return place;
    });
  if (addedPlaces.length === 0) {
    throw new PlannerPlaceEditError('already-scheduled', '该模块的地点已经全部在当前行程中。');
  }
  const { day, index: dayIndex } = findDay(plan, input.dayId);
  const currentItems = placeItems(day);
  const requestSelections = [...plan.request.selections];
  addedPlaces.forEach((place) => {
    const index = requestSelections.findIndex((selection) => selection.placeId === place.id);
    const selection = {
      placeId: place.id,
      priority: 'want' as const,
      locked: false,
      notes: `来自日程模块：${input.moduleName}`,
    };
    if (index < 0) requestSelections.push(selection);
    else requestSelections[index] = selection;
  });
  const candidatePlan = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    request: { ...plan.request, updatedAt: context.now, selections: requestSelections },
    rejectedPlaces: plan.rejectedPlaces.filter(
      (entry) => !addedPlaces.some((place) => place.id === entry.placeId),
    ),
  });
  const scheduled = scheduledPlaces(currentItems, places, candidatePlan);
  scheduled.push(
    ...addedPlaces.map((place) =>
      scheduledForNewPlace(place, 'want', false, `来自日程模块：${input.moduleName}`),
    ),
  );
  const rebuilt = buildDay(dayIndex, scheduled, candidatePlan.request, context);
  const inverseCommandId = stableId('command', `${input.commandId}-inverse`);
  const command = createEditCommand({
    id: input.commandId,
    inverseCommandId,
    type: 'apply-itinerary-module',
    plan: candidatePlan,
    targetIds: addedPlaces.map((place) => place.id),
    context,
    reason: `用户应用日程模块 ${input.moduleId}。`,
    toDayId: day.id,
  });
  const inverseCommand = createEditCommand({
    id: inverseCommandId,
    inverseCommandId: command.id,
    type: 'delete',
    plan: candidatePlan,
    targetIds: addedPlaces.map((place) => place.id),
    context,
    reason: `撤销日程模块 ${input.moduleId}。`,
    fromDayId: day.id,
  });
  const explanation = `已把“${input.moduleName}”的 ${addedPlaces.length} 个新地点加入第 ${dayIndex + 1} 天，并重算该日。`;
  const next = rebuildPlan({
    plan: candidatePlan,
    rebuiltDays: new Map([[dayIndex, rebuilt]]),
    command,
    explanation,
    context,
  });
  const firstPlaceId = addedPlaces[0]?.id;
  return {
    plan: next,
    command,
    inverseCommand,
    explanation,
    focusItemId: firstPlaceId
      ? (next.days
          .flatMap((candidate) => candidate.items)
          .find((item) => item.placeId === firstPlaceId)?.id ?? null)
      : null,
  };
}

function selectionFor(
  plan: TripPlan,
  placeId: string,
): TripPlan['request']['selections'][number] | null {
  return plan.request.selections.find((selection) => selection.placeId === placeId) ?? null;
}

function findDay(plan: TripPlan, dayId: string): { readonly day: TripDay; readonly index: number } {
  const index = plan.days.findIndex((day) => day.id === dayId);
  const day = plan.days[index];
  if (index < 0 || !day) throw new PlannerPlaceEditError('day-not-found', `找不到日期：${dayId}`);
  return { day, index };
}

function scheduledForNewPlace(
  place: Place,
  priority: Exclude<PlacePriority, 'exclude'>,
  locked: boolean,
  notes: string,
): ScheduledPlace {
  return { place, priority, locked, notes };
}

function activePlaceIds(plan: TripPlan): Set<string> {
  return new Set(
    plan.days.flatMap((day) =>
      day.items.flatMap((item) => (item.placeId === null ? [] : [item.placeId])),
    ),
  );
}

export function customPoiToPlace(rawCustomPoi: unknown): Place {
  const customPoi: CustomPoi = CustomPoiSchema.parse(rawCustomPoi);
  const sourceUrl = customPoi.sourceUrls[0] ?? 'https://ditu.amap.com/';
  return PlaceSchema.parse({
    schemaVersion: 1,
    createdAt: customPoi.createdAt,
    updatedAt: customPoi.updatedAt,
    id: customPoi.id,
    name: customPoi.name,
    aliases: customPoi.alias ? [customPoi.alias] : [],
    reviewStatus: 'review-required',
    category: customPoi.category,
    district: 'unknown',
    address: customPoi.address || null,
    location: customPoi.location,
    summary: customPoi.notes || '用户自定义地点；名称、坐标和内容尚未经过攻略数据审核。',
    detail: customPoi.detail || '该地点来自用户输入或地图搜索候选，正式发布前需要人工复核。',
    stableTransport: '',
    typicalVisit: '',
    recommendedDurationMinutes: customPoi.durationMinutes,
    suitableFor: [],
    tags: ['user-custom', customPoi.planB ? 'plan-b' : 'active-plan'],
    sourceRefs: [
      {
        schemaVersion: 1,
        createdAt: customPoi.createdAt,
        updatedAt: customPoi.updatedAt,
        id: `${customPoi.id}-user-source`,
        label: '用户自定义／地图候选，待人工核验',
        tier: 'map-platform',
        url: sourceUrl,
        observedAt: customPoi.createdAt,
        validFrom: null,
        expiresAt: null,
        freshness: 'unknown',
        confidence: 0.35,
        reviewStatus: 'review-required',
        promotionalRisk: 'unknown',
        independentEvidenceCount: 0,
        reviewNotes: '仅记录用户输入，不视为已核验攻略事实。',
        conflictFlags: [],
      },
    ],
    dynamicObservations: [],
    legacyV2: null,
  });
}

function addPlace(input: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
  readonly placeId: string;
  readonly dayId: string;
  readonly toPlaceIndex: number;
  readonly priority: Exclude<PlacePriority, 'exclude'>;
  readonly locked: boolean;
  readonly notes: string;
  readonly commandId: string;
  readonly context: unknown;
  readonly customPoi?: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const context = PlannerRunContextSchema.parse(input.context);
  const places = input.places.map((place) => PlaceSchema.parse(place));
  const place = places.find((candidate) => candidate.id === input.placeId);
  if (!place) throw new PlannerPlaceEditError('place-not-found', `找不到地点：${input.placeId}`);
  if (activePlaceIds(plan).has(place.id)) {
    throw new PlannerPlaceEditError('already-scheduled', `“${place.name}”已经在当前行程中。`);
  }
  const { day, index: dayIndex } = findDay(plan, input.dayId);
  const currentItems = placeItems(day);
  if (input.toPlaceIndex < 0 || input.toPlaceIndex > currentItems.length) {
    throw new PlannerPlaceEditError('invalid-index', `目标位置超出范围：${input.toPlaceIndex}`);
  }
  if (currentItems.slice(input.toPlaceIndex).some((item) => item.locked)) {
    throw new PlannerPlaceEditError('locked-item', '加入位置会后移已锁定日程项，操作已拒绝。');
  }
  const existingSelection = selectionFor(plan, place.id);
  const selection = {
    placeId: place.id,
    priority: input.priority,
    locked: input.locked,
    notes: input.notes,
  };
  const request = {
    ...plan.request,
    updatedAt: context.now,
    selections: existingSelection
      ? plan.request.selections.map((candidate) =>
          candidate.placeId === place.id ? selection : candidate,
        )
      : [...plan.request.selections, selection],
  };
  const customPoi = input.customPoi ? CustomPoiSchema.parse(input.customPoi) : null;
  const candidatePlan = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    request,
    customPois:
      customPoi === null
        ? plan.customPois
        : [...plan.customPois.filter((candidate) => candidate.id !== customPoi.id), customPoi],
    removedItems: plan.removedItems.filter((removed) => removed.item.placeId !== place.id),
    rejectedPlaces: plan.rejectedPlaces.filter((rejected) => rejected.placeId !== place.id),
  });
  const scheduled = scheduledPlaces(currentItems, places, candidatePlan);
  scheduled.splice(
    input.toPlaceIndex,
    0,
    scheduledForNewPlace(place, input.priority, input.locked, input.notes),
  );
  const rebuilt = buildDay(dayIndex, scheduled, candidatePlan.request, context);
  const commandType = customPoi ? 'create-custom-poi' : 'add-place';
  const pair = commandPair({
    plan: candidatePlan,
    commandId: input.commandId,
    type: commandType,
    inverseType: 'delete',
    targetIds: [place.id],
    context,
    reason: customPoi
      ? '用户创建自定义青岛地点并加入指定日期。'
      : '用户从搜索或候选库将地点加入指定日期。',
    inverseReason: '撤销加入地点并恢复目标日期。',
    toDayId: day.id,
    priority: input.priority,
  });
  const explanation = `已将“${place.name}”加入第 ${dayIndex + 1} 天第 ${input.toPlaceIndex + 1} 位，并重算该日时间轴与相邻路线。`;
  const next = rebuildPlan({
    plan: candidatePlan,
    rebuiltDays: new Map([[dayIndex, rebuilt]]),
    command: pair.command,
    explanation,
    context,
  });
  const focusItemId =
    next.days.flatMap((candidate) => candidate.items).find((item) => item.placeId === place.id)
      ?.id ?? null;
  return {
    plan: next,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId,
  };
}

export function addExistingPlaceToDay(input: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
  readonly placeId: string;
  readonly dayId: string;
  readonly toPlaceIndex: number;
  readonly priority: Exclude<PlacePriority, 'exclude'>;
  readonly locked?: boolean;
  readonly notes?: string;
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  return addPlace({ ...input, locked: input.locked ?? false, notes: input.notes ?? '' });
}

export function addCustomPoiToDay(input: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
  readonly customPoi: unknown;
  readonly dayId: string;
  readonly toPlaceIndex: number;
  readonly commandId: string;
  readonly context: unknown;
}): { readonly result: PlannerEditResult; readonly place: Place } {
  const customPoi = CustomPoiSchema.parse(input.customPoi);
  if (customPoi.priority === 'exclude' || !customPoi.participatesInPlanning) {
    throw new PlannerPlaceEditError(
      'place-not-found',
      '该自定义地点被设为“不去”或不参与自动规划。',
    );
  }
  const place = customPoiToPlace(customPoi);
  const result = addPlace({
    ...input,
    places: [...input.places, place],
    placeId: place.id,
    priority: customPoi.priority,
    locked: customPoi.locked,
    notes: customPoi.notes,
    customPoi,
  });
  return { result, place };
}

export function addCustomPoiCandidate(input: {
  readonly plan: unknown;
  readonly customPoi: unknown;
  readonly commandId: string;
  readonly context: unknown;
}): { readonly result: PlannerEditResult; readonly place: Place } {
  const plan = TripPlanSchema.parse(input.plan);
  const customPoi = CustomPoiSchema.parse(input.customPoi);
  const context = PlannerRunContextSchema.parse(input.context);
  if (plan.customPois.some((candidate) => candidate.id === customPoi.id)) {
    throw new PlannerPlaceEditError('already-scheduled', `自定义地点已存在：${customPoi.name}`);
  }
  const place = customPoiToPlace(customPoi);
  const pair = commandPair({
    plan,
    commandId: input.commandId,
    type: 'create-custom-poi',
    inverseType: 'delete',
    targetIds: [customPoi.id],
    context,
    reason: '用户创建不参与当前自动规划的自定义地点候选。',
    inverseReason: '撤销自定义地点候选创建。',
    priority: customPoi.priority,
  });
  const explanation = `已保存自定义地点候选“${customPoi.name}”；它未加入日程，也未触发路线重算。`;
  const next = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    customPois: [...plan.customPois, customPoi],
    editHistory: [
      ...plan.editHistory,
      {
        commandId: pair.command.id,
        commandType: pair.command.type,
        appliedAt: context.now,
        explanation,
      },
    ],
  });
  return {
    place,
    result: {
      plan: next,
      command: pair.command,
      inverseCommand: pair.inverseCommand,
      explanation,
      focusItemId: null,
    },
  };
}

function affectedDayBuilds(input: {
  readonly plan: TripPlan;
  readonly places: readonly Place[];
  readonly remainingByDay: ReadonlyMap<string, readonly TripItem[]>;
  readonly context: PlannerRunContext;
}): Map<number, BuiltDay> {
  const builds = new Map<number, BuiltDay>();
  for (const [dayId, remaining] of input.remainingByDay) {
    const { index } = findDay(input.plan, dayId);
    builds.set(
      index,
      buildDay(
        index,
        scheduledPlaces(remaining, input.places, input.plan),
        input.plan.request,
        input.context,
      ),
    );
  }
  return builds;
}

export function removeItems(input: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
  readonly itemIds: readonly string[];
  readonly mode: 'disabled' | 'deleted';
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const places = input.places.map((place) => PlaceSchema.parse(place));
  const context = PlannerRunContextSchema.parse(input.context);
  const targetIds = Array.from(new Set(input.itemIds));
  if (targetIds.length === 0) throw new PlannerPlaceEditError('item-not-found', '没有选择地点。');
  const targetSet = new Set(targetIds);
  const located = plan.days.flatMap((day) =>
    placeItems(day).flatMap((item, index) =>
      targetSet.has(item.id) ? [{ day, item, index }] : [],
    ),
  );
  if (located.length !== targetIds.length) {
    throw new PlannerPlaceEditError('item-not-found', '部分所选地点已不存在。');
  }
  if (located.some(({ item }) => item.locked)) {
    throw new PlannerPlaceEditError('locked-item', '锁定地点不能删除或停用。');
  }
  for (const day of plan.days) {
    const items = placeItems(day);
    const firstRemovedIndex = items.findIndex((item) => targetSet.has(item.id));
    if (firstRemovedIndex >= 0 && items.slice(firstRemovedIndex + 1).some((item) => item.locked)) {
      throw new PlannerPlaceEditError('locked-item', '删除会改变后续锁定地点的时间，操作已拒绝。');
    }
  }
  const removedRecords: RemovedTripItem[] = located.map(({ day, item, index }) => ({
    schemaVersion: 1,
    createdAt: context.now,
    updatedAt: context.now,
    id: stableId('removed', `${plan.id}-${item.id}-${context.now}`),
    item,
    originalDayId: day.id,
    originalPlaceIndex: index,
    originalPriority: item.placeId
      ? (selectionFor(plan, item.placeId)?.priority ?? 'want')
      : 'want',
    removalMode: input.mode,
    removedAt: context.now,
  }));
  const removedPlaceIds = new Set(
    removedRecords.flatMap((record) => (record.item.placeId ? [record.item.placeId] : [])),
  );
  const candidatePlan = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    request: {
      ...plan.request,
      updatedAt: context.now,
      selections: plan.request.selections.map((selection) =>
        removedPlaceIds.has(selection.placeId)
          ? { ...selection, priority: 'exclude', locked: false }
          : selection,
      ),
    },
    removedItems: [...plan.removedItems, ...removedRecords],
    rejectedPlaces: [
      ...plan.rejectedPlaces.filter((entry) => !removedPlaceIds.has(entry.placeId)),
      ...Array.from(removedPlaceIds, (placeId) => ({
        placeId,
        reasonCode: input.mode === 'deleted' ? 'user-deleted' : 'user-disabled',
        explanation: input.mode === 'deleted' ? '用户从当前日程删除。' : '用户暂时停用。',
      })),
    ],
  });
  const remainingByDay = new Map<string, readonly TripItem[]>();
  for (const day of plan.days) {
    if (day.items.some((item) => targetSet.has(item.id))) {
      remainingByDay.set(
        day.id,
        placeItems(day).filter((item) => !targetSet.has(item.id)),
      );
    }
  }
  const pair = commandPair({
    plan: candidatePlan,
    commandId: input.commandId,
    type: input.mode === 'deleted' ? 'delete' : 'disable',
    inverseType: 'restore',
    targetIds,
    context,
    reason: input.mode === 'deleted' ? '用户批量删除所选地点。' : '用户批量停用所选地点。',
    inverseReason: '恢复被删除或停用的地点及原始优先级。',
  });
  const explanation = `${input.mode === 'deleted' ? '已删除' : '已停用'} ${targetIds.length} 个地点；恢复记录保留在计划回收区。`;
  const next = rebuildPlan({
    plan: candidatePlan,
    rebuiltDays: affectedDayBuilds({ plan: candidatePlan, places, remainingByDay, context }),
    command: pair.command,
    explanation,
    context,
  });
  return {
    plan: next,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId: null,
  };
}

export function restoreRemovedItems(input: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
  readonly removedItemIds: readonly string[];
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const places = input.places.map((place) => PlaceSchema.parse(place));
  const context = PlannerRunContextSchema.parse(input.context);
  const ids = Array.from(new Set(input.removedItemIds));
  const records = plan.removedItems.filter((record) => ids.includes(record.id));
  if (ids.length === 0 || records.length !== ids.length) {
    throw new PlannerPlaceEditError('item-not-found', '回收区中找不到所选地点。');
  }
  const placeById = new Map(places.map((place) => [place.id, place]));
  const restoredPlaceIds = records.flatMap((record) =>
    record.item.placeId === null ? [] : [record.item.placeId],
  );
  if (restoredPlaceIds.some((placeId) => !placeById.has(placeId))) {
    throw new PlannerPlaceEditError('place-not-found', '恢复所需地点数据不存在。');
  }
  const request = {
    ...plan.request,
    updatedAt: context.now,
    selections: plan.request.selections.map((selection) => {
      const record = records.find((candidate) => candidate.item.placeId === selection.placeId);
      return record
        ? { ...selection, priority: record.originalPriority, locked: record.item.locked }
        : selection;
    }),
  };
  const candidatePlan = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    request,
    removedItems: plan.removedItems.filter((record) => !ids.includes(record.id)),
    rejectedPlaces: plan.rejectedPlaces.filter(
      (entry) => !restoredPlaceIds.includes(entry.placeId),
    ),
  });
  const remainingByDay = new Map<string, readonly TripItem[]>();
  for (const groupDayId of new Set(records.map((record) => record.originalDayId))) {
    const { day } = findDay(candidatePlan, groupDayId);
    const current = placeItems(day);
    const group = records
      .filter((record) => record.originalDayId === groupDayId)
      .sort((left, right) => left.originalPlaceIndex - right.originalPlaceIndex);
    const next = [...current];
    for (const record of group) {
      if (next.slice(record.originalPlaceIndex).some((item) => item.locked)) {
        throw new PlannerPlaceEditError('locked-item', '恢复位置会后移锁定地点，操作已拒绝。');
      }
      next.splice(Math.min(record.originalPlaceIndex, next.length), 0, record.item);
    }
    remainingByDay.set(groupDayId, next);
  }
  const pair = commandPair({
    plan: candidatePlan,
    commandId: input.commandId,
    type: 'restore',
    inverseType: 'delete',
    targetIds: ids,
    context,
    reason: '用户从回收区恢复地点。',
    inverseReason: '撤销恢复并重新放回回收区。',
  });
  const explanation = `已恢复 ${records.length} 个地点，并按原日期、顺序和优先级重建日程。`;
  const next = rebuildPlan({
    plan: candidatePlan,
    rebuiltDays: affectedDayBuilds({ plan: candidatePlan, places, remainingByDay, context }),
    command: pair.command,
    explanation,
    context,
  });
  const firstPlaceId = records[0]?.item.placeId;
  const focusItemId = firstPlaceId
    ? (next.days.flatMap((day) => day.items).find((item) => item.placeId === firstPlaceId)?.id ??
      null)
    : null;
  return {
    plan: next,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId,
  };
}

export function moveItemsToDay(input: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
  readonly itemIds: readonly string[];
  readonly toDayId: string;
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const places = input.places.map((place) => PlaceSchema.parse(place));
  const context = PlannerRunContextSchema.parse(input.context);
  const targetIds = Array.from(new Set(input.itemIds));
  const { day: targetDay, index: targetDayIndex } = findDay(plan, input.toDayId);
  const targetSet = new Set(targetIds);
  const moved = plan.days.flatMap((day) =>
    placeItems(day).flatMap((item, index) =>
      targetSet.has(item.id) && day.id !== targetDay.id ? [{ day, item, index }] : [],
    ),
  );
  if (moved.length === 0) {
    throw new PlannerPlaceEditError('item-not-found', '没有需要跨日移动的所选地点。');
  }
  if (
    moved.length !==
    targetIds.filter((id) => !placeItems(targetDay).some((item) => item.id === id)).length
  ) {
    throw new PlannerPlaceEditError('item-not-found', '部分所选地点已不存在。');
  }
  if (moved.some(({ item }) => item.locked)) {
    throw new PlannerPlaceEditError('locked-item', '批量移动不能包含锁定地点。');
  }
  for (const sourceDay of new Set(moved.map(({ day }) => day))) {
    const items = placeItems(sourceDay);
    const firstIndex = items.findIndex((item) => targetSet.has(item.id));
    if (firstIndex >= 0 && items.slice(firstIndex + 1).some((item) => item.locked)) {
      throw new PlannerPlaceEditError('locked-item', '批量移出会改变来源日锁定地点，操作已拒绝。');
    }
  }
  const remainingByDay = new Map<string, readonly TripItem[]>();
  for (const sourceDay of new Set(moved.map(({ day }) => day))) {
    remainingByDay.set(
      sourceDay.id,
      placeItems(sourceDay).filter((item) => !targetSet.has(item.id)),
    );
  }
  remainingByDay.set(targetDay.id, [
    ...placeItems(targetDay),
    ...moved
      .sort(
        (left, right) => left.day.date.localeCompare(right.day.date) || left.index - right.index,
      )
      .map(({ item }) => item),
  ]);
  const pair = commandPair({
    plan,
    commandId: input.commandId,
    type: 'batch-set-date',
    inverseType: 'batch-set-date',
    targetIds,
    context,
    reason: '用户批量移动地点到指定日期。',
    inverseReason: '撤销批量跨日移动并恢复各来源日期。',
    toDayId: targetDay.id,
  });
  const explanation = `已将 ${moved.length} 个地点批量移到第 ${targetDayIndex + 1} 天，并只重算受影响日期。`;
  const next = rebuildPlan({
    plan,
    rebuiltDays: affectedDayBuilds({ plan, places, remainingByDay, context }),
    command: pair.command,
    explanation,
    context,
  });
  const firstPlaceId = moved[0]?.item.placeId;
  const focusItemId = firstPlaceId
    ? (next.days.flatMap((day) => day.items).find((item) => item.placeId === firstPlaceId)?.id ??
      null)
    : null;
  return {
    plan: next,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId,
  };
}
