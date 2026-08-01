import { z } from 'zod';

import {
  ConfidenceSchema,
  IdentifierSchema,
  IsoDateTimeSchema,
  QingdaoCoordinateSchema,
  VersionedMetadataSchema,
} from './common.js';
import { PlaceCategorySchema } from './content.js';
import { ProviderFailureSchema, ProviderResultMetaSchema } from './provider.js';

export const PlaceSearchQuerySchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  keyword: z.string().trim().min(1).max(120),
  city: z.literal('青岛'),
  center: QingdaoCoordinateSchema.nullable(),
  limit: z.number().int().min(1).max(30),
});

export const PlaceSearchCandidateSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  providerPlaceId: z.string().trim().min(1).max(240),
  provider: z.enum(['amap-js', 'qingdao-curated-offline']),
  name: z.string().trim().min(1).max(240),
  address: z.string().trim().max(500),
  location: QingdaoCoordinateSchema,
  category: PlaceCategorySchema,
  observedAt: IsoDateTimeSchema,
  confidence: ConfidenceSchema,
  requiresReview: z.boolean(),
});

export const PlaceSearchResponseSchema = VersionedMetadataSchema.extend({
  queryId: IdentifierSchema,
  provider: z.enum(['amap-js', 'qingdao-curated-offline']),
  candidates: z.array(PlaceSearchCandidateSchema),
  degraded: z.boolean(),
  message: z.string().trim().min(1).max(1000),
});

const PlaceSearchProviderSuccessSchema = VersionedMetadataSchema.extend({
  ok: z.literal(true),
  meta: ProviderResultMetaSchema,
  data: PlaceSearchResponseSchema,
}).strict();

export const PlaceSearchProviderResultSchema = z.discriminatedUnion('ok', [
  PlaceSearchProviderSuccessSchema,
  ProviderFailureSchema,
]);

export type PlaceSearchCandidate = z.infer<typeof PlaceSearchCandidateSchema>;
export type PlaceSearchQuery = z.infer<typeof PlaceSearchQuerySchema>;
export type PlaceSearchResponse = z.infer<typeof PlaceSearchResponseSchema>;
export type PlaceSearchProviderResult = z.infer<typeof PlaceSearchProviderResultSchema>;
