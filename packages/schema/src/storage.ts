import { z } from 'zod';

import {
  IdentifierSchema,
  IsoDateTimeSchema,
  VersionedMetadataSchema,
} from './common.js';
import { TripPlanSchema } from './trip-plan.js';

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
export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;
export type StoredPlanCollection = z.infer<typeof StoredPlanCollectionSchema>;
