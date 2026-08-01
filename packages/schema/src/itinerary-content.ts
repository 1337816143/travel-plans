import { z } from 'zod';

import {
  IdentifierSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  ReviewStatusSchema,
  TimeOfDaySchema,
  VersionedMetadataSchema,
} from './common.js';
import { QingdaoDistrictSchema } from './content.js';
import { RouteModeSchema } from './styles.js';

export const ItineraryModuleSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  recommendedDurationMinutes: z.number().int().positive().max(2880),
  minimumDurationMinutes: z.number().int().positive().max(2880),
  districts: z.array(QingdaoDistrictSchema).min(1),
  placeIds: z.array(IdentifierSchema).min(1),
  suitableFor: z.array(z.string().trim().min(1).max(120)),
  fitnessIntensity: z.enum(['low', 'medium', 'high']),
  recommendedWindows: z.array(
    z.object({
      start: TimeOfDaySchema,
      end: TimeOfDaySchema,
    }),
  ),
  openingConstraints: z.array(z.string().trim().min(1).max(1000)),
  weatherConstraints: z.array(z.string().trim().min(1).max(1000)),
  reservationIds: z.array(IdentifierSchema),
  transportModes: z.array(RouteModeSchema),
  mealNotes: z.string().max(2000),
  restNotes: z.string().max(2000),
  planBModuleIds: z.array(IdentifierSchema),
  sourceRefIds: z.array(IdentifierSchema).min(1),
  splittableInto: z.array(IdentifierSchema),
  mergeableWith: z.array(IdentifierSchema),
  conflictsWith: z.array(IdentifierSchema),
  rationale: z.string().trim().min(1).max(3000),
});

export const PresetPlanSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(3000),
  totalDays: z.number().int().min(1).max(30),
  moduleIds: z.array(IdentifierSchema).min(1),
  originalV2EightDay: z.boolean(),
  editable: z.literal(true),
  sourceRefIds: z.array(IdentifierSchema),
});

export const ReservationRuleSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  placeIds: z.array(IdentifierSchema).min(1),
  name: z.string().trim().min(1).max(240),
  required: z.boolean(),
  ruleSummary: z.string().trim().min(1).max(2000),
  validFrom: IsoDateSchema.nullable(),
  expiresAt: IsoDateTimeSchema.nullable(),
  sourceRefIds: z.array(IdentifierSchema).min(1),
  reviewStatus: ReviewStatusSchema,
});

export const ContentBatchStatusSchema = z.enum([
  'draft',
  'researching',
  'imported',
  'validating',
  'review-required',
  'approved',
  'published',
  'rejected',
  'rolled-back',
]);

export const ContentBatchSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  scope: z.literal('qingdao'),
  researchScope: z.array(z.string().trim().min(1).max(500)).min(1),
  sourceRefIds: z.array(IdentifierSchema),
  addedEntityIds: z.array(IdentifierSchema),
  modifiedEntityIds: z.array(IdentifierSchema),
  deletedEntityIds: z.array(IdentifierSchema),
  dynamicFieldPaths: z.array(z.string().trim().min(1).max(240)),
  reviewer: z.string().trim().max(160),
  reviewedAt: IsoDateTimeSchema.nullable(),
  validationSummary: z.string().max(3000),
  conflicts: z.array(z.string().trim().min(1).max(1000)),
  status: ContentBatchStatusSchema,
  releaseVersion: z.string().trim().max(80),
  rollbackVersion: z.string().trim().max(80),
});

export type ContentBatch = z.infer<typeof ContentBatchSchema>;
export type ItineraryModule = z.infer<typeof ItineraryModuleSchema>;
export type PresetPlan = z.infer<typeof PresetPlanSchema>;
export type ReservationRule = z.infer<typeof ReservationRuleSchema>;
