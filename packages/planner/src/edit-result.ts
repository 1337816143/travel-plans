import {
  EditCommandSchema,
  type EditCommand,
  type EditCommandTypeSchema,
  type PlacePriority,
  type TripPlan,
} from '@qingdao/schema';
import type { z } from 'zod';

import type { PlannerRunContext } from './assumptions.js';

type EditCommandType = z.infer<typeof EditCommandTypeSchema>;

export interface PlannerEditResult {
  readonly plan: TripPlan;
  readonly command: EditCommand;
  readonly inverseCommand: EditCommand;
  readonly explanation: string;
  readonly focusItemId: string | null;
}

export function createEditCommand(input: {
  readonly id: string;
  readonly inverseCommandId: string;
  readonly type: EditCommandType;
  readonly plan: TripPlan;
  readonly targetIds: readonly string[];
  readonly context: PlannerRunContext;
  readonly reason: string;
  readonly fromDayId?: string | null | undefined;
  readonly toDayId?: string | null | undefined;
  readonly beforeItemId?: string | null | undefined;
  readonly afterItemId?: string | null | undefined;
  readonly replacementId?: string | null | undefined;
  readonly priority?: PlacePriority | null | undefined;
  readonly markerStyleId?: string | null | undefined;
  readonly routeStyleId?: string | null | undefined;
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
    targetIds: [...input.targetIds],
    fromDayId: input.fromDayId ?? null,
    toDayId: input.toDayId ?? null,
    beforeItemId: input.beforeItemId ?? null,
    afterItemId: input.afterItemId ?? null,
    replacementId: input.replacementId ?? null,
    priority: input.priority ?? null,
    markerStyleId: input.markerStyleId ?? null,
    routeStyleId: input.routeStyleId ?? null,
    reason: input.reason,
    inverseCommandId: input.inverseCommandId,
  });
}

export function appendAuditEntry(
  plan: TripPlan,
  command: EditCommand,
  explanation: string,
  now: string,
): TripPlan['editHistory'] {
  return [
    ...plan.editHistory,
    {
      commandId: command.id,
      commandType: command.type,
      appliedAt: now,
      explanation,
    },
  ];
}
