import { z } from 'zod';

import { IdentifierSchema, IsoDateTimeSchema, VersionedMetadataSchema } from './common.js';
import { PlacePrioritySchema } from './trip-request.js';

export const EditCommandTypeSchema = z.enum([
  'move-within-day',
  'move-across-day',
  'move-half-day-module',
  'move-day-module',
  'split-module',
  'merge-module',
  'delete',
  'disable',
  'restore',
  'lock',
  'unlock',
  'replace',
  'copy',
  'undo',
  'redo',
  'batch-move',
  'batch-set-date',
  'batch-set-priority',
  'batch-delete',
  'batch-set-marker-style',
  'batch-set-route-style',
]);

export const EditCommandSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  planId: IdentifierSchema,
  type: EditCommandTypeSchema,
  issuedAt: IsoDateTimeSchema,
  actor: z.enum(['user', 'migration', 'system']),
  targetIds: z.array(IdentifierSchema).min(1),
  fromDayId: IdentifierSchema.nullable(),
  toDayId: IdentifierSchema.nullable(),
  beforeItemId: IdentifierSchema.nullable(),
  afterItemId: IdentifierSchema.nullable(),
  replacementId: IdentifierSchema.nullable(),
  priority: PlacePrioritySchema.nullable(),
  markerStyleId: IdentifierSchema.nullable(),
  routeStyleId: IdentifierSchema.nullable(),
  reason: z.string().max(2000),
  inverseCommandId: IdentifierSchema.nullable(),
});

export type EditCommand = z.infer<typeof EditCommandSchema>;
