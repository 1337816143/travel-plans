import { z } from 'zod';

import {
  HttpUrlSchema,
  IdentifierSchema,
  ReviewStatusSchema,
  QingdaoCoordinateSchema,
  VersionedMetadataSchema,
} from './common.js';
import { QingdaoDistrictSchema } from './content.js';

const MonthDaySchema = z.string().regex(/^\d{2}-\d{2}$/, '必须是 MM-DD');

export const LegacyV2SourceRecordSchema = z.object({
  name: z.string().trim().min(1).max(500),
  url: HttpUrlSchema,
  note: z.string().trim().min(1).max(3000),
});

export const LegacyV2ReservationChannelSchema = z
  .object({
    label: z.string().trim().min(1).max(160),
    kind: z.enum(['url', 'wechat', 'meituan', 'douyin', 'xhs']),
    keyword: z.string().trim().min(1).max(240).optional(),
    url: HttpUrlSchema.optional(),
  })
  .superRefine((channel, context) => {
    if (channel.kind === 'url' && channel.url === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'URL 渠道必须保留原始链接',
        path: ['url'],
      });
    }
    if (channel.kind !== 'url' && channel.keyword === undefined) {
      context.addIssue({
        code: 'custom',
        message: '平台渠道必须保留原始检索词',
        path: ['keyword'],
      });
    }
  });

export const LegacyV2ReservationRecordSchema = z.object({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  dates: z.array(MonthDaySchema).min(1),
  pointIds: z.array(IdentifierSchema).min(1),
  level: z.enum(['required', 'suggested']),
  optional: z.boolean(),
  note: z.string().trim().min(1).max(3000),
  channels: z.array(LegacyV2ReservationChannelSchema).min(1),
});

export const LegacyV2HotelRecordSchema = z.tuple([
  z.string().trim().min(1).max(240),
  z.string().trim().min(1).max(500),
  z.string().trim().min(1).max(1000),
  z.string().trim().min(1).max(500),
  z.string().trim().min(1).max(1000),
]);

export const LegacyV2WishlistAttractionRecordSchema = z.object({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  pointId: IdentifierSchema,
  coverage: z.enum(['scheduled', 'conditional']),
  date: MonthDaySchema,
  aliases: z.array(z.string().trim().min(1).max(240)),
  note: z.string().trim().min(1).max(2000).optional(),
});

export const LegacyV2WishlistMapPointRecordSchema = z.object({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  mapLabel: z.string().trim().min(1).max(240),
  category: z.enum(['必吃', '必买']),
  lat: z.number().min(35.4).max(37.2),
  lng: z.number().min(119.2).max(122.2),
  days: z.array(MonthDaySchema).min(1),
  time: z.string().trim().min(1).max(1000),
  status: z.string().trim().min(1).max(500),
  precision: z.enum(['exact', 'address', 'anchor']),
  wishlistIds: z.array(IdentifierSchema).min(1),
  detail: z.string().trim().min(1).max(5000),
  transport: z.string().trim().min(1).max(3000),
  tips: z.string().trim().min(1).max(3000),
  coord: z.string().trim().min(1).max(1000),
  source: z.string().trim().min(1).max(1000),
  sourceUrl: HttpUrlSchema.optional(),
  mapUrl: HttpUrlSchema,
});

export const LegacyV2WishlistItemRecordSchema = z.object({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  original: z.string().trim().min(1).max(240).optional(),
  aliases: z.array(z.string().trim().min(1).max(240)).optional(),
  target: z.string().trim().min(1).max(500),
  priority: z.enum(['must', 'wanted']),
  kind: z.enum(['restaurant', 'snack', 'purchase', 'drink', 'seafood']),
  suggestedDate: MonthDaySchema,
  suggestedMoment: z.string().trim().min(1).max(1000),
  status: z.string().trim().min(1).max(500),
  mapPointId: IdentifierSchema,
  address: z.string().trim().min(1).max(500).optional(),
  mapUrl: HttpUrlSchema,
  sourceUrl: HttpUrlSchema.optional(),
  note: z.string().trim().min(1).max(3000),
});

const LegacyV2ContentCountsSchema = z.object({
  sources: z.number().int().nonnegative(),
  reservations: z.number().int().nonnegative(),
  hotels: z.number().int().nonnegative(),
  wishlistAttractions: z.number().int().nonnegative(),
  wishlistMapPoints: z.number().int().nonnegative(),
  wishlistItems: z.number().int().nonnegative(),
});

export const LegacyV2ContentSnapshotSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  sourceVersion: z.literal('2.5.4'),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  importMode: z.literal('read-only-review-required'),
  reviewStatus: z.literal('review-required'),
  sourceFiles: z.array(z.string().trim().min(1).max(500)).length(4),
  counts: LegacyV2ContentCountsSchema,
  sources: z.array(LegacyV2SourceRecordSchema),
  reservations: z.array(LegacyV2ReservationRecordSchema),
  hotels: z.array(LegacyV2HotelRecordSchema),
  wishlist: z.object({
    version: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(240),
    note: z.string().trim().min(1).max(5000),
    attractions: z.array(LegacyV2WishlistAttractionRecordSchema),
    mapPoints: z.array(LegacyV2WishlistMapPointRecordSchema),
    items: z.array(LegacyV2WishlistItemRecordSchema),
    seafoodRule: z.object({
      title: z.string().trim().min(1).max(240),
      text: z.string().trim().min(1).max(3000),
    }),
  }),
}).superRefine((snapshot, context) => {
  const actual = {
    sources: snapshot.sources.length,
    reservations: snapshot.reservations.length,
    hotels: snapshot.hotels.length,
    wishlistAttractions: snapshot.wishlist.attractions.length,
    wishlistMapPoints: snapshot.wishlist.mapPoints.length,
    wishlistItems: snapshot.wishlist.items.length,
  };
  (Object.keys(actual) as Array<keyof typeof actual>).forEach((key) => {
    if (snapshot.counts[key] !== actual[key]) {
      context.addIssue({
        code: 'custom',
        message: `${key} 计数应为 ${actual[key]}`,
        path: ['counts', key],
      });
    }
  });

  const itemIds = new Set(snapshot.wishlist.items.map((entry) => entry.id));
  const mapPointIds = new Set(snapshot.wishlist.mapPoints.map((entry) => entry.id));
  snapshot.wishlist.mapPoints.forEach((point, index) => {
    point.wishlistIds.forEach((id, idIndex) => {
      if (!itemIds.has(id)) {
        context.addIssue({
          code: 'custom',
          message: `愿望地图点引用了不存在的愿望项：${id}`,
          path: ['wishlist', 'mapPoints', index, 'wishlistIds', idIndex],
        });
      }
    });
  });
  snapshot.wishlist.items.forEach((item, index) => {
    if (!mapPointIds.has(item.mapPointId)) {
      context.addIssue({
        code: 'custom',
        message: `愿望项引用了不存在的地图点：${item.mapPointId}`,
        path: ['wishlist', 'items', index, 'mapPointId'],
      });
    }
  });
});

export const HotelCandidateSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  placeId: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  address: z.string().trim().min(1).max(500),
  positioning: z.string().trim().min(1).max(2000),
  ratingSnapshotText: z.string().trim().min(1).max(1000),
  inventoryWarning: z.string().trim().min(1).max(2000),
  sourceRefIds: z.array(IdentifierSchema).min(1),
  reviewStatus: ReviewStatusSchema,
  runtimeVerificationRequired: z.literal(true),
  legacyV2: LegacyV2HotelRecordSchema,
});

export const WishlistEntrySchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  entryType: z.enum(['attraction', 'food-and-purchase']),
  name: z.string().trim().min(1).max(240),
  placeId: IdentifierSchema,
  priority: z.enum(['must', 'wanted', 'conditional']),
  suggestedMonthDay: MonthDaySchema,
  scheduleHint: z.string().trim().min(1).max(1000),
  sourceRefIds: z.array(IdentifierSchema).min(1),
  reviewStatus: ReviewStatusSchema,
  runtimeVerificationRequired: z.boolean(),
  legacyV2: z.union([LegacyV2WishlistAttractionRecordSchema, LegacyV2WishlistItemRecordSchema]),
});

export const ServicePointCategorySchema = z.enum([
  'hospital',
  'pharmacy',
  'toilet',
  'parking',
  'charging-station',
]);

export const ServicePointCandidateSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  category: ServicePointCategorySchema,
  candidateMode: z.enum(['verified-location', 'runtime-search']),
  districts: z.array(QingdaoDistrictSchema).min(1),
  address: z.string().trim().min(1).max(500).nullable(),
  location: QingdaoCoordinateSchema.nullable(),
  providerQuery: z.string().trim().min(1).max(500),
  coverageNotes: z.string().trim().min(1).max(3000),
  sourceRefIds: z.array(IdentifierSchema).min(1),
  reviewStatus: ReviewStatusSchema,
  runtimeVerificationRequired: z.literal(true),
}).superRefine((candidate, context) => {
  if (candidate.candidateMode === 'verified-location') {
    if (candidate.location === null || candidate.address === null) {
      context.addIssue({
        code: 'custom',
        message: '固定候选必须记录地址与坐标',
        path: ['location'],
      });
    }
    if (candidate.location?.coordinateSystem !== 'WGS84') {
      context.addIssue({
        code: 'custom',
        message: '固定服务点内部坐标必须是 WGS84',
        path: ['location', 'coordinateSystem'],
      });
    }
  }
  if (candidate.candidateMode === 'runtime-search' && candidate.location !== null) {
    context.addIssue({
      code: 'custom',
      message: '运行时查询候选不能伪装成固定坐标',
      path: ['location'],
    });
  }
});

export const LegacyV2ContentImportSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  snapshotId: IdentifierSchema,
  sourceVersion: z.literal('2.5.4'),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  importMode: z.literal('read-only-review-required'),
  reviewStatus: z.literal('review-required'),
  sourceFiles: z.array(z.string().trim().min(1).max(500)).length(4),
  counts: LegacyV2ContentCountsSchema,
  sourceRefIds: z.array(IdentifierSchema),
  reservationRuleIds: z.array(IdentifierSchema),
  hotelCandidateIds: z.array(IdentifierSchema),
  wishlistAttractionIds: z.array(IdentifierSchema),
  wishlistMapPointIds: z.array(IdentifierSchema),
  wishlistItemIds: z.array(IdentifierSchema),
  wishlistTitle: z.string().trim().min(1).max(240),
  wishlistNote: z.string().trim().min(1).max(5000),
  seafoodRule: z.object({
    title: z.string().trim().min(1).max(240),
    text: z.string().trim().min(1).max(3000),
  }),
}).superRefine((summary, context) => {
  const lengths = {
    sources: summary.sourceRefIds.length,
    reservations: summary.reservationRuleIds.length,
    hotels: summary.hotelCandidateIds.length,
    wishlistAttractions: summary.wishlistAttractionIds.length,
    wishlistMapPoints: summary.wishlistMapPointIds.length,
    wishlistItems: summary.wishlistItemIds.length,
  };
  (Object.keys(lengths) as Array<keyof typeof lengths>).forEach((key) => {
    if (summary.counts[key] !== lengths[key]) {
      context.addIssue({
        code: 'custom',
        message: `${key} 映射数量应为 ${summary.counts[key]}`,
        path: [key],
      });
    }
  });

  const mappingFields = [
    'sourceRefIds',
    'reservationRuleIds',
    'hotelCandidateIds',
    'wishlistAttractionIds',
    'wishlistMapPointIds',
    'wishlistItemIds',
  ] as const;
  mappingFields.forEach((field) => {
    const values = summary[field];
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: 'custom',
        message: `${field} 不能包含重复映射`,
        path: [field],
      });
    }
  });
});

export type HotelCandidate = z.infer<typeof HotelCandidateSchema>;
export type LegacyV2ContentImport = z.infer<typeof LegacyV2ContentImportSchema>;
export type LegacyV2ContentSnapshot = z.infer<typeof LegacyV2ContentSnapshotSchema>;
export type LegacyV2ReservationRecord = z.infer<typeof LegacyV2ReservationRecordSchema>;
export type ServicePointCandidate = z.infer<typeof ServicePointCandidateSchema>;
export type WishlistEntry = z.infer<typeof WishlistEntrySchema>;
