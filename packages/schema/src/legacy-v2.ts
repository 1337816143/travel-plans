import { z } from 'zod';

import { IsoDateTimeSchema, VersionedMetadataSchema } from './common.js';
import {
  PlaceImportBundleSchema,
  PlaceImportCountsSchema,
  PlaceSchema,
  QingdaoDistrictSchema,
  type PlaceCategory,
  type SourceTier,
} from './content.js';

export const LegacyV2PointSchema = z.looseObject({
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
  sourceUrl: z.string().url().optional(),
});

export const LegacyV2PointMigrationContextSchema = z.object({
  now: IsoDateTimeSchema,
  district: QingdaoDistrictSchema.default('unknown'),
  address: z.string().trim().min(1).max(500).nullable().default(null),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  recommendedDurationMinutes: z.number().int().positive().max(1440).nullable().default(null),
  origin: z.enum(['primary', 'wishlist-map']).default('primary'),
});

export const LegacyV2RuntimePointBundleSchema = VersionedMetadataSchema.extend({
  id: z.literal('legacy-v2.5.4-runtime-points'),
  sourceVersion: z.literal('2.5.4'),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  coordinateSystem: z.literal('WGS84'),
  importMode: z.literal('read-only-review-required'),
  sourceFiles: z.array(z.string().trim().min(1).max(500)).min(1),
  counts: PlaceImportCountsSchema,
  primaryPoints: z.array(LegacyV2PointSchema),
  wishlistMapPoints: z.array(LegacyV2PointSchema),
}).superRefine((bundle, context) => {
  if (bundle.primaryPoints.length !== bundle.counts.primaryPoints) {
    context.addIssue({
      code: 'custom',
      message: 'primaryPoints 数量与 counts.primaryPoints 不一致',
      path: ['primaryPoints'],
    });
  }
  if (bundle.wishlistMapPoints.length !== bundle.counts.wishlistMapPoints) {
    context.addIssue({
      code: 'custom',
      message: 'wishlistMapPoints 数量与 counts.wishlistMapPoints 不一致',
      path: ['wishlistMapPoints'],
    });
  }

  const points = [...bundle.primaryPoints, ...bundle.wishlistMapPoints];
  if (points.length !== bundle.counts.runtimePoints) {
    context.addIssue({
      code: 'custom',
      message: '合并后的点位数量与 counts.runtimePoints 不一致',
      path: ['counts', 'runtimePoints'],
    });
  }

  const seen = new Map<string, string>();
  points.forEach((point, index) => {
    const group = index < bundle.primaryPoints.length ? 'primaryPoints' : 'wishlistMapPoints';
    const groupIndex =
      group === 'primaryPoints' ? index : index - bundle.primaryPoints.length;
    const previous = seen.get(point.id);
    if (previous) {
      context.addIssue({
        code: 'custom',
        message: `点位 ID 已在 ${previous} 出现`,
        path: [group, groupIndex, 'id'],
      });
    } else {
      seen.set(point.id, `${group}[${groupIndex}]`);
    }
  });
});

const categoryMap: Record<string, PlaceCategory> = {
  景点: 'attraction',
  备选: 'attraction',
  酒店: 'hotel',
  住宿区域: 'accommodation-area',
  交通节点: 'transport-hub',
  行程节点: 'service',
  服务: 'service',
  推荐: 'attraction',
  必吃: 'food',
  必买: 'shopping',
};

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function sourceTierForUrl(url: string): SourceTier {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostMatches(hostname, 'qingdao.gov.cn')) return 'government';
  if (
    ['qd-metro.com', 'qdhdworld.com', 'hjbwg.com', 'tsingtaomuseum.com'].some((domain) =>
      hostMatches(hostname, domain),
    )
  ) {
    return 'official-operator';
  }
  if (
    ['amap.com', 'map.baidu.com', 'mapcarta.com', 'openstreetmap.org'].some((domain) =>
      hostMatches(hostname, domain),
    )
  ) {
    return 'map-platform';
  }
  if (['ctrip.com', 'dianping.com'].some((domain) => hostMatches(hostname, domain))) {
    return 'commercial-platform';
  }
  if (hostMatches(hostname, 'douyin.com')) return 'social-media';
  return 'inference';
}

export function migrateLegacyV2Point(
  input: unknown,
  rawContext: z.input<typeof LegacyV2PointMigrationContextSchema>,
): z.infer<typeof PlaceSchema> {
  const point = LegacyV2PointSchema.parse(input);
  const context = LegacyV2PointMigrationContextSchema.parse(rawContext);
  const sourceRefId = `legacy-v2-${point.id}-source`;
  const sourceUrl = point.sourceUrl ?? point.mapUrl;
  const sourceTier = sourceTierForUrl(sourceUrl);
  const usedMapUrlFallback = point.sourceUrl === undefined;

  return PlaceSchema.parse({
    schemaVersion: 1,
    createdAt: context.now,
    updatedAt: context.now,
    id: point.id,
    name: point.name,
    aliases: context.aliases,
    reviewStatus: 'review-required',
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
    stableTransport: '',
    typicalVisit: '',
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
        tier: sourceTier,
        url: sourceUrl,
        observedAt: null,
        validFrom: null,
        expiresAt: null,
        freshness: 'unknown',
        confidence: usedMapUrlFallback ? 0.4 : 0.6,
        reviewStatus: 'review-required',
        promotionalRisk:
          sourceTier === 'government' || sourceTier === 'official-operator' ? 'low' : 'unknown',
        independentEvidenceCount: 0,
        reviewNotes: usedMapUrlFallback
          ? '从 v2.5.4 canonical data 导入；缺少独立 sourceUrl，暂以 mapUrl 作为可追溯链接，尚未重新联网核验。'
          : '从 v2.5.4 canonical data 导入；尚未作为 v3 内容重新联网核验。',
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
      sourceUrl: point.sourceUrl ?? null,
      origin: context.origin,
    },
  });
}

export function migrateLegacyV2RuntimePointBundle(
  input: unknown,
  options: { readonly now: z.input<typeof IsoDateTimeSchema> },
): z.infer<typeof PlaceImportBundleSchema> {
  const bundle = LegacyV2RuntimePointBundleSchema.parse(input);
  const now = IsoDateTimeSchema.parse(options.now);
  const migrateGroup = (
    points: readonly z.infer<typeof LegacyV2PointSchema>[],
    origin: 'primary' | 'wishlist-map',
  ): z.infer<typeof PlaceSchema>[] =>
    points.map((point) =>
      migrateLegacyV2Point(point, {
        now,
        origin,
      }),
    );

  const places = [
    ...migrateGroup(bundle.primaryPoints, 'primary'),
    ...migrateGroup(bundle.wishlistMapPoints, 'wishlist-map'),
  ];

  return PlaceImportBundleSchema.parse({
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    id: 'qingdao-v3-legacy-v2.5.4-place-import',
    sourceVersion: bundle.sourceVersion,
    sourceCommit: bundle.sourceCommit,
    importMode: bundle.importMode,
    reviewStatus: 'review-required',
    sourceFiles: bundle.sourceFiles,
    counts: bundle.counts,
    places,
  });
}

export type LegacyV2Point = z.infer<typeof LegacyV2PointSchema>;
export type LegacyV2RuntimePointBundle = z.infer<typeof LegacyV2RuntimePointBundleSchema>;
