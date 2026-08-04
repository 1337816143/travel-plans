import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  StoredPlanCollectionSchema,
  TripPlanSchema,
  TripRequestSchema,
  type StoredPlanCollection,
  type TripPlan,
} from '@qingdao/schema';
import { InMemoryPlanStorage, type StorageResult } from '@qingdao/storage';
import { verifyRejectedImportIsAtomic } from '@qingdao/testing';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const initialTime = '2026-08-01T00:00:00+08:00';
const operationTime = '2026-08-02T00:00:00+08:00';

function fixture(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(`${repositoryRoot}${relativePath}`, 'utf8')) as unknown;
}

function unwrap<T>(result: StorageResult<T>): T {
  if (!result.ok) throw new Error(`${result.kind}: ${result.message}`);
  return result.value;
}

function minimalPlan(): TripPlan {
  const request = TripRequestSchema.parse(
    fixture('packages/testing/fixtures/minimal-trip-request.v1.json'),
  );
  return TripPlanSchema.parse({
    schemaVersion: 1,
    createdAt: initialTime,
    updatedAt: initialTime,
    id: 'phase1-storage-plan',
    name: 'Phase 1 storage contract plan',
    inputVersion: '1',
    plannerVersion: 'contract-fixture',
    dataVersion: 'legacy-v2.5.4-import',
    generatedAt: initialTime,
    request,
    days: [
      {
        schemaVersion: 1,
        createdAt: initialTime,
        updatedAt: initialTime,
        id: 'phase1-storage-day-1',
        date: '2026-08-10',
        timezone: 'Asia/Shanghai',
        title: '信号山纵向测试日',
        items: [
          {
            schemaVersion: 1,
            createdAt: initialTime,
            updatedAt: initialTime,
            id: 'phase1-storage-item-signal',
            dayId: 'phase1-storage-day-1',
            kind: 'place',
            placeId: 'signal',
            customTitle: '信号山公园',
            startAt: '2026-08-10T16:00:00+08:00',
            endAt: '2026-08-10T17:10:00+08:00',
            durationMinutes: 70,
            address: '青岛市市南区龙山路16号甲（西门）',
            notes: '契约 fixture，不代表 Planner 输出。',
            detail: '',
            estimatedCost: null,
            reservationIds: [],
            reminders: [],
            attachments: [],
            locked: false,
            optional: false,
            planB: false,
            markerStyleId: null,
            mapNumber: '1',
            sourceRefIds: ['signal-qingdao-government-source'],
            estimateStatus: 'unknown',
          },
        ],
        routeSegments: [],
        accommodationId: null,
        planBItemIds: [],
      },
    ],
    placeIds: ['signal'],
    activityIds: ['phase1-storage-item-signal'],
    accommodationItemIds: [],
    reservationItemIds: [],
    mealItemIds: [],
    restItemIds: [],
    conflicts: [],
    risks: [],
    planBItemIds: [],
    rejectedPlaces: [],
    estimationNotes: ['契约 fixture 未调用路线 Provider。'],
    dataFreshness: 'unknown',
    editHistory: [],
  });
}

function collection(plans: TripPlan[] = [minimalPlan()]): StoredPlanCollection {
  return StoredPlanCollectionSchema.parse({
    schemaVersion: 1,
    createdAt: initialTime,
    updatedAt: initialTime,
    id: 'phase1-storage-collection',
    plans,
    snapshots: [],
    archivedPlanIds: [],
    deletedPlanIds: [],
  });
}

function storage(initial: unknown = collection()): InMemoryPlanStorage {
  return new InMemoryPlanStorage(initial, {
    now: () => operationTime,
    appVersion: '0.1.0',
    dataVersion: 'legacy-v2.5.4-import',
    checksum: (value) => `contract-${JSON.stringify(value).length}`,
  });
}

describe('PlanStoragePort contract', () => {
  it('rejects stale saves without changing the current plan', async () => {
    const adapter = storage();
    const original = unwrap(await adapter.getPlan('phase1-storage-plan'));
    const edited = { ...original, updatedAt: operationTime, name: 'Edited plan' };

    const stale = await adapter.savePlan(edited, {
      expectedUpdatedAt: '2026-07-31T00:00:00+08:00',
    });

    expect(stale).toEqual(expect.objectContaining({ ok: false, kind: 'conflict' }));
    expect(unwrap(await adapter.getPlan(original.id))).toStrictEqual(original);

    const saved = await adapter.savePlan(edited, { expectedUpdatedAt: original.updatedAt });
    expect(unwrap(saved).name).toBe('Edited plan');
  });

  it('archives and restores reversibly', async () => {
    const adapter = storage();

    unwrap(await adapter.archivePlan('phase1-storage-plan'));
    expect(unwrap(await adapter.loadCollection()).archivedPlanIds).toEqual(['phase1-storage-plan']);

    unwrap(await adapter.restorePlan('phase1-storage-plan'));
    expect(unwrap(await adapter.loadCollection()).archivedPlanIds).toEqual([]);
  });

  it('captures an immutable plan snapshot', async () => {
    const adapter = storage();
    const snapshot = unwrap(await adapter.createSnapshot('phase1-storage-plan', 'Before edit'));
    const originalName = snapshot.plan.name;
    const edited = { ...snapshot.plan, updatedAt: operationTime, name: 'After snapshot' };

    unwrap(await adapter.savePlan(edited, { expectedUpdatedAt: snapshot.plan.updatedAt }));
    const storedSnapshot = unwrap(await adapter.loadCollection()).snapshots[0];

    expect(storedSnapshot?.plan.name).toBe(originalName);
    expect(unwrap(await adapter.getPlan(snapshot.planId)).name).toBe('After snapshot');
  });

  it('previews and rejects corrupt imports atomically', async () => {
    const adapter = storage();
    const result = await verifyRejectedImportIsAtomic(adapter, {
      format: 'qingdao-travel-plans-v3',
      collection: { plans: 'not-an-array' },
    });

    expect(result.preview.valid).toBe(false);
    expect(result.preview.issues.length).toBeGreaterThan(0);
    expect(result.after).toStrictEqual(result.before);
  });

  it('preserves collection semantics across export and import', async () => {
    const source = storage();
    unwrap(await source.archivePlan('phase1-storage-plan'));
    const bundle = unwrap(await source.exportBundle());
    const target = storage(collection([]));

    const preview = unwrap(await target.previewImport(bundle));
    expect(preview).toEqual(
      expect.objectContaining({ valid: true, planIds: ['phase1-storage-plan'] }),
    );
    const imported = unwrap(await target.importBundle(bundle));

    expect(imported).toStrictEqual(bundle.collection);
    expect(unwrap(await target.loadCollection())).toStrictEqual(bundle.collection);
  });

  it('rejects a checksum mismatch without replacing existing data', async () => {
    const adapter = storage();
    const bundle = unwrap(await adapter.exportBundle());
    const result = await verifyRejectedImportIsAtomic(adapter, {
      ...bundle,
      checksum: 'tampered-checksum',
    });

    expect(result.preview.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: '$.checksum' })]),
    );
    expect(result.after).toStrictEqual(result.before);
  });
});
