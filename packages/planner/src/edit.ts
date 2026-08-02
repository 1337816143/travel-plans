import {
  EditCommandSchema,
  PlaceSchema,
  TripPlanSchema,
  type EditCommand,
  type Place,
  type TripDay,
  type TripItem,
  type TripPlan,
} from '@qingdao/schema';
import { z } from 'zod';

import { PlannerRunContextSchema, type PlannerRunContext } from './assumptions.js';
import type { PlannerEditResult } from './edit-result.js';
import { renumberTripPlan } from './numbering.js';
import { buildDay, stableId, type BuiltDay, type ScheduledPlace } from './schedule.js';

const MoveBaseInputSchema = z.object({
  plan: TripPlanSchema,
  places: z.array(PlaceSchema),
  itemId: z.string().trim().min(1),
  commandId: z.string().trim().min(1),
  context: PlannerRunContextSchema,
});

export const MoveWithinDayInputSchema = MoveBaseInputSchema.extend({
  dayId: z.string().trim().min(1),
  toPlaceIndex: z.number().int().nonnegative(),
});

export const MoveAcrossDayInputSchema = MoveBaseInputSchema.extend({
  fromDayId: z.string().trim().min(1),
  toDayId: z.string().trim().min(1),
  toPlaceIndex: z.number().int().nonnegative(),
});

export class PlannerEditError extends Error {
  readonly code:
    'day-not-found' | 'item-not-found' | 'locked-item' | 'invalid-index' | 'same-day-move';

  constructor(code: PlannerEditError['code'], message: string) {
    super(message);
    this.name = 'PlannerEditError';
    this.code = code;
  }
}

export interface PlannerMoveResult extends PlannerEditResult {
  readonly movedItemId: string;
}

export type MoveWithinDayResult = PlannerMoveResult;
export type MoveAcrossDayResult = PlannerMoveResult;

export interface RebuildPlanInput {
  readonly plan: TripPlan;
  readonly rebuiltDays: ReadonlyMap<number, BuiltDay>;
  readonly command: EditCommand;
  readonly explanation: string;
  readonly context: PlannerRunContext;
}

export function placeItems(day: TripDay): TripItem[] {
  return day.items.filter((item) => item.kind === 'place');
}

export function scheduledPlaces(
  items: readonly TripItem[],
  places: readonly Place[],
  plan: TripPlan,
): ScheduledPlace[] {
  const placeById = new Map<string, Place>(places.map((place) => [place.id, place]));
  const selectionById = new Map(
    plan.request.selections.map((selection) => [selection.placeId, selection]),
  );
  return items.map((item) => {
    if (item.placeId === null) throw new PlannerEditError('item-not-found', '地点项缺少 placeId。');
    const place = placeById.get(item.placeId);
    const selection = selectionById.get(item.placeId);
    if (!place || !selection || selection.priority === 'exclude') {
      throw new PlannerEditError('item-not-found', `重算缺少地点数据：${item.placeId}`);
    }
    return {
      place,
      priority: selection.priority,
      locked: selection.locked || item.locked,
      notes: item.notes,
    };
  });
}

function moveCommand(input: {
  readonly id: string;
  readonly inverseCommandId: string;
  readonly type: 'move-within-day' | 'move-across-day';
  readonly plan: TripPlan;
  readonly targetItemId: string;
  readonly fromDayId: string;
  readonly toDayId: string;
  readonly beforeItemId: string | null;
  readonly afterItemId: string | null;
  readonly reason: string;
  readonly context: PlannerRunContext;
}): EditCommand {
  return EditCommandSchema.parse({
    schemaVersion: 1,
    createdAt: input.context.now,
    updatedAt: input.context.now,
    id: input.id,
    planId: input.plan.id,
    type: input.type,
    issuedAt: input.context.now,
    actor: 'user',
    targetIds: [input.targetItemId],
    fromDayId: input.fromDayId,
    toDayId: input.toDayId,
    beforeItemId: input.beforeItemId,
    afterItemId: input.afterItemId,
    replacementId: null,
    priority: null,
    markerStyleId: null,
    routeStyleId: null,
    reason: input.reason,
    inverseCommandId: input.inverseCommandId,
  });
}

export function rebuildPlan(input: RebuildPlanInput): TripPlan {
  const affectedIndexes = new Set(input.rebuiltDays.keys());
  const affectedOldItemIds = new Set(
    input.plan.days
      .filter((_, index) => affectedIndexes.has(index))
      .flatMap((day) => day.items.map((item) => item.id)),
  );
  const oldPlaceIdByItemId = new Map(
    input.plan.days.flatMap((day) =>
      day.items.flatMap((item) => (item.placeId ? [[item.id, item.placeId] as const] : [])),
    ),
  );
  const days = input.plan.days.map((day, index) => input.rebuiltDays.get(index)?.day ?? day);
  const newItemIdByPlaceId = new Map(
    days.flatMap((day) =>
      day.items.flatMap((item) => (item.placeId ? [[item.placeId, item.id] as const] : [])),
    ),
  );
  const items = days.flatMap((day) => day.items);
  const unaffectedConflicts = input.plan.conflicts.filter(
    (conflict) => !conflict.itemIds.some((itemId) => affectedOldItemIds.has(itemId)),
  );
  const rebuiltConflicts = [...input.rebuiltDays.values()].flatMap((built) => built.conflicts);
  const risks = input.plan.risks.map((risk) => ({
    ...risk,
    itemIds: risk.itemIds.flatMap((itemId) => {
      if (!affectedOldItemIds.has(itemId)) return [itemId];
      const placeId = oldPlaceIdByItemId.get(itemId);
      const rebuiltId = placeId ? newItemIdByPlaceId.get(placeId) : undefined;
      return rebuiltId ? [rebuiltId] : [];
    }),
  }));

  const rebuiltPlan = TripPlanSchema.parse({
    ...input.plan,
    updatedAt: input.context.now,
    days,
    placeIds: Array.from(
      new Set(items.flatMap((item) => (item.placeId === null ? [] : [item.placeId]))),
    ),
    activityIds: items.map((item) => item.id),
    accommodationItemIds: items
      .filter((item) => item.kind === 'accommodation')
      .map((item) => item.id),
    reservationItemIds: items.filter((item) => item.kind === 'reservation').map((item) => item.id),
    mealItemIds: items.filter((item) => item.kind === 'meal').map((item) => item.id),
    restItemIds: items.filter((item) => item.kind === 'rest').map((item) => item.id),
    planBItemIds: items.filter((item) => item.planB).map((item) => item.id),
    conflicts: [...unaffectedConflicts, ...rebuiltConflicts],
    risks,
    estimationNotes: Array.from(
      new Set([
        ...input.plan.estimationNotes,
        ...[...input.rebuiltDays.values()].flatMap((built) => built.estimationNotes),
      ]),
    ),
    editHistory: [
      ...input.plan.editHistory,
      {
        commandId: input.command.id,
        commandType: input.command.type,
        appliedAt: input.context.now,
        explanation: input.explanation,
      },
    ],
  });
  return renumberTripPlan(rebuiltPlan, rebuiltPlan.markerNumbering, input.context.now);
}

export function moveItemWithinDay(
  rawInput: z.input<typeof MoveWithinDayInputSchema>,
): MoveWithinDayResult {
  const input = MoveWithinDayInputSchema.parse(rawInput);
  const dayIndex = input.plan.days.findIndex((day) => day.id === input.dayId);
  if (dayIndex < 0) throw new PlannerEditError('day-not-found', `找不到日期：${input.dayId}`);
  const day = input.plan.days[dayIndex];
  if (!day) throw new PlannerEditError('day-not-found', `找不到日期：${input.dayId}`);
  const items = placeItems(day);
  const fromIndex = items.findIndex((item) => item.id === input.itemId);
  if (fromIndex < 0)
    throw new PlannerEditError('item-not-found', `找不到地点日程项：${input.itemId}`);
  const movedItem = items[fromIndex];
  if (!movedItem) throw new PlannerEditError('item-not-found', `找不到地点日程项：${input.itemId}`);
  if (movedItem.locked) throw new PlannerEditError('locked-item', '锁定项不能移动。');
  if (input.toPlaceIndex >= items.length) {
    throw new PlannerEditError('invalid-index', `目标位置超出范围：${input.toPlaceIndex}`);
  }

  const lower = Math.min(fromIndex, input.toPlaceIndex);
  const upper = Math.max(fromIndex, input.toPlaceIndex);
  if (items.slice(lower, upper + 1).some((item) => item.locked && item.id !== movedItem.id)) {
    throw new PlannerEditError('locked-item', '不能跨越已锁定的日程项。');
  }

  const reordered = [...items];
  reordered.splice(fromIndex, 1);
  reordered.splice(input.toPlaceIndex, 0, movedItem);
  const rebuilt = buildDay(
    dayIndex,
    scheduledPlaces(reordered, input.places, input.plan),
    input.plan.request,
    input.context,
  );
  const inverseCommandId = stableId('command', `${input.commandId}-inverse`);
  const command = moveCommand({
    id: input.commandId,
    inverseCommandId,
    type: 'move-within-day',
    plan: input.plan,
    targetItemId: movedItem.id,
    fromDayId: day.id,
    toDayId: day.id,
    beforeItemId: reordered[input.toPlaceIndex - 1]?.id ?? null,
    afterItemId: reordered[input.toPlaceIndex + 1]?.id ?? null,
    reason: '用户调整同日地点顺序，Planner 重算受影响日期的时间与相邻路线。',
    context: input.context,
  });
  const inverseCommand = moveCommand({
    id: inverseCommandId,
    inverseCommandId: command.id,
    type: 'move-within-day',
    plan: input.plan,
    targetItemId: movedItem.id,
    fromDayId: day.id,
    toDayId: day.id,
    beforeItemId: items[fromIndex - 1]?.id ?? null,
    afterItemId: items[fromIndex + 1]?.id ?? null,
    reason: '撤销同日移动并恢复移动前的地点顺序。',
    context: input.context,
  });
  const explanation = `已将“${movedItem.customTitle}”从第 ${fromIndex + 1} 位移动到第 ${input.toPlaceIndex + 1} 位，并重算 ${rebuilt.day.routeSegments.length} 个相邻交通段。`;
  const plan = rebuildPlan({
    plan: input.plan,
    rebuiltDays: new Map([[dayIndex, rebuilt]]),
    command,
    explanation,
    context: input.context,
  });

  return {
    plan,
    command,
    inverseCommand,
    movedItemId: movedItem.id,
    focusItemId: movedItem.id,
    explanation,
  };
}

export function moveItemAcrossDay(
  rawInput: z.input<typeof MoveAcrossDayInputSchema>,
): MoveAcrossDayResult {
  const input = MoveAcrossDayInputSchema.parse(rawInput);
  if (input.fromDayId === input.toDayId) {
    throw new PlannerEditError('same-day-move', '跨日移动的起止日期必须不同。');
  }
  const fromDayIndex = input.plan.days.findIndex((day) => day.id === input.fromDayId);
  const toDayIndex = input.plan.days.findIndex((day) => day.id === input.toDayId);
  if (fromDayIndex < 0) {
    throw new PlannerEditError('day-not-found', `找不到来源日期：${input.fromDayId}`);
  }
  if (toDayIndex < 0) {
    throw new PlannerEditError('day-not-found', `找不到目标日期：${input.toDayId}`);
  }
  const fromDay = input.plan.days[fromDayIndex];
  const toDay = input.plan.days[toDayIndex];
  if (!fromDay || !toDay) throw new PlannerEditError('day-not-found', '跨日移动日期不存在。');
  const fromItems = placeItems(fromDay);
  const toItems = placeItems(toDay);
  const fromIndex = fromItems.findIndex((item) => item.id === input.itemId);
  const movedItem = fromItems[fromIndex];
  if (fromIndex < 0 || !movedItem) {
    throw new PlannerEditError('item-not-found', `找不到来源地点日程项：${input.itemId}`);
  }
  if (movedItem.locked) throw new PlannerEditError('locked-item', '锁定项不能跨日移动。');
  if (input.toPlaceIndex > toItems.length) {
    throw new PlannerEditError('invalid-index', `目标位置超出范围：${input.toPlaceIndex}`);
  }
  if (fromItems.slice(fromIndex + 1).some((item) => item.locked)) {
    throw new PlannerEditError('locked-item', '跨日移出会改变来源日后续锁定项，操作已拒绝。');
  }
  if (toItems.slice(input.toPlaceIndex).some((item) => item.locked)) {
    throw new PlannerEditError('locked-item', '跨日插入不能越过或后移目标日锁定项。');
  }

  const nextFromItems = [...fromItems];
  nextFromItems.splice(fromIndex, 1);
  const nextToItems = [...toItems];
  nextToItems.splice(input.toPlaceIndex, 0, movedItem);
  const rebuiltFrom = buildDay(
    fromDayIndex,
    scheduledPlaces(nextFromItems, input.places, input.plan),
    input.plan.request,
    input.context,
  );
  const rebuiltTo = buildDay(
    toDayIndex,
    scheduledPlaces(nextToItems, input.places, input.plan),
    input.plan.request,
    input.context,
  );
  const rebuiltMovedItem = rebuiltTo.day.items.find(
    (item) => item.kind === 'place' && item.placeId === movedItem.placeId,
  );
  if (!rebuiltMovedItem) {
    throw new PlannerEditError(
      'item-not-found',
      `跨日重算后找不到地点：${movedItem.placeId ?? ''}`,
    );
  }

  const inverseCommandId = stableId('command', `${input.commandId}-inverse`);
  const command = moveCommand({
    id: input.commandId,
    inverseCommandId,
    type: 'move-across-day',
    plan: input.plan,
    targetItemId: movedItem.id,
    fromDayId: fromDay.id,
    toDayId: toDay.id,
    beforeItemId: nextToItems[input.toPlaceIndex - 1]?.id ?? null,
    afterItemId: nextToItems[input.toPlaceIndex + 1]?.id ?? null,
    reason: '用户跨日移动地点，Planner 仅重算来源日期、目标日期及两日相邻路线。',
    context: input.context,
  });
  const inverseCommand = moveCommand({
    id: inverseCommandId,
    inverseCommandId: command.id,
    type: 'move-across-day',
    plan: input.plan,
    targetItemId: rebuiltMovedItem.id,
    fromDayId: toDay.id,
    toDayId: fromDay.id,
    beforeItemId: fromItems[fromIndex - 1]?.id ?? null,
    afterItemId: fromItems[fromIndex + 1]?.id ?? null,
    reason: '撤销跨日移动并恢复来源日期、目标日期及相邻路线。',
    context: input.context,
  });
  const explanation = `已将“${movedItem.customTitle}”从第 ${fromDayIndex + 1} 天移至第 ${toDayIndex + 1} 天，并只重算两天共 ${rebuiltFrom.day.routeSegments.length + rebuiltTo.day.routeSegments.length} 个相邻交通段。`;
  const plan = rebuildPlan({
    plan: input.plan,
    rebuiltDays: new Map([
      [fromDayIndex, rebuiltFrom],
      [toDayIndex, rebuiltTo],
    ]),
    command,
    explanation,
    context: input.context,
  });

  return {
    plan,
    command,
    inverseCommand,
    movedItemId: rebuiltMovedItem.id,
    focusItemId: rebuiltMovedItem.id,
    explanation,
  };
}

export function deterministicCommandId(
  plan: TripPlan,
  itemId: string,
  targetIndex: number,
): string {
  return stableId('command', `${plan.id}-${plan.editHistory.length}-${itemId}-${targetIndex}`);
}

export function deterministicAcrossDayCommandId(
  plan: TripPlan,
  itemId: string,
  targetDayId: string,
  targetIndex: number,
): string {
  return stableId(
    'command',
    `${plan.id}-${plan.editHistory.length}-${itemId}-${targetDayId}-${targetIndex}`,
  );
}
