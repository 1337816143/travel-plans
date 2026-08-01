import {
  MarkerNumberingSettingsSchema,
  MarkerStyleSchema,
  PlacePrioritySchema,
  RouteStyleSchema,
  TripPlanSchema,
  type MarkerNumberingSettings,
  type MarkerStyle,
  type PlacePriority,
  type RouteStyle,
  type TripPlan,
} from '@qingdao/schema';

import { PlannerRunContextSchema } from './assumptions.js';
import { appendAuditEntry, createEditCommand, type PlannerEditResult } from './edit-result.js';
import { renumberTripPlan } from './numbering.js';
import { stableId } from './schedule.js';

export class PlannerItemEditError extends Error {
  readonly code: 'item-not-found' | 'locked-item' | 'route-not-found';

  constructor(code: PlannerItemEditError['code'], message: string) {
    super(message);
    this.name = 'PlannerItemEditError';
    this.code = code;
  }
}

function upsertById<T extends { readonly id: string }>(items: readonly T[], value: T): T[] {
  const index = items.findIndex((item) => item.id === value.id);
  if (index < 0) return [...items, value];
  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function commandPair(input: {
  readonly plan: TripPlan;
  readonly commandId: string;
  readonly type:
    | 'lock'
    | 'unlock'
    | 'batch-set-priority'
    | 'batch-set-marker-style'
    | 'batch-set-route-style'
    | 'set-marker-numbering';
  readonly inverseType:
    | 'lock'
    | 'unlock'
    | 'batch-set-priority'
    | 'batch-set-marker-style'
    | 'batch-set-route-style'
    | 'set-marker-numbering';
  readonly targetIds: readonly string[];
  readonly reason: string;
  readonly inverseReason: string;
  readonly context: ReturnType<typeof PlannerRunContextSchema.parse>;
  readonly markerStyleId?: string | null;
  readonly routeStyleId?: string | null;
  readonly priority?: PlacePriority | null;
}): {
  readonly command: ReturnType<typeof createEditCommand>;
  readonly inverseCommand: ReturnType<typeof createEditCommand>;
} {
  const inverseCommandId = stableId('command', `${input.commandId}-inverse`);
  const command = createEditCommand({
    id: input.commandId,
    inverseCommandId,
    type: input.type,
    plan: input.plan,
    targetIds: input.targetIds,
    context: input.context,
    reason: input.reason,
    markerStyleId: input.markerStyleId,
    routeStyleId: input.routeStyleId,
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
  });
  return { command, inverseCommand };
}

export function setItemsPriority(input: {
  readonly plan: unknown;
  readonly itemIds: readonly string[];
  readonly priority: unknown;
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const context = PlannerRunContextSchema.parse(input.context);
  const priority = PlacePrioritySchema.exclude(['exclude']).parse(input.priority);
  const targetIds = Array.from(new Set(input.itemIds));
  const activeItems = plan.days.flatMap((day) => day.items);
  const selectedItems = targetIds.map((id) => activeItems.find((item) => item.id === id));
  if (
    targetIds.length === 0 ||
    selectedItems.some((item) => !item || item.kind !== 'place' || item.placeId === null)
  ) {
    throw new PlannerItemEditError('item-not-found', '批量优先级只能应用到仍在日程中的地点。');
  }
  const placeIds = new Set(
    selectedItems.flatMap((item) => (item?.placeId ? [item.placeId] : [])),
  );
  if (placeIds.size !== selectedItems.length) {
    throw new PlannerItemEditError('item-not-found', '部分所选地点缺少可编辑的选择记录。');
  }
  const knownSelections = new Set(plan.request.selections.map((selection) => selection.placeId));
  if ([...placeIds].some((placeId) => !knownSelections.has(placeId))) {
    throw new PlannerItemEditError('item-not-found', '部分所选地点缺少 TripRequest 选择记录。');
  }
  const pair = commandPair({
    plan,
    commandId: input.commandId,
    type: 'batch-set-priority',
    inverseType: 'batch-set-priority',
    targetIds,
    priority,
    reason: '用户显式批量修改地点优先级。',
    inverseReason: '撤销批量优先级修改并恢复编辑前快照。',
    context,
  });
  const targetSet = new Set(targetIds);
  const explanation = `已将 ${targetIds.length} 个地点的优先级设为 ${priority}；日期、顺序与锁定状态保持不变。`;
  const next = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    request: {
      ...plan.request,
      updatedAt: context.now,
      selections: plan.request.selections.map((selection) =>
        placeIds.has(selection.placeId) ? { ...selection, priority } : selection,
      ),
    },
    customPois: plan.customPois.map((poi) =>
      placeIds.has(poi.id) ? { ...poi, priority, updatedAt: context.now } : poi,
    ),
    days: plan.days.map((day) => {
      const changed = day.items.some((item) => targetSet.has(item.id));
      return changed
        ? {
            ...day,
            updatedAt: context.now,
            items: day.items.map((item) =>
              targetSet.has(item.id)
                ? { ...item, optional: priority === 'optional', updatedAt: context.now }
                : item,
            ),
          }
        : day;
    }),
    editHistory: appendAuditEntry(plan, pair.command, explanation, context.now),
  });
  return {
    plan: next,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId: targetIds[0] ?? null,
  };
}

export function setItemsLocked(input: {
  readonly plan: unknown;
  readonly itemIds: readonly string[];
  readonly locked: boolean;
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const context = PlannerRunContextSchema.parse(input.context);
  const targetIds = Array.from(new Set(input.itemIds));
  if (targetIds.length === 0) throw new PlannerItemEditError('item-not-found', '没有选择日程项。');
  const existingIds = new Set(plan.days.flatMap((day) => day.items.map((item) => item.id)));
  const missing = targetIds.find((id) => !existingIds.has(id));
  if (missing) throw new PlannerItemEditError('item-not-found', `找不到日程项：${missing}`);
  const pair = commandPair({
    plan,
    commandId: input.commandId,
    type: input.locked ? 'lock' : 'unlock',
    inverseType: input.locked ? 'unlock' : 'lock',
    targetIds,
    reason: input.locked ? '用户锁定所选日程项。' : '用户解锁所选日程项。',
    inverseReason: input.locked ? '撤销锁定所选日程项。' : '撤销解锁所选日程项。',
    context,
  });
  const targetSet = new Set(targetIds);
  const days = plan.days.map((day) => ({
    ...day,
    updatedAt: day.items.some((item) => targetSet.has(item.id)) ? context.now : day.updatedAt,
    items: day.items.map((item) =>
      targetSet.has(item.id) ? { ...item, locked: input.locked, updatedAt: context.now } : item,
    ),
  }));
  const placeIds = new Set(
    days.flatMap((day) =>
      day.items.flatMap((item) =>
        targetSet.has(item.id) && item.placeId !== null ? [item.placeId] : [],
      ),
    ),
  );
  const request = {
    ...plan.request,
    updatedAt: context.now,
    selections: plan.request.selections.map((selection) =>
      placeIds.has(selection.placeId) ? { ...selection, locked: input.locked } : selection,
    ),
  };
  const explanation = `${input.locked ? '已锁定' : '已解锁'} ${targetIds.length} 个日程项；锁定内容不会被后续移动或批量操作静默改变。`;
  const next = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    request,
    days,
    editHistory: appendAuditEntry(plan, pair.command, explanation, context.now),
  });
  return {
    plan: next,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId: targetIds[0] ?? null,
  };
}

export function setItemsMarkerStyle(input: {
  readonly plan: unknown;
  readonly itemIds: readonly string[];
  readonly style: unknown;
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const style: MarkerStyle = MarkerStyleSchema.parse(input.style);
  const context = PlannerRunContextSchema.parse(input.context);
  const targetIds = Array.from(new Set(input.itemIds));
  const activeItems = plan.days.flatMap((day) => day.items);
  if (targetIds.length === 0 || targetIds.some((id) => !activeItems.some((item) => item.id === id))) {
    throw new PlannerItemEditError('item-not-found', '所选地点已不存在，无法设置 Logo。');
  }
  const pair = commandPair({
    plan,
    commandId: input.commandId,
    type: 'batch-set-marker-style',
    inverseType: 'batch-set-marker-style',
    targetIds,
    markerStyleId: style.id,
    reason: '用户批量设置地点 Logo；编号仍由独立编号配置生成。',
    inverseReason: '撤销批量地点 Logo 设置。',
    context,
  });
  const targetSet = new Set(targetIds);
  const explanation = `已为 ${targetIds.length} 个地点应用“${style.iconId}”Logo；地图编号保持独立。`;
  const next = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    markerStyles: upsertById(plan.markerStyles, { ...style, updatedAt: context.now }),
    days: plan.days.map((day) => {
      const changed = day.items.some((item) => targetSet.has(item.id));
      return changed
        ? {
            ...day,
            updatedAt: context.now,
            items: day.items.map((item) =>
              targetSet.has(item.id)
                ? { ...item, markerStyleId: style.id, updatedAt: context.now }
                : item,
            ),
          }
        : day;
    }),
    editHistory: appendAuditEntry(plan, pair.command, explanation, context.now),
  });
  return {
    plan: next,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId: targetIds[0] ?? null,
  };
}

export function setRouteStyleForSegments(input: {
  readonly plan: unknown;
  readonly segmentIds: readonly string[];
  readonly style: unknown;
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const style: RouteStyle = RouteStyleSchema.parse(input.style);
  const context = PlannerRunContextSchema.parse(input.context);
  const targetIds = Array.from(new Set(input.segmentIds));
  const existing = new Set(plan.days.flatMap((day) => day.routeSegments.map((route) => route.id)));
  if (targetIds.length === 0 || targetIds.some((id) => !existing.has(id))) {
    throw new PlannerItemEditError('route-not-found', '没有可应用样式的路线段。');
  }
  const pair = commandPair({
    plan,
    commandId: input.commandId,
    type: 'batch-set-route-style',
    inverseType: 'batch-set-route-style',
    targetIds,
    routeStyleId: style.id,
    reason: '用户批量设置路线视觉样式；路线距离和时间不参与修改。',
    inverseReason: '撤销批量路线视觉样式设置。',
    context,
  });
  const targetSet = new Set(targetIds);
  const explanation = `已更新 ${targetIds.length} 个路线段的视觉样式；距离、时间、Provider 与折线语义均未改变。`;
  const next = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    routeStyles: upsertById(plan.routeStyles, { ...style, updatedAt: context.now }),
    days: plan.days.map((day) => {
      const changed = day.routeSegments.some((segment) => targetSet.has(segment.id));
      return changed
        ? {
            ...day,
            updatedAt: context.now,
            routeSegments: day.routeSegments.map((segment) =>
              targetSet.has(segment.id)
                ? { ...segment, routeStyleId: style.id, updatedAt: context.now }
                : segment,
            ),
          }
        : day;
    }),
    editHistory: appendAuditEntry(plan, pair.command, explanation, context.now),
  });
  return {
    plan: next,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId: null,
  };
}

export function setMarkerNumbering(input: {
  readonly plan: unknown;
  readonly settings: unknown;
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult {
  const plan = TripPlanSchema.parse(input.plan);
  const context = PlannerRunContextSchema.parse(input.context);
  const settings: MarkerNumberingSettings = MarkerNumberingSettingsSchema.parse(input.settings);
  const pair = commandPair({
    plan,
    commandId: input.commandId,
    type: 'set-marker-numbering',
    inverseType: 'set-marker-numbering',
    targetIds: [plan.id],
    reason: '用户修改全计划地图编号规则；Logo 资源不参与修改。',
    inverseReason: '撤销地图编号规则修改。',
    context,
  });
  const explanation = `地图编号已切换为 ${settings.mode}，起始编号 ${settings.startNumber}；日程、地图与打印模型同步更新。`;
  const numbered = renumberTripPlan(
    {
      ...plan,
      editHistory: appendAuditEntry(plan, pair.command, explanation, context.now),
    },
    { ...settings, updatedAt: context.now },
    context.now,
  );
  return {
    plan: numbered,
    command: pair.command,
    inverseCommand: pair.inverseCommand,
    explanation,
    focusItemId: null,
  };
}
