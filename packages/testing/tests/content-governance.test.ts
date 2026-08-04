import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  QINGDAO_CONTENT_CATALOG,
  ContentBatchTransitionError,
  ContentReleaseError,
  allowedBatchTransitions,
  createContentRelease,
  dueContentUpdateJobs,
  freshnessAt,
  recordContentUpdateResult,
  rollbackContentRelease,
  transitionContentBatch,
} from '@qingdao/content';
import { ContentCatalogSchema, LegacyV2ContentSnapshotSchema } from '@qingdao/schema';
import { describe, expect, it } from 'vitest';

const NOW = '2026-08-02T08:00:00+08:00';
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const legacySnapshot = LegacyV2ContentSnapshotSchema.parse(
  JSON.parse(
    fs.readFileSync(
      `${repositoryRoot}data/qingdao/content/imports/legacy-v2.5.4-content.v1.json`,
      'utf8',
    ),
  ) as unknown,
);

function humanApprovedCatalog() {
  const catalog = QINGDAO_CONTENT_CATALOG;
  const approvedAt = '2026-08-03T09:30:00+08:00';
  return ContentCatalogSchema.parse({
    ...catalog,
    updatedAt: approvedAt,
    reviewStatus: 'approved',
    sources: catalog.sources.map((entry) => ({ ...entry, reviewStatus: 'approved' })),
    seasonalInformation: catalog.seasonalInformation.map((entry) => ({
      ...entry,
      reviewStatus: 'approved',
    })),
    itineraryModules: catalog.itineraryModules.map((entry) => ({
      ...entry,
      reviewStatus: 'approved',
    })),
    presetPlans: catalog.presetPlans.map((entry) => ({
      ...entry,
      reviewStatus: 'approved',
    })),
    reservationRules: catalog.reservationRules.map((entry) => ({
      ...entry,
      reviewStatus: 'approved',
    })),
    hotelCandidates: catalog.hotelCandidates.map((entry) => ({
      ...entry,
      reviewStatus: 'approved',
    })),
    wishlistEntries: catalog.wishlistEntries.map((entry) => ({
      ...entry,
      reviewStatus: 'approved',
    })),
    servicePointCandidates: catalog.servicePointCandidates.map((entry) => ({
      ...entry,
      reviewStatus: 'approved',
    })),
    batches: catalog.batches.map((entry) => ({
      ...entry,
      updatedAt: approvedAt,
      reviewer: '人工审核测试人',
      reviewedAt: approvedAt,
      conflicts: [],
      status: 'approved',
      validationSummary: '测试中模拟人工审核完成。',
    })),
  });
}

describe('Qingdao Phase 4 content governance', () => {
  it('validates the 49-place, 17-module and 17-preset candidate catalog', () => {
    const catalog = ContentCatalogSchema.parse(QINGDAO_CONTENT_CATALOG);

    expect(catalog.scope).toBe('qingdao');
    expect(catalog.reviewStatus).toBe('review-required');
    expect(catalog.counts).toMatchObject({
      places: 49,
      itineraryModules: 17,
      presetPlans: 17,
      sources: 42,
      legacySources: 24,
      legacyReservations: 8,
      legacyHotels: 3,
      legacyWishlistAttractions: 17,
      legacyWishlistMapPoints: 10,
      legacyWishlistItems: 12,
      hotelCandidates: 3,
      wishlistEntries: 29,
      servicePointCandidates: 7,
      seasonalInformation: 4,
      reservationRules: 11,
      updateJobs: 5,
      batches: 2,
    });
    expect(catalog.presetPlans.filter((preset) => preset.originalV2EightDay)).toHaveLength(1);
    expect(catalog.presetPlans.every((preset) => preset.editable)).toBe(true);
    expect(new Set(catalog.placeIds).size).toBe(49);
  });

  it('preserves and reconciles every Legacy content record without upgrading review status', () => {
    const catalog = QINGDAO_CONTENT_CATALOG;
    const importedReservations = catalog.reservationRules
      .filter((entry) => entry.legacyV2 !== null)
      .map((entry) => entry.legacyV2);
    const importedAttractions = catalog.wishlistEntries
      .filter((entry) => entry.entryType === 'attraction')
      .map((entry) => entry.legacyV2);
    const importedWishlistItems = catalog.wishlistEntries
      .filter((entry) => entry.entryType === 'food-and-purchase')
      .map((entry) => entry.legacyV2);
    const importedSourceRefs = catalog.legacyImport.sourceRefIds.map((id) =>
      catalog.sources.find((source) => source.id === id),
    );

    expect(legacySnapshot.counts).toEqual({
      sources: 24,
      reservations: 8,
      hotels: 3,
      wishlistAttractions: 17,
      wishlistMapPoints: 10,
      wishlistItems: 12,
    });
    expect(importedReservations).toStrictEqual(legacySnapshot.reservations);
    expect(catalog.hotelCandidates.map((entry) => entry.legacyV2)).toStrictEqual(
      legacySnapshot.hotels,
    );
    expect(importedAttractions).toStrictEqual(legacySnapshot.wishlist.attractions);
    expect(importedWishlistItems).toStrictEqual(legacySnapshot.wishlist.items);
    expect(catalog.legacyImport).toMatchObject({
      snapshotId: legacySnapshot.id,
      wishlistTitle: legacySnapshot.wishlist.title,
      wishlistNote: legacySnapshot.wishlist.note,
      seafoodRule: legacySnapshot.wishlist.seafoodRule,
    });
    expect(importedSourceRefs).toHaveLength(24);
    importedSourceRefs.forEach((source, index) => {
      const raw = legacySnapshot.sources[index];
      expect(source).toMatchObject({
        label: raw?.name,
        url: raw?.url,
        reviewStatus: 'review-required',
      });
      expect(source?.reviewNotes).toContain(raw?.note ?? 'missing raw source note');
    });
    expect(catalog.legacyImport.reviewStatus).toBe('review-required');
  });

  it('keeps service points as reviewed candidates and runtime searches instead of fake places', () => {
    const candidates = QINGDAO_CONTENT_CATALOG.servicePointCandidates;
    const fixed = candidates.filter((entry) => entry.candidateMode === 'verified-location');
    const runtime = candidates.filter((entry) => entry.candidateMode === 'runtime-search');

    expect(fixed).toHaveLength(3);
    expect(runtime).toHaveLength(4);
    expect(fixed.every((entry) => entry.location?.coordinateSystem === 'WGS84')).toBe(true);
    expect(runtime.every((entry) => entry.location === null && entry.address === null)).toBe(true);
    expect(new Set(candidates.map((entry) => entry.category))).toEqual(
      new Set(['hospital', 'pharmacy', 'toilet', 'parking', 'charging-station']),
    );
    expect(candidates.every((entry) => entry.reviewStatus === 'review-required')).toBe(true);
    expect(QINGDAO_CONTENT_CATALOG.placeIds).toHaveLength(49);
  });

  it('records conservative source tiers and promotional risk', () => {
    const byId = new Map(QINGDAO_CONTENT_CATALOG.sources.map((source) => [source.id, source]));

    expect(byId.get('source-qingdao-metro-official-2026')).toMatchObject({
      tier: 'official-operator',
      reviewStatus: 'review-required',
    });
    expect(byId.get('source-douyin-social-research')).toMatchObject({
      tier: 'social-media',
      promotionalRisk: 'high',
      independentEvidenceCount: 0,
      reviewStatus: 'review-required',
    });
    expect(byId.get('source-ctrip-commercial-research')).toMatchObject({
      tier: 'commercial-platform',
      promotionalRisk: 'medium',
    });
  });

  it('enforces the auditable batch state machine and human approval', () => {
    const batch = QINGDAO_CONTENT_CATALOG.batches[0];
    if (!batch) throw new Error('candidate content batch is missing');

    expect(allowedBatchTransitions('review-required')).toEqual(['approved', 'rejected']);
    expect(() =>
      transitionContentBatch({ batch, to: 'published', now: NOW, releaseVersion: 'v3.0.0' }),
    ).toThrow(ContentBatchTransitionError);
    expect(() => transitionContentBatch({ batch, to: 'approved', now: NOW })).toThrow(
      ContentBatchTransitionError,
    );

    const approved = transitionContentBatch({
      batch: { ...batch, conflicts: [] },
      to: 'approved',
      now: NOW,
      reviewer: '人工审核测试人',
      validationSummary: '冲突已由人工逐项关闭。',
    });
    expect(approved).toMatchObject({
      status: 'approved',
      reviewer: '人工审核测试人',
      reviewedAt: NOW,
    });
  });

  it('blocks the candidate release, then supports an explicitly approved release and rollback', () => {
    const releaseInput = {
      releaseVersion: 'qingdao-content-3.0.0',
      previousVersion: null,
      catalogDigest: `sha256:${'a'.repeat(64)}`,
      reviewer: '人工审核测试人',
      publishedAt: '2026-08-03T10:00:00+08:00',
      notes: '测试发布清单。',
    } as const;

    expect(() =>
      createContentRelease({ catalog: QINGDAO_CONTENT_CATALOG, ...releaseInput }),
    ).toThrow(ContentReleaseError);

    const release = createContentRelease({ catalog: humanApprovedCatalog(), ...releaseInput });
    expect(release.status).toBe('published');
    expect(release.batchIds).toEqual([
      'batch-qingdao-phase4-candidate-1',
      'batch-qingdao-phase4-legacy-migration-2',
    ]);

    const rolledBack = rollbackContentRelease({
      manifest: release,
      targetVersion: 'legacy-v2.5.4',
      rolledBackAt: '2026-08-03T10:30:00+08:00',
      notes: '测试回滚，不影响 Legacy 文件。',
    });
    expect(rolledBack).toMatchObject({
      status: 'rolled-back',
      rollbackTargetVersion: 'legacy-v2.5.4',
    });
  });

  it('computes freshness and due jobs without publishing changes', () => {
    expect(
      freshnessAt({
        observedAt: '2026-08-02T07:00:00+08:00',
        expiresAt: '2026-08-03T00:00:00+08:00',
        now: NOW,
      }),
    ).toBe('fresh');
    expect(
      freshnessAt({
        observedAt: '2026-07-01T00:00:00+08:00',
        expiresAt: '2026-08-02T07:59:59+08:00',
        now: NOW,
      }),
    ).toBe('expired');
    expect(dueContentUpdateJobs(QINGDAO_CONTENT_CATALOG.updateJobs, NOW)).toHaveLength(0);
    expect(
      dueContentUpdateJobs(QINGDAO_CONTENT_CATALOG.updateJobs, '2026-08-10T00:00:00+08:00'),
    ).toHaveLength(5);
    expect(QINGDAO_CONTENT_CATALOG.updateJobs.every((job) => job.requiresManualReview)).toBe(true);

    const job = QINGDAO_CONTENT_CATALOG.updateJobs[0];
    if (!job) throw new Error('candidate update job is missing');
    expect(() =>
      recordContentUpdateResult({
        job,
        runId: 'update-run-without-review-batch',
        startedAt: NOW,
        completedAt: '2026-08-02T08:05:00+08:00',
        changedEntityIds: ['taiqing'],
        summary: '发现变化但没有批次。',
      }),
    ).toThrow('不能绕过人工审核');
    expect(
      recordContentUpdateResult({
        job,
        runId: 'update-run-review-required',
        startedAt: NOW,
        completedAt: '2026-08-02T08:05:00+08:00',
        changedEntityIds: ['taiqing'],
        proposedBatchId: 'batch-qingdao-update-review-required',
        summary: '变化已隔离到待审批次。',
      }),
    ).toMatchObject({
      status: 'review-required',
      proposedBatchId: 'batch-qingdao-update-review-required',
    });
  });
});
