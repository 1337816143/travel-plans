import type {
  ImportExportBundle,
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
  archivePlan(planId: string): Promise<StorageResult<void>>;
  restorePlan(planId: string): Promise<StorageResult<void>>;
  createSnapshot(planId: string, label: string): Promise<StorageResult<PlanSnapshot>>;
  previewImport(bundle: unknown): Promise<StorageResult<ImportPreview>>;
  importBundle(bundle: ImportExportBundle): Promise<StorageResult<StoredPlanCollection>>;
  exportBundle(): Promise<StorageResult<ImportExportBundle>>;
}
