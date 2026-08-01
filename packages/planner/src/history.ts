import {
  EditCommandSchema,
  PersistedPlannerHistorySchema,
  PersistedPlannerHistoryEntrySchema,
  TripPlanSchema,
  type EditCommand,
  type PersistedPlannerHistory,
  type PersistedPlannerHistoryEntry,
  type TripPlan,
} from '@qingdao/schema';

import { PlannerRunContextSchema, type PlannerRunContext } from './assumptions.js';
import type { PlannerEditResult } from './edit-result.js';
import { stableId } from './schedule.js';

export const MAX_HISTORY_ENTRIES = 50;

export type PlannerHistoryEntry = PersistedPlannerHistoryEntry;

export interface PlannerHistoryState {
  readonly past: readonly PlannerHistoryEntry[];
  readonly future: readonly PlannerHistoryEntry[];
}

export interface PlannerHistoryResult {
  readonly plan: TripPlan;
  readonly history: PlannerHistoryState;
  readonly command: EditCommand;
  readonly explanation: string;
}

export class PlannerHistoryError extends Error {
  readonly code: 'nothing-to-undo' | 'nothing-to-redo';

  constructor(code: PlannerHistoryError['code'], message: string) {
    super(message);
    this.name = 'PlannerHistoryError';
    this.code = code;
  }
}

export function createPlannerHistoryState(
  persisted?: PersistedPlannerHistory | null,
): PlannerHistoryState {
  if (!persisted) return { past: [], future: [] };
  const parsed = PersistedPlannerHistorySchema.parse(persisted);
  return { past: parsed.past, future: parsed.future };
}

export function persistPlannerHistory(
  planId: string,
  history: PlannerHistoryState,
  now: string,
): PersistedPlannerHistory {
  return PersistedPlannerHistorySchema.parse({
    schemaVersion: 1,
    createdAt: history.past[0]?.createdAt ?? history.future[0]?.createdAt ?? now,
    updatedAt: now,
    id: `planner-history-${planId}`,
    planId,
    past: history.past,
    future: history.future,
  });
}

export function recordPlannerEdit(
  history: PlannerHistoryState,
  before: TripPlan,
  result: PlannerEditResult,
): PlannerHistoryState {
  const entry: PlannerHistoryEntry = PersistedPlannerHistoryEntrySchema.parse({
    schemaVersion: 1,
    createdAt: result.command.issuedAt,
    updatedAt: result.command.issuedAt,
    id: result.command.id,
    before: TripPlanSchema.parse(before),
    after: TripPlanSchema.parse(result.plan),
    command: EditCommandSchema.parse(result.command),
    inverseCommand: EditCommandSchema.parse(result.inverseCommand),
    explanation: result.explanation,
  });
  return { past: [...history.past, entry].slice(-MAX_HISTORY_ENTRIES), future: [] };
}

function historyCommand(input: {
  readonly type: 'undo' | 'redo';
  readonly plan: TripPlan;
  readonly source: EditCommand;
  readonly entry: PlannerHistoryEntry;
  readonly context: PlannerRunContext;
}): EditCommand {
  const id = stableId(
    'command',
    `${input.plan.id}-${input.type}-${input.entry.id}-${input.plan.editHistory.length}`,
  );
  return EditCommandSchema.parse({
    schemaVersion: 1,
    createdAt: input.context.now,
    updatedAt: input.context.now,
    id,
    planId: input.plan.id,
    type: input.type,
    issuedAt: input.context.now,
    actor: 'user',
    targetIds: input.source.targetIds,
    fromDayId: input.source.fromDayId,
    toDayId: input.source.toDayId,
    beforeItemId: input.source.beforeItemId,
    afterItemId: input.source.afterItemId,
    replacementId: null,
    priority: null,
    markerStyleId: null,
    routeStyleId: null,
    reason:
      input.type === 'undo'
        ? `撤销命令 ${input.entry.command.id}：${input.entry.explanation}`
        : `重做命令 ${input.entry.command.id}：${input.entry.explanation}`,
    inverseCommandId:
      input.type === 'undo' ? input.entry.command.id : input.entry.inverseCommand.id,
  });
}

function restorePlan(
  snapshot: TripPlan,
  current: TripPlan,
  command: EditCommand,
  explanation: string,
  context: PlannerRunContext,
): TripPlan {
  return TripPlanSchema.parse({
    ...snapshot,
    updatedAt: context.now,
    editHistory: [
      ...current.editHistory,
      {
        commandId: command.id,
        commandType: command.type,
        appliedAt: context.now,
        explanation,
      },
    ],
  });
}

export function undoPlannerEdit(input: {
  readonly plan: TripPlan;
  readonly history: PlannerHistoryState;
  readonly context: unknown;
}): PlannerHistoryResult {
  const context = PlannerRunContextSchema.parse(input.context);
  const entry = input.history.past.at(-1);
  if (!entry) throw new PlannerHistoryError('nothing-to-undo', '当前没有可以撤销的编辑。');
  const command = historyCommand({
    type: 'undo',
    plan: input.plan,
    source: entry.inverseCommand,
    entry,
    context,
  });
  const explanation = `已撤销：${entry.explanation}`;
  const plan = restorePlan(entry.before, input.plan, command, explanation, context);
  return {
    plan,
    history: {
      past: input.history.past.slice(0, -1),
      future: [...input.history.future, entry],
    },
    command,
    explanation,
  };
}

export function redoPlannerEdit(input: {
  readonly plan: TripPlan;
  readonly history: PlannerHistoryState;
  readonly context: unknown;
}): PlannerHistoryResult {
  const context = PlannerRunContextSchema.parse(input.context);
  const entry = input.history.future.at(-1);
  if (!entry) throw new PlannerHistoryError('nothing-to-redo', '当前没有可以重做的编辑。');
  const command = historyCommand({
    type: 'redo',
    plan: input.plan,
    source: entry.command,
    entry,
    context,
  });
  const explanation = `已重做：${entry.explanation}`;
  const plan = restorePlan(entry.after, input.plan, command, explanation, context);
  return {
    plan,
    history: {
      past: [...input.history.past, entry],
      future: input.history.future.slice(0, -1),
    },
    command,
    explanation,
  };
}
