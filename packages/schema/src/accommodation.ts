import { z } from 'zod';

import {
  ConfidenceSchema,
  IdentifierSchema,
  QingdaoCoordinateSchema,
  VersionedMetadataSchema,
} from './common.js';

export const AccommodationAreaCandidateSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(160),
  districtLabel: z.string().trim().min(1).max(160),
  center: QingdaoCoordinateSchema,
  description: z.string().trim().min(1).max(1000),
  strengths: z.array(z.string().trim().min(1).max(300)),
  tradeoffs: z.array(z.string().trim().min(1).max(300)),
  sourceRefIds: z.array(IdentifierSchema),
});

export const AccommodationAreaScoreSchema = z.object({
  areaId: IdentifierSchema,
  weightedStraightLineMeters: z.number().nonnegative(),
  arrivalDeparturePenalty: z.number().nonnegative(),
  splitStayPenalty: z.number().nonnegative(),
  score: z.number().nonnegative(),
  rank: z.number().int().positive(),
  confidence: ConfidenceSchema,
  explanation: z.string().trim().min(1).max(2000),
});

export const AccommodationAnalysisSchema = VersionedMetadataSchema.extend({
  planId: IdentifierSchema,
  method: z.literal('weighted-straight-line-area-comparison'),
  estimated: z.literal(true),
  candidates: z.array(AccommodationAreaCandidateSchema).min(1),
  scores: z.array(AccommodationAreaScoreSchema).min(1),
  leadingCandidateAreaId: IdentifierSchema,
  singleStayPreliminary: z.boolean(),
  warnings: z.array(z.string().trim().min(1).max(1000)),
});

export type AccommodationAnalysis = z.infer<typeof AccommodationAnalysisSchema>;
export type AccommodationAreaCandidate = z.infer<typeof AccommodationAreaCandidateSchema>;
export type AccommodationAreaScore = z.infer<typeof AccommodationAreaScoreSchema>;
