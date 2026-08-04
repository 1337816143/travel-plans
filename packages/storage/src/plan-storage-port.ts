import type {
  ImportExportBundle,
  PersistedPlannerHistory,
  PlanSnapshot,
  StoredPlanCollection,
  TripPlan,
  ValidationIssue,
} from '@qingdao/schema';

export type StorageFailureKind =
  | 'conflict'
  | 'corrupt-data'
  | 'migration-failed'
  | 'not-found'
  | 'quota'
  | 'unavailable'
  | 'unknown';

export type StorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly kind: StorageFailureKind;
      readonly message: string;
      readonly retryable: boolean;
    };

export interface StorageWriteOptions {
  readonly expectedUpdatedAt: string | null;
}

export interface ImportPreview {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly planIds: readonly string[];
  readonly migratedFromVersion: number | null;
}

export interface PlanStoragePort {
  loadCollection(): Promise<StorageResult<StoredPlanCollection>>;
  getPlan(planId: string): Promise<StorageResult<TripPlan>>;
  savePlan(plan: TripPlan, options: StorageWriteOptions): Promise<StorageResult<TripPlan>>;
  saveWorkspace(
    plan: TripPlan,
    history: PersistedPlannerHistory,
    options: StorageWriteOptions,
  ): Promise<StorageResult<{ readonly plan: TripPlan; readonly history: PersistedPlannerHistory }>>;
  getPlanHistory(planId: string): Promise<StorageResult<PersistedPlannerHistory | null>>;
  setActivePlan(planId: string): Promise<StorageResult<void>>;
  duplicatePlan(planId: string, newPlanId: string, name: string): Promise<StorageResult<TripPlan>>;
  renamePlan(planId: string, name: string): Promise<StorageResult<TripPlan>>;
  archivePlan(planId: string): Promise<StorageResult<void>>;
  restorePlan(planId: string): Promise<StorageResult<void>>;
  softDeletePlan(planId: string): Promise<StorageResult<void>>;
  recoverPlan(planId: string): Promise<StorageResult<void>>;
  createSnapshot(planId: string, label: string): Promise<StorageResult<PlanSnapshot>>;
  restoreSnapshot(snapshotId: string): Promise<StorageResult<TripPlan>>;
  previewImport(bundle: unknown): Promise<StorageResult<ImportPreview>>;
  importBundle(bundle: unknown): Promise<StorageResult<StoredPlanCollection>>;
  exportBundle(): Promise<StorageResult<ImportExportBundle>>;
}
