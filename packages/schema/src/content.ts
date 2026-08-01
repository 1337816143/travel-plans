import { z } from 'zod';

import {
  ConfidenceSchema,
  FreshnessSchema,
  HttpUrlSchema,
  IdentifierSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  ReviewStatusSchema,
  QingdaoCoordinateSchema,
  VersionedMetadataSchema,
} from './common.js';

export const SourceTierSchema = z.enum([
  'government',
  'official-operator',
  'official-ticketing',
  'map-platform',
  'commercial-platform',
  'news-media',
  'travel-community',
  'social-media',
  'personal-experience',
  'inference',
]);

export const PromotionalRiskSchema = z.enum(['low', 'medium', 'high', 'unknown']);

export const SourceRefSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  label: z.string().trim().min(1).max(240),
  tier: SourceTierSchema,
  url: HttpUrlSchema,
  observedAt: IsoDateTimeSchema.nullable(),
  validFrom: IsoDateSchema.nullable(),
  expiresAt: IsoDateTimeSchema.nullable(),
  freshness: FreshnessSchema,
  confidence: ConfidenceSchema,
  reviewStatus: ReviewStatusSchema,
  promotionalRisk: PromotionalRiskSchema,
  independentEvidenceCount: z.number().int().nonnegative(),
  reviewNotes: z.string().max(2000),
  conflictFlags: z.array(z.string().trim().min(1).max(240)),
});

export const DynamicObservationSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  subjectId: IdentifierSchema,
  field: z.string().trim().min(1).max(120),
  value: z.unknown(),
  sourceRefId: IdentifierSchema,
  observedAt: IsoDateTimeSchema,
  validFrom: IsoDateTimeSchema.nullable(),
  expiresAt: IsoDateTimeSchema.nullable(),
  freshness: FreshnessSchema,
  confidence: ConfidenceSchema,
  reviewStatus: ReviewStatusSchema,
});

export const QingdaoDistrictSchema = z.enum([
  'shinan',
  'shibei',
  'licang',
  'laoshan',
  'chengyang',
  'jimo',
  'west-coast',
  'jiaozhou',
  'pingdu',
  'laixi',
  'qingdao-related-route',
  'unknown',
]);

export const PlaceCategorySchema = z.enum([
  'attraction',
  'historic-building',
  'mountain',
  'seaside',
  'island',
  'park',
  'museum',
  'art-gallery',
  'culture',
  'landmark',
  'photography',
  'indoor',
  'restaurant',
  'food',
  'shopping',
  'hotel',
  'accommodation-area',
  'transport-hub',
  'service',
  'custom',
]);

export const PlaceSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  aliases: z.array(z.string().trim().min(1).max(160)),
  reviewStatus: ReviewStatusSchema,
  category: PlaceCategorySchema,
  district: QingdaoDistrictSchema,
  address: z.string().trim().min(1).max(500).nullable(),
  location: QingdaoCoordinateSchema,
  summary: z.string().trim().min(1).max(1000),
  detail: z.string().trim().min(1).max(5000),
  stableTransport: z.string().max(2000),
  typicalVisit: z.string().max(2000),
  recommendedDurationMinutes: z.number().int().positive().max(1440).nullable(),
  suitableFor: z.array(z.string().trim().min(1).max(100)),
  tags: z.array(z.string().trim().min(1).max(100)),
  sourceRefs: z.array(SourceRefSchema).min(1),
  dynamicObservations: z.array(DynamicObservationSchema),
  legacyV2: z
    .object({
      id: IdentifierSchema,
      rawCategory: z.string().min(1),
      time: z.string(),
      status: z.string(),
      transport: z.string(),
      tips: z.string(),
      coordinateNote: z.string(),
      mapUrl: HttpUrlSchema,
      sourceUrl: HttpUrlSchema.nullable(),
      origin: z.enum(['primary', 'wishlist-map']),
    })
    .nullable(),
});

export const PlaceImportCountsSchema = z
  .object({
    primaryPoints: z.number().int().nonnegative(),
    wishlistMapPoints: z.number().int().nonnegative(),
    runtimePoints: z.number().int().nonnegative(),
  })
  .superRefine((counts, context) => {
    if (counts.runtimePoints !== counts.primaryPoints + counts.wishlistMapPoints) {
      context.addIssue({
        code: 'custom',
        message: 'runtimePoints 必须等于 primaryPoints 与 wishlistMapPoints 之和',
        path: ['runtimePoints'],
      });
    }
  });

export const PlaceImportBundleSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  sourceVersion: z.string().trim().min(1).max(80),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  importMode: z.literal('read-only-review-required'),
  reviewStatus: z.literal('review-required'),
  sourceFiles: z.array(z.string().trim().min(1).max(500)).min(1),
  counts: PlaceImportCountsSchema,
  places: z.array(PlaceSchema),
}).superRefine((bundle, context) => {
  if (bundle.places.length !== bundle.counts.runtimePoints) {
    context.addIssue({
      code: 'custom',
      message: 'places 数量必须与 counts.runtimePoints 一致',
      path: ['places'],
    });
  }

  const seen = new Map<string, number>();
  bundle.places.forEach((place, index) => {
    const previous = seen.get(place.id);
    if (previous !== undefined) {
      context.addIssue({
        code: 'custom',
        message: `点位 ID 与 places[${previous}] 重复`,
        path: ['places', index, 'id'],
      });
    } else {
      seen.set(place.id, index);
    }
  });
});

export type DynamicObservation = z.infer<typeof DynamicObservationSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;
export type PlaceImportBundle = z.infer<typeof PlaceImportBundleSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type SourceTier = z.infer<typeof SourceTierSchema>;
