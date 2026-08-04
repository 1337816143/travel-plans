import {
  ContentCatalogSchema,
  ContentReleaseManifestSchema,
  type ContentCatalog,
  type ContentReleaseManifest,
} from '@qingdao/schema';

export class ContentReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentReleaseError';
  }
}

function assertPublishable(catalog: ContentCatalog): void {
  if (catalog.reviewStatus !== 'approved') {
    throw new ContentReleaseError(
      `内容包 ${catalog.id} 当前为 ${catalog.reviewStatus}，未经审核不得发布。`,
    );
  }
  if (!catalog.batches.some((batch) => batch.status === 'approved')) {
    throw new ContentReleaseError('内容包至少需要一个 approved 批次才能发布。');
  }
}

export function createContentRelease(input: {
  readonly catalog: unknown;
  readonly releaseVersion: string;
  readonly previousVersion: string | null;
  readonly catalogDigest: string;
  readonly reviewer: string;
  readonly publishedAt: string;
  readonly notes?: string;
  readonly sourceUrl?: string | null;
}): ContentReleaseManifest {
  const catalog = ContentCatalogSchema.parse(input.catalog);
  assertPublishable(catalog);
  return ContentReleaseManifestSchema.parse({
    schemaVersion: 1,
    createdAt: input.publishedAt,
    updatedAt: input.publishedAt,
    id: `release-${input.releaseVersion}`,
    scope: 'qingdao',
    catalogId: catalog.id,
    releaseVersion: input.releaseVersion,
    previousVersion: input.previousVersion,
    catalogDigest: input.catalogDigest,
    batchIds: catalog.batches
      .filter((batch) => batch.status === 'approved')
      .map((batch) => batch.id),
    counts: catalog.counts,
    status: 'published',
    reviewer: input.reviewer,
    publishedAt: input.publishedAt,
    rolledBackAt: null,
    rollbackTargetVersion: null,
    notes: input.notes ?? '',
    sourceUrl: input.sourceUrl ?? null,
  });
}

export function rollbackContentRelease(input: {
  readonly manifest: unknown;
  readonly targetVersion: string;
  readonly rolledBackAt: string;
  readonly notes: string;
}): ContentReleaseManifest {
  const manifest = ContentReleaseManifestSchema.parse(input.manifest);
  if (manifest.status !== 'published') {
    throw new ContentReleaseError('只有已发布的内容清单可以回滚。');
  }
  return ContentReleaseManifestSchema.parse({
    ...manifest,
    updatedAt: input.rolledBackAt,
    status: 'rolled-back',
    rolledBackAt: input.rolledBackAt,
    rollbackTargetVersion: input.targetVersion,
    notes: input.notes,
  });
}
