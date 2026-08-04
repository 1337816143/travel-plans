import { z } from 'zod';

import {
  IdentifierSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  ReviewStatusSchema,
  TimeOfDaySchema,
  VersionedMetadataSchema,
} from './common.js';
import { PlaceFacetSchema, QingdaoDistrictSchema } from './content.js';
import { LegacyV2ReservationRecordSchema } from './legacy-content.js';
import { RouteModeSchema } from './styles.js';
import { PlacePrioritySchema } from './trip-request.js';

export const ItineraryModuleSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  reviewStatus: ReviewStatusSchema.default('review-required'),
  recommendedDurationMinutes: z.number().int().positive().max(2880),
  minimumDurationMinutes: z.number().int().positive().max(2880),
  districts: z.array(QingdaoDistrictSchema).min(1),
  placeIds: z.array(IdentifierSchema).min(1),
  suitableFor: z.array(z.string().trim().min(1).max(120)),
  facets: z.array(PlaceFacetSchema).default([]),
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
  reviewStatus: ReviewStatusSchema.default('review-required'),
  totalDays: z.number().int().min(1).max(30),
  moduleIds: z.array(IdentifierSchema).min(1),
  dayAssignments: z.array(
    z.object({
      dayNumber: z.number().int().min(1).max(30),
      moduleIds: z.array(IdentifierSchema).min(1),
      notes: z.string().max(1000),
    }),
  ),
  selectionPriorities: z.record(IdentifierSchema, PlacePrioritySchema),
  tags: z.array(z.string().trim().min(1).max(120)),
  originalV2EightDay: z.boolean(),
  editable: z.literal(true),
  sourceRefIds: z.array(IdentifierSchema),
}).superRefine((preset, context) => {
  if (preset.dayAssignments.length !== preset.totalDays) {
    context.addIssue({
      code: 'custom',
      message: 'dayAssignments 数量必须等于 totalDays',
      path: ['dayAssignments'],
    });
  }
  const dayNumbers = preset.dayAssignments.map((assignment) => assignment.dayNumber);
  if (
    new Set(dayNumbers).size !== dayNumbers.length ||
    dayNumbers.some((dayNumber, index) => dayNumber !== index + 1)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'dayAssignments 必须从第 1 天连续排列',
      path: ['dayAssignments'],
    });
  }
  const assignedModuleIds = new Set(
    preset.dayAssignments.flatMap((assignment) => assignment.moduleIds),
  );
  const declaredModuleIds = new Set(preset.moduleIds);
  if (
    assignedModuleIds.size !== declaredModuleIds.size ||
    [...assignedModuleIds].some((moduleId) => !declaredModuleIds.has(moduleId))
  ) {
    context.addIssue({
      code: 'custom',
      message: 'moduleIds 必须与 dayAssignments 引用的模块完全一致',
      path: ['moduleIds'],
    });
  }
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
  legacyV2: LegacyV2ReservationRecordSchema.nullable().default(null),
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
  automatedChecks: z.array(z.string().trim().min(1).max(240)).default([]),
  conflicts: z.array(z.string().trim().min(1).max(1000)),
  status: ContentBatchStatusSchema,
  releaseVersion: z.string().trim().max(80),
  rollbackVersion: z.string().trim().max(80),
}).superRefine((batch, context) => {
  if (['approved', 'published'].includes(batch.status)) {
    if (!batch.reviewer) {
      context.addIssue({
        code: 'custom',
        message: '审批或发布批次必须记录审核人',
        path: ['reviewer'],
      });
    }
    if (batch.reviewedAt === null) {
      context.addIssue({
        code: 'custom',
        message: '审批或发布批次必须记录审核时间',
        path: ['reviewedAt'],
      });
    }
    if (batch.conflicts.length > 0) {
      context.addIssue({
        code: 'custom',
        message: '仍有冲突的批次不得审批或发布',
        path: ['conflicts'],
      });
    }
  }
  if (batch.status === 'published' && !batch.releaseVersion) {
    context.addIssue({
      code: 'custom',
      message: '发布批次必须记录 releaseVersion',
      path: ['releaseVersion'],
    });
  }
  if (batch.status === 'rolled-back' && !batch.rollbackVersion) {
    context.addIssue({
      code: 'custom',
      message: '回滚批次必须记录 rollbackVersion',
      path: ['rollbackVersion'],
    });
  }
});

export const ContentUpdateJobSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  scope: z.literal('qingdao'),
  target: z.enum(['stable-content', 'seasonal-content', 'dynamic-observation']),
  subjectIds: z.array(IdentifierSchema).min(1),
  fieldPaths: z.array(z.string().trim().min(1).max(240)).min(1),
  sourceRefIds: z.array(IdentifierSchema).min(1),
  intervalHours: z.number().int().positive().max(8760),
  lastCheckedAt: IsoDateTimeSchema.nullable(),
  nextCheckAt: IsoDateTimeSchema,
  enabled: z.boolean(),
  requiresManualReview: z.literal(true),
});

export const ContentUpdateRunSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  jobId: IdentifierSchema,
  startedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
  status: z.enum(['running', 'no-change', 'review-required', 'failed']),
  observedEntityIds: z.array(IdentifierSchema),
  proposedBatchId: IdentifierSchema.nullable(),
  summary: z.string().trim().min(1).max(3000),
  errorMessage: z.string().max(2000),
}).superRefine((run, context) => {
  if (run.status === 'running' && run.completedAt !== null) {
    context.addIssue({
      code: 'custom',
      message: 'running 任务不能记录 completedAt',
      path: ['completedAt'],
    });
  }
  if (run.status !== 'running' && run.completedAt === null) {
    context.addIssue({
      code: 'custom',
      message: '已结束任务必须记录 completedAt',
      path: ['completedAt'],
    });
  }
  if (run.status === 'failed' && !run.errorMessage.trim()) {
    context.addIssue({
      code: 'custom',
      message: 'failed 任务必须记录 errorMessage',
      path: ['errorMessage'],
    });
  }
  if (
    run.status === 'review-required' &&
    (run.observedEntityIds.length === 0 || run.proposedBatchId === null)
  ) {
    context.addIssue({
      code: 'custom',
      message: '发现变化时必须记录实体和待审批次',
      path: ['proposedBatchId'],
    });
  }
  if (
    run.status === 'no-change' &&
    (run.observedEntityIds.length > 0 || run.proposedBatchId !== null)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'no-change 任务不能携带变化实体或批次',
      path: ['observedEntityIds'],
    });
  }
});

export type ContentBatch = z.infer<typeof ContentBatchSchema>;
export type ContentBatchStatus = z.infer<typeof ContentBatchStatusSchema>;
export type ContentUpdateJob = z.infer<typeof ContentUpdateJobSchema>;
export type ContentUpdateRun = z.infer<typeof ContentUpdateRunSchema>;
export type ItineraryModule = z.infer<typeof ItineraryModuleSchema>;
export type PresetPlan = z.infer<typeof PresetPlanSchema>;
export type ReservationRule = z.infer<typeof ReservationRuleSchema>;
