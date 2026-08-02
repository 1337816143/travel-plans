import { z } from 'zod';

import { IdentifierSchema, IsoDateTimeSchema, VersionedMetadataSchema } from './common.js';
import { TripPlanSchema } from './trip-plan.js';
import { EditCommandSchema } from './edit-command.js';

export const PersistedPlannerHistoryEntrySchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  before: TripPlanSchema,
  after: TripPlanSchema,
  command: EditCommandSchema,
  inverseCommand: EditCommandSchema,
  explanation: z.string().trim().min(1).max(2000),
});

export const PersistedPlannerHistorySchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  planId: IdentifierSchema,
  past: z.array(PersistedPlannerHistoryEntrySchema).max(50),
  future: z.array(PersistedPlannerHistoryEntrySchema).max(50),
});

export const PlanSnapshotSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  planId: IdentifierSchema,
  label: z.string().trim().min(1).max(240),
  capturedAt: IsoDateTimeSchema,
  plan: TripPlanSchema,
});

export const StoredPlanCollectionSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  plans: z.array(TripPlanSchema),
  snapshots: z.array(PlanSnapshotSchema),
  archivedPlanIds: z.array(IdentifierSchema),
  deletedPlanIds: z.array(IdentifierSchema),
  activePlanId: IdentifierSchema.nullable().default(null),
  plannerHistories: z.array(PersistedPlannerHistorySchema).default([]),
}).superRefine((collection, context) => {
  const planIds = collection.plans.map((plan) => plan.id);
  const known = new Set(planIds);
  const duplicatePlanId = planIds.find((id, index) => planIds.indexOf(id) !== index);
  if (duplicatePlanId) {
    context.addIssue({
      code: 'custom',
      path: ['plans'],
      message: `计划 ID 重复：${duplicatePlanId}`,
    });
  }
  collection.archivedPlanIds.forEach((id, index) => {
    if (!known.has(id)) {
      context.addIssue({
        code: 'custom',
        path: ['archivedPlanIds', index],
        message: '归档计划不存在',
      });
    }
  });
  collection.deletedPlanIds.forEach((id, index) => {
    if (!known.has(id)) {
      context.addIssue({
        code: 'custom',
        path: ['deletedPlanIds', index],
        message: '删除计划不存在',
      });
    }
    if (collection.archivedPlanIds.includes(id)) {
      context.addIssue({
        code: 'custom',
        path: ['deletedPlanIds', index],
        message: '计划不能同时归档和删除',
      });
    }
  });
  if (
    collection.activePlanId !== null &&
    (!known.has(collection.activePlanId) ||
      collection.deletedPlanIds.includes(collection.activePlanId))
  ) {
    context.addIssue({ code: 'custom', path: ['activePlanId'], message: '当前计划不存在或已删除' });
  }
  const historyPlanIds = collection.plannerHistories.map((history) => history.planId);
  historyPlanIds.forEach((id, index) => {
    if (!known.has(id)) {
      context.addIssue({
        code: 'custom',
        path: ['plannerHistories', index, 'planId'],
        message: '历史计划不存在',
      });
    }
    if (historyPlanIds.indexOf(id) !== index) {
      context.addIssue({
        code: 'custom',
        path: ['plannerHistories', index, 'planId'],
        message: '同一计划存在多份历史',
      });
    }
  });
});

export const ImportExportBundleSchema = VersionedMetadataSchema.extend({
  format: z.literal('qingdao-travel-plans-v3'),
  exportedAt: IsoDateTimeSchema,
  appVersion: z.string().trim().min(1).max(80),
  dataVersion: z.string().trim().min(1).max(80),
  collection: StoredPlanCollectionSchema,
  checksum: z.string().trim().min(1).max(256),
});

export type ImportExportBundle = z.infer<typeof ImportExportBundleSchema>;
export type PersistedPlannerHistory = z.infer<typeof PersistedPlannerHistorySchema>;
export type PersistedPlannerHistoryEntry = z.infer<typeof PersistedPlannerHistoryEntrySchema>;
export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;
export type StoredPlanCollection = z.infer<typeof StoredPlanCollectionSchema>;
