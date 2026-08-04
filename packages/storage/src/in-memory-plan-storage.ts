import {
  ImportExportBundleSchema,
  PersistedPlannerHistorySchema,
  PlanSnapshotSchema,
  StoredPlanCollectionSchema,
  TripPlanSchema,
  validationIssues,
  type ImportExportBundle,
  type PersistedPlannerHistory,
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

  savePlan(input: TripPlan, options: StorageWriteOptions): Promise<StorageResult<TripPlan>> {
    const parsed = TripPlanSchema.safeParse(input);
    if (!parsed.success) {
      return Promise.resolve(
        failure(
          'corrupt-data',
          validationIssues(parsed.error)
            .map((issue) => issue.path)
            .join(', '),
        ),
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
    this.commitCollection({
      ...this.collection,
      updatedAt: this.options.now(),
      plans,
      activePlanId: plan.id,
    });
    return Promise.resolve({ ok: true, value: clone(plan) });
  }

  saveWorkspace(
    input: TripPlan,
    rawHistory: PersistedPlannerHistory,
    options: StorageWriteOptions,
  ): Promise<
    StorageResult<{ readonly plan: TripPlan; readonly history: PersistedPlannerHistory }>
  > {
    const parsedPlan = TripPlanSchema.safeParse(input);
    const parsedHistory = PersistedPlannerHistorySchema.safeParse(rawHistory);
    if (!parsedPlan.success || !parsedHistory.success) {
      return Promise.resolve(failure('corrupt-data', '计划或可执行历史未通过 Schema 校验。'));
    }
    const plan = parsedPlan.data;
    const history = parsedHistory.data;
    if (history.planId !== plan.id) {
      return Promise.resolve(failure('corrupt-data', '历史 planId 与计划不一致。'));
    }
    const index = this.collection.plans.findIndex((candidate) => candidate.id === plan.id);
    const existing = index < 0 ? null : (this.collection.plans[index] ?? null);
    const matches =
      existing === null
        ? options.expectedUpdatedAt === null
        : existing.updatedAt === options.expectedUpdatedAt;
    if (!matches) {
      return Promise.resolve(
        failure('conflict', `Plan ${plan.id} changed after it was loaded`, true),
      );
    }
    const plans = clone(this.collection.plans);
    if (index < 0) plans.push(clone(plan));
    else plans[index] = clone(plan);
    const plannerHistories = [
      ...this.collection.plannerHistories.filter((candidate) => candidate.planId !== plan.id),
      clone(history),
    ];
    this.commitCollection({
      ...this.collection,
      updatedAt: this.options.now(),
      plans,
      plannerHistories,
      activePlanId: plan.id,
    });
    return Promise.resolve({ ok: true, value: { plan: clone(plan), history: clone(history) } });
  }

  getPlanHistory(planId: string): Promise<StorageResult<PersistedPlannerHistory | null>> {
    const history = this.collection.plannerHistories.find(
      (candidate) => candidate.planId === planId,
    );
    return Promise.resolve({ ok: true, value: history ? clone(history) : null });
  }

  setActivePlan(planId: string): Promise<StorageResult<void>> {
    if (
      !this.collection.plans.some((plan) => plan.id === planId) ||
      this.collection.deletedPlanIds.includes(planId)
    ) {
      return Promise.resolve(failure('not-found', `Plan ${planId} was not found`));
    }
    this.commitCollection({
      ...this.collection,
      updatedAt: this.options.now(),
      activePlanId: planId,
    });
    return Promise.resolve({ ok: true, value: undefined });
  }

  duplicatePlan(planId: string, newPlanId: string, name: string): Promise<StorageResult<TripPlan>> {
    const source = this.collection.plans.find((plan) => plan.id === planId);
    if (!source) return Promise.resolve(failure('not-found', `Plan ${planId} was not found`));
    if (this.collection.plans.some((plan) => plan.id === newPlanId)) {
      return Promise.resolve(failure('conflict', `Plan ${newPlanId} already exists`));
    }
    const now = this.options.now();
    const duplicate = TripPlanSchema.parse({
      ...clone(source),
      id: newPlanId,
      name,
      createdAt: now,
      updatedAt: now,
      request: {
        ...clone(source.request),
        id: `${newPlanId}-request`,
        name,
        createdAt: now,
        updatedAt: now,
      },
      editHistory: [],
    });
    this.commitCollection({
      ...this.collection,
      updatedAt: now,
      plans: [...this.collection.plans, duplicate],
      activePlanId: duplicate.id,
    });
    return Promise.resolve({ ok: true, value: clone(duplicate) });
  }

  renamePlan(planId: string, name: string): Promise<StorageResult<TripPlan>> {
    const index = this.collection.plans.findIndex((plan) => plan.id === planId);
    const source = this.collection.plans[index];
    if (index < 0 || !source) {
      return Promise.resolve(failure('not-found', `Plan ${planId} was not found`));
    }
    const now = this.options.now();
    const renamed = TripPlanSchema.parse({
      ...source,
      name,
      updatedAt: now,
      request: { ...source.request, name, updatedAt: now },
    });
    const plans = [...this.collection.plans];
    plans[index] = renamed;
    this.commitCollection({ ...this.collection, updatedAt: now, plans });
    return Promise.resolve({ ok: true, value: clone(renamed) });
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

  softDeletePlan(planId: string): Promise<StorageResult<void>> {
    if (!this.collection.plans.some((plan) => plan.id === planId)) {
      return Promise.resolve(failure('not-found', `Plan ${planId} was not found`));
    }
    this.commitCollection({
      ...this.collection,
      updatedAt: this.options.now(),
      deletedPlanIds: Array.from(new Set([...this.collection.deletedPlanIds, planId])),
      archivedPlanIds: this.collection.archivedPlanIds.filter((id) => id !== planId),
      activePlanId: this.collection.activePlanId === planId ? null : this.collection.activePlanId,
    });
    return Promise.resolve({ ok: true, value: undefined });
  }

  recoverPlan(planId: string): Promise<StorageResult<void>> {
    if (!this.collection.deletedPlanIds.includes(planId)) {
      return Promise.resolve(failure('not-found', `Deleted plan ${planId} was not found`));
    }
    this.commitCollection({
      ...this.collection,
      updatedAt: this.options.now(),
      deletedPlanIds: this.collection.deletedPlanIds.filter((id) => id !== planId),
      activePlanId: planId,
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
        failure(
          'corrupt-data',
          validationIssues(parsed.error)
            .map((issue) => issue.path)
            .join(', '),
        ),
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

  restoreSnapshot(snapshotId: string): Promise<StorageResult<TripPlan>> {
    const snapshot = this.collection.snapshots.find((candidate) => candidate.id === snapshotId);
    if (!snapshot) {
      return Promise.resolve(failure('not-found', `Snapshot ${snapshotId} was not found`));
    }
    const now = this.options.now();
    const restored = TripPlanSchema.parse({ ...clone(snapshot.plan), updatedAt: now });
    const index = this.collection.plans.findIndex((plan) => plan.id === restored.id);
    const plans = [...this.collection.plans];
    if (index < 0) plans.push(restored);
    else plans[index] = restored;
    this.commitCollection({
      ...this.collection,
      updatedAt: now,
      plans,
      activePlanId: restored.id,
      plannerHistories: this.collection.plannerHistories.filter(
        (history) => history.planId !== restored.id,
      ),
    });
    return Promise.resolve({ ok: true, value: clone(restored) });
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
    if (!this.bundleChecksumMatches(bundle, parsed.data)) {
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

  importBundle(bundle: unknown): Promise<StorageResult<StoredPlanCollection>> {
    const parsed = ImportExportBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      return Promise.resolve(
        failure(
          'corrupt-data',
          validationIssues(parsed.error)
            .map((issue) => issue.path)
            .join(', '),
        ),
      );
    }
    if (!this.bundleChecksumMatches(bundle, parsed.data)) {
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
        failure(
          'unknown',
          validationIssues(parsed.error)
            .map((issue) => issue.path)
            .join(', '),
        ),
      );
    }
    return Promise.resolve({ ok: true, value: parsed.data });
  }

  private commitCollection(candidate: unknown): void {
    this.collection = clone(StoredPlanCollectionSchema.parse(candidate));
  }

  private bundleChecksumMatches(raw: unknown, parsed: ImportExportBundle): boolean {
    const migratedChecksum = this.options.checksum(parsed.collection);
    if (parsed.checksum === migratedChecksum) return true;
    if (typeof raw !== 'object' || raw === null || !('collection' in raw)) return false;
    try {
      return parsed.checksum === this.options.checksum(raw.collection as StoredPlanCollection);
    } catch {
      return false;
    }
  }
}
