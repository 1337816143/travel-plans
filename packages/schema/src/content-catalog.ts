import { z } from 'zod';

import {
  HttpUrlSchema,
  IdentifierSchema,
  IsoDateTimeSchema,
  ReviewStatusSchema,
  VersionedMetadataSchema,
} from './common.js';
import { SeasonalInformationSchema, SourceRefSchema } from './content.js';
import {
  ContentBatchSchema,
  ContentUpdateJobSchema,
  ItineraryModuleSchema,
  PresetPlanSchema,
  ReservationRuleSchema,
} from './itinerary-content.js';

export const ContentCatalogCountsSchema = z.object({
  places: z.number().int().nonnegative(),
  sources: z.number().int().nonnegative(),
  seasonalInformation: z.number().int().nonnegative(),
  itineraryModules: z.number().int().nonnegative(),
  presetPlans: z.number().int().nonnegative(),
  reservationRules: z.number().int().nonnegative(),
  updateJobs: z.number().int().nonnegative(),
  batches: z.number().int().nonnegative(),
});

function duplicateIndexes(values: readonly string[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  values.forEach((value, index) => {
    if (seen.has(value)) duplicates.push(index);
    else seen.add(value);
  });
  return duplicates;
}

export const ContentCatalogSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  scope: z.literal('qingdao'),
  dataVersion: z.string().trim().min(1).max(80),
  reviewStatus: ReviewStatusSchema,
  placeIds: z.array(IdentifierSchema).min(1),
  sources: z.array(SourceRefSchema).min(1),
  seasonalInformation: z.array(SeasonalInformationSchema),
  itineraryModules: z.array(ItineraryModuleSchema).min(1),
  presetPlans: z.array(PresetPlanSchema).min(1),
  reservationRules: z.array(ReservationRuleSchema),
  updateJobs: z.array(ContentUpdateJobSchema),
  batches: z.array(ContentBatchSchema).min(1),
  counts: ContentCatalogCountsSchema,
}).superRefine((catalog, context) => {
  const collections: ReadonlyArray<{
    readonly path: string;
    readonly ids: readonly string[];
  }> = [
    { path: 'placeIds', ids: catalog.placeIds },
    { path: 'sources', ids: catalog.sources.map((entry) => entry.id) },
    {
      path: 'seasonalInformation',
      ids: catalog.seasonalInformation.map((entry) => entry.id),
    },
    { path: 'itineraryModules', ids: catalog.itineraryModules.map((entry) => entry.id) },
    { path: 'presetPlans', ids: catalog.presetPlans.map((entry) => entry.id) },
    { path: 'reservationRules', ids: catalog.reservationRules.map((entry) => entry.id) },
    { path: 'updateJobs', ids: catalog.updateJobs.map((entry) => entry.id) },
    { path: 'batches', ids: catalog.batches.map((entry) => entry.id) },
  ];
  collections.forEach((collection) => {
    duplicateIndexes(collection.ids).forEach((index) => {
      context.addIssue({
        code: 'custom',
        message: `ID 重复：${collection.ids[index] ?? ''}`,
        path:
          collection.path === 'placeIds'
            ? [collection.path, index]
            : [collection.path, index, 'id'],
      });
    });
  });

  const actualCounts = {
    places: catalog.placeIds.length,
    sources: catalog.sources.length,
    seasonalInformation: catalog.seasonalInformation.length,
    itineraryModules: catalog.itineraryModules.length,
    presetPlans: catalog.presetPlans.length,
    reservationRules: catalog.reservationRules.length,
    updateJobs: catalog.updateJobs.length,
    batches: catalog.batches.length,
  };
  (Object.keys(actualCounts) as Array<keyof typeof actualCounts>).forEach((key) => {
    if (catalog.counts[key] !== actualCounts[key]) {
      context.addIssue({
        code: 'custom',
        message: `${key} 计数应为 ${actualCounts[key]}`,
        path: ['counts', key],
      });
    }
  });

  const placeIds = new Set(catalog.placeIds);
  const sourceIds = new Set(catalog.sources.map((source) => source.id));
  const moduleIds = new Set(catalog.itineraryModules.map((module) => module.id));
  const reservationIds = new Set(catalog.reservationRules.map((rule) => rule.id));
  const entityIds = new Set(collections.flatMap((collection) => collection.ids));

  const requireIds = (
    values: readonly string[],
    available: ReadonlySet<string>,
    path: (string | number)[],
    kind: string,
  ): void => {
    values.forEach((value, index) => {
      if (!available.has(value)) {
        context.addIssue({
          code: 'custom',
          message: `引用了不存在的${kind}：${value}`,
          path: [...path, index],
        });
      }
    });
  };

  catalog.seasonalInformation.forEach((information, index) => {
    requireIds(
      information.subjectIds,
      placeIds,
      ['seasonalInformation', index, 'subjectIds'],
      '点位',
    );
    requireIds(
      information.sourceRefIds,
      sourceIds,
      ['seasonalInformation', index, 'sourceRefIds'],
      '来源',
    );
  });

  catalog.itineraryModules.forEach((module, index) => {
    requireIds(module.placeIds, placeIds, ['itineraryModules', index, 'placeIds'], '点位');
    requireIds(module.sourceRefIds, sourceIds, ['itineraryModules', index, 'sourceRefIds'], '来源');
    requireIds(
      module.reservationIds,
      reservationIds,
      ['itineraryModules', index, 'reservationIds'],
      '预约规则',
    );
    (['planBModuleIds', 'splittableInto', 'mergeableWith', 'conflictsWith'] as const).forEach(
      (field) => {
        requireIds(module[field], moduleIds, ['itineraryModules', index, field], '日程模块');
      },
    );
  });

  catalog.presetPlans.forEach((preset, index) => {
    requireIds(preset.moduleIds, moduleIds, ['presetPlans', index, 'moduleIds'], '日程模块');
    requireIds(preset.sourceRefIds, sourceIds, ['presetPlans', index, 'sourceRefIds'], '来源');
    const presetPlaceIds = new Set(
      catalog.itineraryModules
        .filter((module) => preset.moduleIds.includes(module.id))
        .flatMap((module) => module.placeIds),
    );
    Object.keys(preset.selectionPriorities).forEach((placeId) => {
      if (!presetPlaceIds.has(placeId)) {
        context.addIssue({
          code: 'custom',
          message: `预设优先级引用了模块外点位：${placeId}`,
          path: ['presetPlans', index, 'selectionPriorities', placeId],
        });
      }
    });
  });

  catalog.reservationRules.forEach((rule, index) => {
    requireIds(rule.placeIds, placeIds, ['reservationRules', index, 'placeIds'], '点位');
    requireIds(rule.sourceRefIds, sourceIds, ['reservationRules', index, 'sourceRefIds'], '来源');
  });

  catalog.updateJobs.forEach((job, index) => {
    requireIds(job.subjectIds, placeIds, ['updateJobs', index, 'subjectIds'], '点位');
    requireIds(job.sourceRefIds, sourceIds, ['updateJobs', index, 'sourceRefIds'], '来源');
  });

  catalog.batches.forEach((batch, index) => {
    requireIds(batch.sourceRefIds, sourceIds, ['batches', index, 'sourceRefIds'], '来源');
    requireIds(
      [...batch.addedEntityIds, ...batch.modifiedEntityIds],
      entityIds,
      ['batches', index, 'entityIds'],
      '内容实体',
    );
  });

  const originalEightDay = catalog.presetPlans.filter((preset) => preset.originalV2EightDay);
  if (originalEightDay.length !== 1 || originalEightDay[0]?.totalDays !== 8) {
    context.addIssue({
      code: 'custom',
      message: '内容包必须且只能包含一个 8 天原版方案',
      path: ['presetPlans'],
    });
  }

  if (['approved', 'published'].includes(catalog.reviewStatus)) {
    const reviewables = [
      ...catalog.sources,
      ...catalog.seasonalInformation,
      ...catalog.itineraryModules,
      ...catalog.presetPlans,
      ...catalog.reservationRules,
    ];
    reviewables.forEach((entity, index) => {
      if (!['approved', 'published'].includes(entity.reviewStatus)) {
        context.addIssue({
          code: 'custom',
          message: '内容包通过审核前，所有正式实体都必须 approved 或 published',
          path: ['reviewables', index, 'reviewStatus'],
        });
      }
    });
  }
  if (
    catalog.reviewStatus === 'published' &&
    !catalog.batches.some((batch) => batch.status === 'published')
  ) {
    context.addIssue({
      code: 'custom',
      message: '已发布内容包必须关联已发布批次',
      path: ['batches'],
    });
  }
});

export const ContentReleaseManifestSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  scope: z.literal('qingdao'),
  catalogId: IdentifierSchema,
  releaseVersion: z.string().trim().min(1).max(80),
  previousVersion: z.string().trim().max(80).nullable(),
  catalogDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  batchIds: z.array(IdentifierSchema).min(1),
  counts: ContentCatalogCountsSchema,
  status: z.enum(['candidate', 'published', 'rolled-back']),
  reviewer: z.string().trim().min(1).max(160),
  publishedAt: IsoDateTimeSchema.nullable(),
  rolledBackAt: IsoDateTimeSchema.nullable(),
  rollbackTargetVersion: z.string().trim().max(80).nullable(),
  notes: z.string().max(3000),
  sourceUrl: HttpUrlSchema.nullable(),
}).superRefine((manifest, context) => {
  if (manifest.status === 'published' && manifest.publishedAt === null) {
    context.addIssue({
      code: 'custom',
      message: '发布清单必须记录 publishedAt',
      path: ['publishedAt'],
    });
  }
  if (
    manifest.status === 'rolled-back' &&
    (manifest.rolledBackAt === null || manifest.rollbackTargetVersion === null)
  ) {
    context.addIssue({
      code: 'custom',
      message: '回滚清单必须记录时间和目标版本',
      path: ['rollbackTargetVersion'],
    });
  }
});

export type ContentCatalog = z.infer<typeof ContentCatalogSchema>;
export type ContentCatalogCounts = z.infer<typeof ContentCatalogCountsSchema>;
export type ContentReleaseManifest = z.infer<typeof ContentReleaseManifestSchema>;
