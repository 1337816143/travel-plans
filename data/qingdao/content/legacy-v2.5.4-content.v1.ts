import {
  HotelCandidateSchema,
  LegacyV2ContentImportSchema,
  LegacyV2ContentSnapshotSchema,
  ReservationRuleSchema,
  SourceRefSchema,
  WishlistEntrySchema,
  type HotelCandidate,
  type LegacyV2ContentImport,
  type ReservationRule,
  type SourceRef,
  type SourceTier,
  type WishlistEntry,
} from '@qingdao/schema';

import legacyContentSnapshot from './imports/legacy-v2.5.4-content.v1.json' with { type: 'json' };

export const QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT =
  LegacyV2ContentSnapshotSchema.parse(legacyContentSnapshot);

const IMPORTED_AT = QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.updatedAt;
const BASELINE_SOURCE_ID = 'legacy-v2.5.4-import-review-required';

interface SourceProfile {
  readonly tier: SourceTier;
  readonly confidence: number;
  readonly promotionalRisk: 'low' | 'medium' | 'high' | 'unknown';
}

const SOURCE_PROFILES: readonly SourceProfile[] = [
  { tier: 'government', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'official-operator', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'official-operator', confidence: 0.85, promotionalRisk: 'low' },
  { tier: 'official-operator', confidence: 0.85, promotionalRisk: 'low' },
  { tier: 'government', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'government', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'official-operator', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'official-operator', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'government', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'government', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'official-operator', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'government', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'commercial-platform', confidence: 0.6, promotionalRisk: 'medium' },
  { tier: 'map-platform', confidence: 0.7, promotionalRisk: 'unknown' },
  { tier: 'map-platform', confidence: 0.7, promotionalRisk: 'unknown' },
  { tier: 'commercial-platform', confidence: 0.45, promotionalRisk: 'medium' },
  { tier: 'official-operator', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'official-operator', confidence: 0.9, promotionalRisk: 'low' },
  { tier: 'news-media', confidence: 0.65, promotionalRisk: 'low' },
  { tier: 'social-media', confidence: 0.25, promotionalRisk: 'high' },
  { tier: 'social-media', confidence: 0.25, promotionalRisk: 'high' },
  { tier: 'commercial-platform', confidence: 0.4, promotionalRisk: 'medium' },
  { tier: 'map-platform', confidence: 0.6, promotionalRisk: 'medium' },
  { tier: 'social-media', confidence: 0.2, promotionalRisk: 'high' },
] as const;

function legacySourceId(index: number): string {
  return `source-legacy-v2-${String(index + 1).padStart(2, '0')}`;
}

export const QINGDAO_LEGACY_V2_SOURCE_REFS: readonly SourceRef[] =
  QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.sources.map((entry, index) => {
    const profile = SOURCE_PROFILES[index];
    if (!profile) throw new Error(`Legacy source profile is missing for index ${index + 1}`);
    return SourceRefSchema.parse({
      schemaVersion: 1,
      createdAt: IMPORTED_AT,
      updatedAt: IMPORTED_AT,
      id: legacySourceId(index),
      label: entry.name,
      tier: profile.tier,
      url: entry.url,
      observedAt: IMPORTED_AT,
      validFrom: null,
      expiresAt: null,
      freshness: 'unknown',
      confidence: profile.confidence,
      reviewStatus: 'review-required',
      promotionalRisk: profile.promotionalRisk,
      independentEvidenceCount:
        profile.tier === 'government' || profile.tier === 'official-operator' ? 1 : 0,
      reviewNotes: `Legacy v2.5.4 原文：${entry.note}`,
      conflictFlags: ['legacy-dynamic-claims-require-current-verification'],
    });
  });

const RESERVATION_SOURCE_IDS: Readonly<Record<string, readonly string[]>> = {
  'rent-order': [BASELINE_SOURCE_ID],
  'laoshan-ticket': [legacySourceId(6), legacySourceId(16)],
  'dayroom-booking': [legacySourceId(15)],
  'beer-ticket': [legacySourceId(7), legacySourceId(17)],
  'naval-reservation': [legacySourceId(1), legacySourceId(18)],
  'underwater-ticket': [legacySourceId(2), legacySourceId(3)],
  'ferry-check': [legacySourceId(8)],
  'aofan-cruise': [legacySourceId(8), legacySourceId(9)],
};

export const QINGDAO_LEGACY_V2_RESERVATIONS: readonly ReservationRule[] =
  QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.reservations.map((entry) => {
    const sourceRefIds = RESERVATION_SOURCE_IDS[entry.id];
    if (!sourceRefIds) throw new Error(`Legacy reservation source mapping is missing: ${entry.id}`);
    return ReservationRuleSchema.parse({
      schemaVersion: 1,
      createdAt: IMPORTED_AT,
      updatedAt: IMPORTED_AT,
      id: `reservation-legacy-${entry.id}`,
      placeIds: entry.pointIds,
      name: entry.name,
      required: entry.level === 'required' && !entry.optional,
      ruleSummary: entry.note,
      validFrom: null,
      expiresAt: null,
      sourceRefIds,
      reviewStatus: 'review-required',
      legacyV2: entry,
    });
  });

const HOTEL_PLACE_IDS = ['holiday-inn', 'westin', 'haitian'] as const;

export const QINGDAO_LEGACY_V2_HOTEL_CANDIDATES: readonly HotelCandidate[] =
  QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.hotels.map((entry, index) => {
    const placeId = HOTEL_PLACE_IDS[index];
    if (!placeId) throw new Error(`Legacy hotel place mapping is missing for index ${index + 1}`);
    return HotelCandidateSchema.parse({
      schemaVersion: 1,
      createdAt: IMPORTED_AT,
      updatedAt: IMPORTED_AT,
      id: `hotel-candidate-${placeId}`,
      placeId,
      name: entry[0],
      address: entry[1],
      positioning: entry[2],
      ratingSnapshotText: entry[3],
      inventoryWarning: entry[4],
      sourceRefIds: [legacySourceId(15)],
      reviewStatus: 'review-required',
      runtimeVerificationRequired: true,
      legacyV2: entry,
    });
  });

const attractionEntries = QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.wishlist.attractions.map(
  (entry): WishlistEntry =>
    WishlistEntrySchema.parse({
      schemaVersion: 1,
      createdAt: IMPORTED_AT,
      updatedAt: IMPORTED_AT,
      id: entry.id,
      entryType: 'attraction',
      name: entry.name,
      placeId: entry.pointId,
      priority: entry.coverage === 'conditional' ? 'conditional' : 'must',
      suggestedMonthDay: entry.date,
      scheduleHint: entry.note ?? `${entry.coverage} · 原版 ${entry.date}`,
      sourceRefIds: [BASELINE_SOURCE_ID],
      reviewStatus: 'review-required',
      runtimeVerificationRequired: entry.coverage === 'conditional',
      legacyV2: entry,
    }),
);

const foodAndPurchaseEntries = QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.wishlist.items.map(
  (entry): WishlistEntry =>
    WishlistEntrySchema.parse({
      schemaVersion: 1,
      createdAt: IMPORTED_AT,
      updatedAt: IMPORTED_AT,
      id: entry.id,
      entryType: 'food-and-purchase',
      name: entry.name,
      placeId: entry.mapPointId,
      priority: entry.priority,
      suggestedMonthDay: entry.suggestedDate,
      scheduleHint: entry.suggestedMoment,
      sourceRefIds: [BASELINE_SOURCE_ID],
      reviewStatus: 'review-required',
      runtimeVerificationRequired: true,
      legacyV2: entry,
    }),
);

export const QINGDAO_LEGACY_V2_WISHLIST_ENTRIES: readonly WishlistEntry[] = [
  ...attractionEntries,
  ...foodAndPurchaseEntries,
];

export const QINGDAO_LEGACY_V2_CONTENT_IMPORT: LegacyV2ContentImport =
  LegacyV2ContentImportSchema.parse({
    schemaVersion: 1,
    createdAt: IMPORTED_AT,
    updatedAt: IMPORTED_AT,
    id: 'legacy-v2.5.4-content-import',
    snapshotId: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.id,
    sourceVersion: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.sourceVersion,
    sourceCommit: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.sourceCommit,
    importMode: 'read-only-review-required',
    reviewStatus: 'review-required',
    sourceFiles: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.sourceFiles,
    counts: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.counts,
    sourceRefIds: QINGDAO_LEGACY_V2_SOURCE_REFS.map((entry) => entry.id),
    reservationRuleIds: QINGDAO_LEGACY_V2_RESERVATIONS.map((entry) => entry.id),
    hotelCandidateIds: QINGDAO_LEGACY_V2_HOTEL_CANDIDATES.map((entry) => entry.id),
    wishlistAttractionIds: attractionEntries.map((entry) => entry.id),
    wishlistMapPointIds: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.wishlist.mapPoints.map(
      (entry) => entry.id,
    ),
    wishlistItemIds: foodAndPurchaseEntries.map((entry) => entry.id),
    wishlistTitle: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.wishlist.title,
    wishlistNote: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.wishlist.note,
    seafoodRule: QINGDAO_LEGACY_V2_CONTENT_SNAPSHOT.wishlist.seafoodRule,
  });
