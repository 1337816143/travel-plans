import { IsoDateTimeSchema, VersionedMetadataSchema } from '@qingdao/schema';
import { z } from 'zod';

export const PlannerAssumptionsSchema = VersionedMetadataSchema.extend({
  defaultVisitMinutes: z.number().int().min(15).max(480),
  fallbackWalkingMetersPerMinute: z.number().positive().max(200),
  routeFallbackProvider: z.literal('straight-line-fallback'),
  routeFallbackConfidence: z.number().min(0).max(0.5),
});

export const PlannerRunContextSchema = z.object({
  now: IsoDateTimeSchema,
  plannerVersion: z.string().trim().min(1).max(80),
  dataVersion: z.string().trim().min(1).max(80),
  assumptions: PlannerAssumptionsSchema,
});

export const DEFAULT_PLANNER_ASSUMPTIONS = PlannerAssumptionsSchema.parse({
  schemaVersion: 1,
  createdAt: '2026-08-01T00:00:00+08:00',
  updatedAt: '2026-08-01T00:00:00+08:00',
  defaultVisitMinutes: 75,
  fallbackWalkingMetersPerMinute: 75,
  routeFallbackProvider: 'straight-line-fallback',
  routeFallbackConfidence: 0.25,
});

export type PlannerAssumptions = z.infer<typeof PlannerAssumptionsSchema>;
export type PlannerRunContext = z.infer<typeof PlannerRunContextSchema>;
