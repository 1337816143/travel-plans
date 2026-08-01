import { z } from 'zod';

import { IsoDateTimeSchema } from './common.js';
import { DynamicObservationSchema, PlaceSchema, SourceRefSchema } from './content.js';
import { CustomPoiSchema } from './custom-poi.js';
import { EditCommandSchema } from './edit-command.js';
import { IconManifestSchema } from './icon.js';
import {
  ContentBatchSchema,
  ItineraryModuleSchema,
  PresetPlanSchema,
  ReservationRuleSchema,
} from './itinerary-content.js';
import { ProviderResultSchema } from './provider.js';
import { ImportExportBundleSchema, PlanSnapshotSchema, StoredPlanCollectionSchema } from './storage.js';
import { MarkerStyleSchema, RouteStyleSchema } from './styles.js';
import { PlanningInputSchema, TripRequestSchema } from './trip-request.js';
import { RouteSegmentSchema, TripDaySchema, TripItemSchema, TripPlanSchema } from './trip-plan.js';

export const MigrationContextSchema = z.object({
  now: IsoDateTimeSchema,
});

export type MigrationContext = z.infer<typeof MigrationContextSchema>;

export class UnsupportedSchemaVersionError extends Error {
  readonly entity: string;
  readonly receivedVersion: unknown;

  constructor(entity: string, receivedVersion: unknown) {
    super(`${entity}: unsupported schemaVersion ${String(receivedVersion)}`);
    this.name = 'UnsupportedSchemaVersionError';
    this.entity = entity;
    this.receivedVersion = receivedVersion;
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function createV1Migrator<TSchema extends z.ZodType>(entity: string, schema: TSchema) {
  return (input: unknown, rawContext: MigrationContext): z.infer<TSchema> => {
    const context = MigrationContextSchema.parse(rawContext);
    if (!isRecord(input)) return schema.parse(input);

    const version = input.schemaVersion ?? 0;
    if (version !== 0 && version !== 1) throw new UnsupportedSchemaVersionError(entity, version);

    const candidate =
      version === 0
        ? {
            ...input,
            schemaVersion: 1,
            createdAt: input.createdAt ?? context.now,
            updatedAt: input.updatedAt ?? context.now,
          }
        : input;
    return schema.parse(candidate);
  };
}

export const migrateSourceRef = createV1Migrator('SourceRef', SourceRefSchema);
export const migrateDynamicObservation = createV1Migrator(
  'DynamicObservation',
  DynamicObservationSchema,
);
export const migratePlace = createV1Migrator('Place', PlaceSchema);
export const migrateTripRequest = createV1Migrator('TripRequest', TripRequestSchema);
export const migratePlanningInput = createV1Migrator('PlanningInput', PlanningInputSchema);
export const migrateTripPlan = createV1Migrator('TripPlan', TripPlanSchema);
export const migrateTripDay = createV1Migrator('TripDay', TripDaySchema);
export const migrateTripItem = createV1Migrator('TripItem', TripItemSchema);
export const migrateRouteSegment = createV1Migrator('RouteSegment', RouteSegmentSchema);
export const migrateCustomPoi = createV1Migrator('CustomPoi', CustomPoiSchema);
export const migrateMarkerStyle = createV1Migrator('MarkerStyle', MarkerStyleSchema);
export const migrateRouteStyle = createV1Migrator('RouteStyle', RouteStyleSchema);
export const migrateIconManifest = createV1Migrator('IconManifest', IconManifestSchema);
export const migrateItineraryModule = createV1Migrator('ItineraryModule', ItineraryModuleSchema);
export const migratePresetPlan = createV1Migrator('PresetPlan', PresetPlanSchema);
export const migrateReservationRule = createV1Migrator('ReservationRule', ReservationRuleSchema);
export const migrateContentBatch = createV1Migrator('ContentBatch', ContentBatchSchema);
export const migrateEditCommand = createV1Migrator('EditCommand', EditCommandSchema);
export const migrateProviderResult = createV1Migrator('ProviderResult', ProviderResultSchema);
export const migratePlanSnapshot = createV1Migrator('PlanSnapshot', PlanSnapshotSchema);
export const migrateStoredPlanCollection = createV1Migrator(
  'StoredPlanCollection',
  StoredPlanCollectionSchema,
);
export const migrateImportExportBundle = createV1Migrator(
  'ImportExportBundle',
  ImportExportBundleSchema,
);
