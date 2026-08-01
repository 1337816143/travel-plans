import type { ImportExportBundle, StoredPlanCollection } from '@qingdao/schema';
import type { ImportPreview, PlanStoragePort, StorageResult } from '@qingdao/storage';

export class StorageContractError extends Error {
  override readonly name = 'StorageContractError';
}

function unwrap<T>(result: StorageResult<T>): T {
  if (!result.ok) throw new StorageContractError(`${result.kind}: ${result.message}`);
  return result.value;
}

export interface RejectedImportContractResult {
  readonly before: StoredPlanCollection;
  readonly after: StoredPlanCollection;
  readonly preview: ImportPreview;
}

export async function verifyRejectedImportIsAtomic(
  storage: PlanStoragePort,
  candidate: unknown,
): Promise<RejectedImportContractResult> {
  const before = unwrap(await storage.loadCollection());
  const preview = unwrap(await storage.previewImport(candidate));
  if (preview.valid) throw new StorageContractError('Corrupt import unexpectedly passed preview');

  const imported = await storage.importBundle(candidate as ImportExportBundle);
  if (imported.ok || imported.kind !== 'corrupt-data') {
    throw new StorageContractError('Corrupt import did not return corrupt-data');
  }

  const after = unwrap(await storage.loadCollection());
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new StorageContractError('Rejected import changed the stored collection');
  }
  return { before, after, preview };
}
