import {
  EditCommandSchema,
  PlaceSchema,
  TripPlanSchema,
  type EditCommand,
  type Place,
  type TripPlan,
} from '@qingdao/schema';
import { z } from 'zod';

import { PlannerRunContextSchema } from './assumptions.js';
import { buildDay, stableId, type ScheduledPlace } from './schedule.js';

export const MoveWithinDayInputSchema = z.object({
  plan: TripPlanSchema,
  places: z.array(PlaceSchema),
  dayId: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
  toPlaceIndex: z.number().int().nonnegative(),
  commandId: z.string().trim().min(1),
  context: PlannerRunContextSchema,
});

export class PlannerEditError extends Error {
  readonly code: 'day-not-found' | 'item-not-found' | 'locked-item' | 'invalid-index';

  constructor(code: PlannerEditError['code'], message: string) {
    super(message);
    this.name = 'PlannerEditError';
    this.code = code;
  }
}

export interface MoveWithinDayResult {
  readonly plan: TripPlan;
  readonly command: EditCommand;
  readonly explanation: string;
}

export function moveItemWithinDay(rawInput: z.input<typeof MoveWithinDayInputSchema>): MoveWithinDayResult {
  const input = MoveWithinDayInputSchema.parse(rawInput);
  const dayIndex = input.plan.days.findIndex((day) => day.id === input.dayId);
  if (dayIndex < 0) throw new PlannerEditError('day-not-found', `找不到日期：${input.dayId}`);
  const day = input.plan.days[dayIndex];
  if (!day) throw new PlannerEditError('day-not-found', `找不到日期：${input.dayId}`);
  const placeItems = day.items.filter((item) => item.kind === 'place');
  const fromIndex = placeItems.findIndex((item) => item.id === input.itemId);
  if (fromIndex < 0) throw new PlannerEditError('item-not-found', `找不到地点日程项：${input.itemId}`);
  const movedItem = placeItems[fromIndex];
  if (!movedItem) throw new PlannerEditError('item-not-found', `找不到地点日程项：${input.itemId}`);
  if (movedItem.locked) throw new PlannerEditError('locked-item', '锁定项不能移动。');
  if (input.toPlaceIndex >= placeItems.length) {
    throw new PlannerEditError('invalid-index', `目标位置超出范围：${input.toPlaceIndex}`);
  }

  const lower = Math.min(fromIndex, input.toPlaceIndex);
  const upper = Math.max(fromIndex, input.toPlaceIndex);
  if (placeItems.slice(lower, upper + 1).some((item) => item.locked && item.id !== movedItem.id)) {
    throw new PlannerEditError('locked-item', '不能跨越已锁定的日程项。');
  }

  const reordered = [...placeItems];
  reordered.splice(fromIndex, 1);
  reordered.splice(input.toPlaceIndex, 0, movedItem);
  const placeById = new Map<string, Place>(input.places.map((place) => [place.id, place]));
  const selectionById = new Map(
    input.plan.request.selections.map((selection) => [selection.placeId, selection]),
  );
  const scheduled: ScheduledPlace[] = reordered.map((item) => {
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
  const rebuilt = buildDay(dayIndex, scheduled, input.plan.request, input.context);
  const beforeItem = reordered[input.toPlaceIndex - 1];
  const afterItem = reordered[input.toPlaceIndex + 1];
  const command = EditCommandSchema.parse({
    schemaVersion: 1,
    createdAt: input.context.now,
    updatedAt: input.context.now,
    id: input.commandId,
    planId: input.plan.id,
    type: 'move-within-day',
    issuedAt: input.context.now,
    actor: 'user',
    targetIds: [movedItem.id],
    fromDayId: day.id,
    toDayId: day.id,
    beforeItemId: beforeItem?.id ?? null,
    afterItemId: afterItem?.id ?? null,
    replacementId: null,
    priority: null,
    markerStyleId: null,
    routeStyleId: null,
    reason: '用户调整同日地点顺序，Planner 重算受影响日期的时间与相邻路线。',
    inverseCommandId: null,
  });
  const newDays = input.plan.days.map((existingDay, index) =>
    index === dayIndex ? rebuilt.day : existingDay,
  );
  const oldDayItemIds = new Set(day.items.map((item) => item.id));
  const unaffectedConflicts = input.plan.conflicts.filter(
    (conflict) => !conflict.itemIds.some((itemId) => oldDayItemIds.has(itemId)),
  );
  const explanation = `已将“${movedItem.customTitle}”从第 ${fromIndex + 1} 位移动到第 ${input.toPlaceIndex + 1} 位，并重算 ${rebuilt.day.routeSegments.length} 个相邻交通段。`;
  const plan = TripPlanSchema.parse({
    ...input.plan,
    updatedAt: input.context.now,
    days: newDays,
    activityIds: newDays.flatMap((currentDay) => currentDay.items.map((item) => item.id)),
    restItemIds: newDays.flatMap((currentDay) =>
      currentDay.items.filter((item) => item.kind === 'rest').map((item) => item.id),
    ),
    conflicts: [...unaffectedConflicts, ...rebuilt.conflicts],
    estimationNotes: Array.from(new Set([...input.plan.estimationNotes, ...rebuilt.estimationNotes])),
    editHistory: [
      ...input.plan.editHistory,
      {
        commandId: command.id,
        commandType: command.type,
        appliedAt: input.context.now,
        explanation,
      },
    ],
  });

  return { plan, command, explanation };
}

export function deterministicCommandId(plan: TripPlan, itemId: string, targetIndex: number): string {
  return stableId('command', `${plan.id}-${plan.editHistory.length}-${itemId}-${targetIndex}`);
}
