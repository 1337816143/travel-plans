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
} from '@qingdao/storage';

const DATABASE_NAME = 'qingdao-travel-plans-v3-phase2';
const STORE_NAME = 'collections';
const COLLECTION_KEY = 'primary';

export interface IndexedDbPlanStorageOptions {
  readonly now: () => string;
  readonly appVersion: string;
  readonly dataVersion: string;
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

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('IndexedDB request failed')),
      { once: true },
    );
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error ?? new Error('IndexedDB transaction aborted')),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => reject(transaction.error ?? new Error('IndexedDB transaction failed')),
      { once: true },
    );
  });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`)
    .join(',')}}`;
}

async function checksum(collection: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(collection));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hexadecimal = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `sha256-${hexadecimal}`;
}

function storageError<T>(error: unknown): StorageResult<T> {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return failure('quota', 'IndexedDB 空间不足，原计划未被覆盖。', true);
  }
  const message = error instanceof Error ? error.message : String(error);
  return failure('unavailable', `IndexedDB 操作失败：${message}`, true);
}

export class IndexedDbPlanStorage implements PlanStoragePort {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly options: IndexedDbPlanStorageOptions) {}

  async loadCollection(): Promise<StorageResult<StoredPlanCollection>> {
    try {
      return { ok: true, value: clone(await this.readCollection()) };
    } catch (error) {
      return storageError(error);
    }
  }

  async getPlan(planId: string): Promise<StorageResult<TripPlan>> {
    try {
      const collection = await this.readCollection();
      const plan = collection.plans.find((candidate) => candidate.id === planId);
      if (!plan || collection.deletedPlanIds.includes(planId)) {
        return failure('not-found', `没有找到计划 ${planId}`);
      }
      return { ok: true, value: clone(plan) };
    } catch (error) {
      return storageError(error);
    }
  }

  async savePlan(
    input: TripPlan,
    options: StorageWriteOptions,
  ): Promise<StorageResult<TripPlan>> {
    const parsed = TripPlanSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        'corrupt-data',
        validationIssues(parsed.error)
          .map((issue) => issue.path)
          .join(', '),
      );
    }

    try {
      const plan = parsed.data;
      const collection = await this.readCollection();
      const index = collection.plans.findIndex((candidate) => candidate.id === plan.id);
      const existing = index < 0 ? null : (collection.plans[index] ?? null);
      const matches =
        existing === null
          ? options.expectedUpdatedAt === null
          : options.expectedUpdatedAt === existing.updatedAt;
      if (!matches) {
        return failure('conflict', '存储中的计划已有更新；请先载入后再保存。', true);
      }
      const plans = clone(collection.plans);
      if (index < 0) plans.push(clone(plan));
      else plans[index] = clone(plan);
      await this.writeCollection({
        ...collection,
        updatedAt: this.options.now(),
        plans,
        activePlanId: plan.id,
      });
      return { ok: true, value: clone(plan) };
    } catch (error) {
      return storageError(error);
    }
  }

  async saveWorkspace(
    input: TripPlan,
    rawHistory: PersistedPlannerHistory,
    options: StorageWriteOptions,
  ): Promise<
    StorageResult<{ readonly plan: TripPlan; readonly history: PersistedPlannerHistory }>
  > {
    const parsedPlan = TripPlanSchema.safeParse(input);
    const parsedHistory = PersistedPlannerHistorySchema.safeParse(rawHistory);
    if (!parsedPlan.success || !parsedHistory.success) {
      return failure('corrupt-data', '计划或可执行历史未通过 Schema 校验。');
    }
    const plan = parsedPlan.data;
    const history = parsedHistory.data;
    if (history.planId !== plan.id) return failure('corrupt-data', '历史 planId 与计划不一致。');
    try {
      const collection = await this.readCollection();
      const index = collection.plans.findIndex((candidate) => candidate.id === plan.id);
      const existing = index < 0 ? null : (collection.plans[index] ?? null);
      const matches =
        existing === null
          ? options.expectedUpdatedAt === null
          : existing.updatedAt === options.expectedUpdatedAt;
      if (!matches) return failure('conflict', '存储中的计划已有更新；请先载入后再保存。', true);
      const plans = [...collection.plans];
      if (index < 0) plans.push(clone(plan));
      else plans[index] = clone(plan);
      await this.writeCollection({
        ...collection,
        updatedAt: this.options.now(),
        plans,
        activePlanId: plan.id,
        plannerHistories: [
          ...collection.plannerHistories.filter((candidate) => candidate.planId !== plan.id),
          clone(history),
        ],
      });
      return { ok: true, value: { plan: clone(plan), history: clone(history) } };
    } catch (error) {
      return storageError(error);
    }
  }

  async getPlanHistory(planId: string): Promise<StorageResult<PersistedPlannerHistory | null>> {
    try {
      const collection = await this.readCollection();
      const history = collection.plannerHistories.find((candidate) => candidate.planId === planId);
      return { ok: true, value: history ? clone(history) : null };
    } catch (error) {
      return storageError(error);
    }
  }

  async setActivePlan(planId: string): Promise<StorageResult<void>> {
    try {
      const collection = await this.readCollection();
      if (
        !collection.plans.some((plan) => plan.id === planId) ||
        collection.deletedPlanIds.includes(planId)
      ) {
        return failure('not-found', `没有找到计划 ${planId}`);
      }
      await this.writeCollection({
        ...collection,
        updatedAt: this.options.now(),
        activePlanId: planId,
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return storageError(error);
    }
  }

  async duplicatePlan(planId: string, newPlanId: string, name: string): Promise<StorageResult<TripPlan>> {
    try {
      const collection = await this.readCollection();
      const source = collection.plans.find((plan) => plan.id === planId);
      if (!source) return failure('not-found', `没有找到计划 ${planId}`);
      if (collection.plans.some((plan) => plan.id === newPlanId)) {
        return failure('conflict', `计划 ${newPlanId} 已存在`);
      }
      const operationAt = this.options.now();
      const duplicate = TripPlanSchema.parse({
        ...clone(source),
        id: newPlanId,
        name,
        createdAt: operationAt,
        updatedAt: operationAt,
        request: {
          ...clone(source.request),
          id: `${newPlanId}-request`,
          name,
          createdAt: operationAt,
          updatedAt: operationAt,
        },
        editHistory: [],
      });
      await this.writeCollection({
        ...collection,
        updatedAt: operationAt,
        plans: [...collection.plans, duplicate],
        activePlanId: duplicate.id,
      });
      return { ok: true, value: clone(duplicate) };
    } catch (error) {
      return storageError(error);
    }
  }

  async renamePlan(planId: string, name: string): Promise<StorageResult<TripPlan>> {
    try {
      const collection = await this.readCollection();
      const index = collection.plans.findIndex((plan) => plan.id === planId);
      const source = collection.plans[index];
      if (index < 0 || !source) return failure('not-found', `没有找到计划 ${planId}`);
      const operationAt = this.options.now();
      const renamed = TripPlanSchema.parse({
        ...source,
        name,
        updatedAt: operationAt,
        request: { ...source.request, name, updatedAt: operationAt },
      });
      const plans = [...collection.plans];
      plans[index] = renamed;
      await this.writeCollection({ ...collection, updatedAt: operationAt, plans });
      return { ok: true, value: clone(renamed) };
    } catch (error) {
      return storageError(error);
    }
  }

  async archivePlan(planId: string): Promise<StorageResult<void>> {
    try {
      const collection = await this.readCollection();
      if (!collection.plans.some((plan) => plan.id === planId)) {
        return failure('not-found', `没有找到计划 ${planId}`);
      }
      await this.writeCollection({
        ...collection,
        updatedAt: this.options.now(),
        archivedPlanIds: Array.from(new Set([...collection.archivedPlanIds, planId])),
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return storageError(error);
    }
  }

  async restorePlan(planId: string): Promise<StorageResult<void>> {
    try {
      const collection = await this.readCollection();
      if (!collection.archivedPlanIds.includes(planId)) {
        return failure('not-found', `没有找到已归档计划 ${planId}`);
      }
      await this.writeCollection({
        ...collection,
        updatedAt: this.options.now(),
        archivedPlanIds: collection.archivedPlanIds.filter((id) => id !== planId),
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return storageError(error);
    }
  }

  async softDeletePlan(planId: string): Promise<StorageResult<void>> {
    try {
      const collection = await this.readCollection();
      if (!collection.plans.some((plan) => plan.id === planId)) {
        return failure('not-found', `没有找到计划 ${planId}`);
      }
      await this.writeCollection({
        ...collection,
        updatedAt: this.options.now(),
        deletedPlanIds: Array.from(new Set([...collection.deletedPlanIds, planId])),
        archivedPlanIds: collection.archivedPlanIds.filter((id) => id !== planId),
        activePlanId: collection.activePlanId === planId ? null : collection.activePlanId,
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return storageError(error);
    }
  }

  async recoverPlan(planId: string): Promise<StorageResult<void>> {
    try {
      const collection = await this.readCollection();
      if (!collection.deletedPlanIds.includes(planId)) {
        return failure('not-found', `没有找到已删除计划 ${planId}`);
      }
      await this.writeCollection({
        ...collection,
        updatedAt: this.options.now(),
        deletedPlanIds: collection.deletedPlanIds.filter((id) => id !== planId),
        activePlanId: planId,
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return storageError(error);
    }
  }

  async createSnapshot(planId: string, label: string): Promise<StorageResult<PlanSnapshot>> {
    try {
      const collection = await this.readCollection();
      const plan = collection.plans.find((candidate) => candidate.id === planId);
      if (!plan) return failure('not-found', `没有找到计划 ${planId}`);
      const now = this.options.now();
      let sequence = collection.snapshots.length + 1;
      let snapshotId = `snapshot-${planId}-${sequence}`;
      while (collection.snapshots.some((snapshot) => snapshot.id === snapshotId)) {
        sequence += 1;
        snapshotId = `snapshot-${planId}-${sequence}`;
      }
      const snapshot = PlanSnapshotSchema.parse({
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
        id: snapshotId,
        planId,
        label,
        capturedAt: now,
        plan,
      });
      await this.writeCollection({
        ...collection,
        updatedAt: now,
        snapshots: [...collection.snapshots, snapshot],
      });
      return { ok: true, value: clone(snapshot) };
    } catch (error) {
      return storageError(error);
    }
  }

  async restoreSnapshot(snapshotId: string): Promise<StorageResult<TripPlan>> {
    try {
      const collection = await this.readCollection();
      const snapshot = collection.snapshots.find((candidate) => candidate.id === snapshotId);
      if (!snapshot) return failure('not-found', `没有找到快照 ${snapshotId}`);
      const operationAt = this.options.now();
      const restored = TripPlanSchema.parse({ ...clone(snapshot.plan), updatedAt: operationAt });
      const index = collection.plans.findIndex((plan) => plan.id === restored.id);
      const plans = [...collection.plans];
      if (index < 0) plans.push(restored);
      else plans[index] = restored;
      await this.writeCollection({
        ...collection,
        updatedAt: operationAt,
        plans,
        activePlanId: restored.id,
        plannerHistories: collection.plannerHistories.filter(
          (history) => history.planId !== restored.id,
        ),
      });
      return { ok: true, value: clone(restored) };
    } catch (error) {
      return storageError(error);
    }
  }

  async previewImport(bundle: unknown): Promise<StorageResult<ImportPreview>> {
    const parsed = ImportExportBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      return {
        ok: true,
        value: {
          valid: false,
          issues: validationIssues(parsed.error),
          planIds: [],
          migratedFromVersion: null,
        },
      };
    }
    try {
      const matches = await this.bundleChecksumMatches(bundle, parsed.data);
      return {
        ok: true,
        value: {
          valid: matches,
          issues: matches
            ? []
            : [{ path: '$.checksum', code: 'custom', message: '校验和与内容不一致' }],
          planIds: matches ? parsed.data.collection.plans.map((plan) => plan.id) : [],
          migratedFromVersion: null,
        },
      };
    } catch (error) {
      return storageError(error);
    }
  }

  async importBundle(bundle: unknown): Promise<StorageResult<StoredPlanCollection>> {
    const parsed = ImportExportBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      return failure(
        'corrupt-data',
        validationIssues(parsed.error)
          .map((issue) => issue.path)
          .join(', '),
      );
    }
    try {
      if (!(await this.bundleChecksumMatches(bundle, parsed.data))) {
        return failure('corrupt-data', '校验和与内容不一致；原计划保持不变。');
      }
      await this.writeCollection(parsed.data.collection);
      return { ok: true, value: clone(parsed.data.collection) };
    } catch (error) {
      return storageError(error);
    }
  }

  async exportBundle(): Promise<StorageResult<ImportExportBundle>> {
    try {
      const collection = await this.readCollection();
      const now = this.options.now();
      const bundle = ImportExportBundleSchema.parse({
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
        format: 'qingdao-travel-plans-v3',
        exportedAt: now,
        appVersion: this.options.appVersion,
        dataVersion: this.options.dataVersion,
        collection,
        checksum: await checksum(collection),
      });
      return { ok: true, value: bundle };
    } catch (error) {
      return storageError(error);
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.addEventListener(
        'upgradeneeded',
        () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        },
        { once: true },
      );
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener(
        'error',
        () => reject(request.error ?? new Error('Unable to open IndexedDB')),
        { once: true },
      );
    });
    return this.databasePromise;
  }

  private emptyCollection(): StoredPlanCollection {
    const now = this.options.now();
    return StoredPlanCollectionSchema.parse({
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      id: COLLECTION_KEY,
      plans: [],
      snapshots: [],
      archivedPlanIds: [],
      deletedPlanIds: [],
      activePlanId: null,
      plannerHistories: [],
    });
  }

  private async readCollection(): Promise<StoredPlanCollection> {
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(COLLECTION_KEY) as IDBRequest<unknown>;
    const raw = await requestResult(request);
    if (raw === undefined) return this.emptyCollection();
    return StoredPlanCollectionSchema.parse(raw);
  }

  private async writeCollection(input: unknown): Promise<void> {
    const collection = StoredPlanCollectionSchema.parse(input);
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).put(collection, COLLECTION_KEY);
    await done;
  }

  private async bundleChecksumMatches(
    raw: unknown,
    parsed: ImportExportBundle,
  ): Promise<boolean> {
    if (parsed.checksum === (await checksum(parsed.collection))) return true;
    if (typeof raw !== 'object' || raw === null || !('collection' in raw)) return false;
    return parsed.checksum === (await checksum(raw.collection));
  }
}
