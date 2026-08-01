import {
  ImportExportBundleSchema,
  PlanSnapshotSchema,
  StoredPlanCollectionSchema,
  TripPlanSchema,
  validationIssues,
  type ImportExportBundle,
  type PlanSnapshot,
  type StoredPlanCollection,
  type TripPlan,
} from '@qingdao/schema';

import type {
  ImportPreview,
  PlanStoragePort,
  StorageFailureKind,
  StorageResult,
  StorageWriteOptions,
} from './plan-storage-port.js';

export interface InMemoryPlanStorageOptions {
  readonly now: () => string;
  readonly appVersion: string;
  readonly dataVersion: string;
  readonly checksum: (collection: StoredPlanCollection) => string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function failure<T>(
  kind: StorageFailureKind,
  message: string,
  retryable = false,
): StorageResult<T> {
  return { ok: false, kind, message, retryable };
}

export class InMemoryPlanStorage implements PlanStoragePort {
  private collection: StoredPlanCollection;

  constructor(
    initialCollection: unknown,
    private readonly options: InMemoryPlanStorageOptions,
  ) {
    this.collection = clone(StoredPlanCollectionSchema.parse(initialCollection));
  }

  loadCollection(): Promise<StorageResult<StoredPlanCollection>> {
    return Promise.resolve({ ok: true, value: clone(this.collection) });
  }

  getPlan(planId: string): Promise<StorageResult<TripPlan>> {
    const plan = this.collection.plans.find((candidate) => candidate.id === planId);
    if (!plan || this.collection.deletedPlanIds.includes(planId)) {
      return Promise.resolve(failure('not-found', `Plan ${planId} was not found`));
    }
    return Promise.resolve({ ok: true, value: clone(plan) });
  }

  savePlan(
    input: TripPlan,
    options: StorageWriteOptions,
  ): Promise<StorageResult<TripPlan>> {
    const parsed = TripPlanSchema.safeParse(input);
    if (!parsed.success) {
      return Promise.resolve(
        failure('corrupt-data', validationIssues(parsed.error).map((issue) => issue.path).join(', ')),
      );
    }

    const plan = parsed.data;
    const index = this.collection.plans.findIndex((candidate) => candidate.id === plan.id);
    const existing = index === -1 ? null : (this.collection.plans[index] ?? null);
    const expectationMatches =
      existing === null
        ? options.expectedUpdatedAt === null
        : existing.updatedAt === options.expectedUpdatedAt;
    if (!expectationMatches) {
      return Promise.resolve(
        failure('conflict', `Plan ${plan.id} changed after it was loaded`, true),
      );
    }

    const plans = clone(this.collection.plans);
    if (index === -1) plans.push(clone(plan));
    else plans[index] = clone(plan);
    this.commitCollection({ ...this.collection, updatedAt: this.options.now(), plans });
    return Promise.resolve({ ok: true, value: clone(plan) });
  }

  archivePlan(planId: string): Promise<StorageResult<void>> {
    if (!this.collection.plans.some((plan) => plan.id === planId)) {
      return Promise.resolve(failure('not-found', `Plan ${planId} was not found`));
    }
    const archivedPlanIds = Array.from(new Set([...this.collection.archivedPlanIds, planId]));
    this.commitCollection({
      ...this.collection,
      updatedAt: this.options.now(),
      archivedPlanIds,
    });
    return Promise.resolve({ ok: true, value: undefined });
  }

  restorePlan(planId: string): Promise<StorageResult<void>> {
    if (!this.collection.archivedPlanIds.includes(planId)) {
      return Promise.resolve(failure('not-found', `Archived plan ${planId} was not found`));
    }
    this.commitCollection({
      ...this.collection,
      updatedAt: this.options.now(),
      archivedPlanIds: this.collection.archivedPlanIds.filter((id) => id !== planId),
    });
    return Promise.resolve({ ok: true, value: undefined });
  }

  createSnapshot(planId: string, label: string): Promise<StorageResult<PlanSnapshot>> {
    const plan = this.collection.plans.find((candidate) => candidate.id === planId);
    if (!plan) return Promise.resolve(failure('not-found', `Plan ${planId} was not found`));

    const now = this.options.now();
    let sequence = this.collection.snapshots.length + 1;
    let id = `snapshot-${planId}-${sequence}`;
    while (this.collection.snapshots.some((snapshot) => snapshot.id === id)) {
      sequence += 1;
      id = `snapshot-${planId}-${sequence}`;
    }
    const parsed = PlanSnapshotSchema.safeParse({
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      id,
      planId,
      label,
      capturedAt: now,
      plan: clone(plan),
    });
    if (!parsed.success) {
      return Promise.resolve(
        failure('corrupt-data', validationIssues(parsed.error).map((issue) => issue.path).join(', ')),
      );
    }

    const snapshot = parsed.data;
    this.commitCollection({
      ...this.collection,
      updatedAt: now,
      snapshots: [...this.collection.snapshots, snapshot],
    });
    return Promise.resolve({ ok: true, value: clone(snapshot) });
  }

  previewImport(bundle: unknown): Promise<StorageResult<ImportPreview>> {
    const parsed = ImportExportBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      return Promise.resolve({
        ok: true,
        value: {
          valid: false,
          issues: validationIssues(parsed.error),
          planIds: [],
          migratedFromVersion: null,
        },
      });
    }
    if (parsed.data.checksum !== this.options.checksum(parsed.data.collection)) {
      return Promise.resolve({
        ok: true,
        value: {
          valid: false,
          issues: [{ path: '$.checksum', code: 'custom', message: 'checksum 与内容不一致' }],
          planIds: [],
          migratedFromVersion: null,
        },
      });
    }
    return Promise.resolve({
      ok: true,
      value: {
        valid: true,
        issues: [],
        planIds: parsed.data.collection.plans.map((plan) => plan.id),
        migratedFromVersion: null,
      },
    });
  }

  importBundle(bundle: ImportExportBundle): Promise<StorageResult<StoredPlanCollection>> {
    const parsed = ImportExportBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      return Promise.resolve(
        failure('corrupt-data', validationIssues(parsed.error).map((issue) => issue.path).join(', ')),
      );
    }
    if (parsed.data.checksum !== this.options.checksum(parsed.data.collection)) {
      return Promise.resolve(failure('corrupt-data', '$.checksum'));
    }
    const next = clone(parsed.data.collection);
    this.collection = next;
    return Promise.resolve({ ok: true, value: clone(next) });
  }

  exportBundle(): Promise<StorageResult<ImportExportBundle>> {
    const now = this.options.now();
    const collection = clone(this.collection);
    const parsed = ImportExportBundleSchema.safeParse({
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      format: 'qingdao-travel-plans-v3',
      exportedAt: now,
      appVersion: this.options.appVersion,
      dataVersion: this.options.dataVersion,
      collection,
      checksum: this.options.checksum(collection),
    });
    if (!parsed.success) {
      return Promise.resolve(
        failure('unknown', validationIssues(parsed.error).map((issue) => issue.path).join(', ')),
      );
    }
    return Promise.resolve({ ok: true, value: parsed.data });
  }

  private commitCollection(candidate: unknown): void {
    this.collection = clone(StoredPlanCollectionSchema.parse(candidate));
  }
}
