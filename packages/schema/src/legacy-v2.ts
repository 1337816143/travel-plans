import { z } from 'zod';

import { IsoDateTimeSchema } from './common.js';
import { PlaceSchema, QingdaoDistrictSchema, type PlaceCategory } from './content.js';

export const LegacyV2PointSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  days: z.array(z.string()),
  time: z.string(),
  status: z.string(),
  detail: z.string().trim().min(1),
  transport: z.string(),
  tips: z.string(),
  coord: z.string(),
  source: z.string().trim().min(1),
  mapUrl: z.string().url(),
  sourceUrl: z.string().url(),
});

export const LegacyV2PointMigrationContextSchema = z.object({
  now: IsoDateTimeSchema,
  district: QingdaoDistrictSchema,
  address: z.string().trim().min(1).max(500),
  aliases: z.array(z.string().trim().min(1).max(160)),
  recommendedDurationMinutes: z.number().int().positive().max(1440),
});

const categoryMap: Record<string, PlaceCategory> = {
  景点: 'attraction',
  酒店: 'hotel',
  住宿区域: 'accommodation-area',
  交通节点: 'transport-hub',
  服务: 'service',
  推荐: 'attraction',
  必吃: 'food',
  必买: 'shopping',
};

export function migrateLegacyV2Point(
  input: unknown,
  rawContext: z.input<typeof LegacyV2PointMigrationContextSchema>,
): z.infer<typeof PlaceSchema> {
  const point = LegacyV2PointSchema.parse(input);
  const context = LegacyV2PointMigrationContextSchema.parse(rawContext);
  const sourceRefId = `legacy-v2-${point.id}-source`;

  return PlaceSchema.parse({
    schemaVersion: 1,
    createdAt: context.now,
    updatedAt: context.now,
    id: point.id,
    name: point.name,
    aliases: context.aliases,
    category: categoryMap[point.category] ?? 'custom',
    district: context.district,
    address: context.address,
    location: {
      lat: point.lat,
      lng: point.lng,
      coordinateSystem: 'WGS84',
    },
    summary: point.detail,
    detail: point.detail,
    stableTransport: point.transport,
    typicalVisit: point.time,
    recommendedDurationMinutes: context.recommendedDurationMinutes,
    suitableFor: [],
    tags: ['qingdao', 'legacy-v2-import'],
    sourceRefs: [
      {
        schemaVersion: 1,
        createdAt: context.now,
        updatedAt: context.now,
        id: sourceRefId,
        label: point.source,
        tier: 'government',
        url: point.sourceUrl,
        observedAt: null,
        validFrom: null,
        expiresAt: null,
        freshness: 'unknown',
        confidence: 0.7,
        reviewStatus: 'review-required',
        promotionalRisk: 'unknown',
        independentEvidenceCount: 0,
        reviewNotes: '从 v2.5.4 canonical data 导入；尚未作为 v3 内容重新联网核验。',
        conflictFlags: [],
      },
    ],
    dynamicObservations: [],
    legacyV2: {
      id: point.id,
      rawCategory: point.category,
      time: point.time,
      status: point.status,
      transport: point.transport,
      tips: point.tips,
      coordinateNote: point.coord,
      mapUrl: point.mapUrl,
    },
  });
}

export type LegacyV2Point = z.infer<typeof LegacyV2PointSchema>;
