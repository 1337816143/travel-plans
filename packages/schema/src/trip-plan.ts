import { z } from 'zod';

import {
  ConfidenceSchema,
  CoordinateSchema,
  FreshnessSchema,
  HttpUrlSchema,
  IdentifierSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  MoneySchema,
  VersionedMetadataSchema,
} from './common.js';
import { RouteModeSchema } from './styles.js';
import { AccommodationAnalysisSchema } from './accommodation.js';
import { CustomPoiSchema } from './custom-poi.js';
import { MarkerNumberingSettingsSchema, MarkerStyleSchema, RouteStyleSchema } from './styles.js';
import { PlacePrioritySchema, TripRequestSchema } from './trip-request.js';

export const TripItemSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  dayId: IdentifierSchema,
  kind: z.enum([
    'place',
    'transport',
    'meal',
    'rest',
    'accommodation',
    'reservation',
    'luggage',
    'custom',
  ]),
  placeId: IdentifierSchema.nullable(),
  customTitle: z.string().trim().max(240),
  startAt: IsoDateTimeSchema.nullable(),
  endAt: IsoDateTimeSchema.nullable(),
  durationMinutes: z.number().int().nonnegative().max(1440),
  address: z.string().max(500),
  notes: z.string().max(5000),
  detail: z.string().max(5000),
  estimatedCost: MoneySchema.nullable(),
  reservationIds: z.array(IdentifierSchema),
  reminders: z.array(z.string().trim().min(1).max(500)),
  attachments: z.array(
    z.object({
      label: z.string().trim().min(1).max(160),
      url: HttpUrlSchema,
    }),
  ),
  locked: z.boolean(),
  optional: z.boolean(),
  planB: z.boolean(),
  markerStyleId: IdentifierSchema.nullable(),
  mapNumber: z.string().trim().max(20),
  sourceRefIds: z.array(IdentifierSchema),
  estimateStatus: z.enum(['verified', 'provider', 'estimated', 'unknown']),
});

export const RouteSegmentSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  dayId: IdentifierSchema,
  fromItemId: IdentifierSchema,
  toItemId: IdentifierSchema,
  mode: RouteModeSchema,
  origin: CoordinateSchema,
  destination: CoordinateSchema,
  distanceMeters: z.number().nonnegative(),
  durationMinutes: z.number().nonnegative(),
  polyline: z.array(CoordinateSchema),
  provider: z.string().trim().min(1).max(120),
  queriedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema.nullable(),
  estimated: z.boolean(),
  confidence: ConfidenceSchema,
  routeStyleId: IdentifierSchema.nullable(),
});

export const TripDaySchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  date: IsoDateSchema,
  timezone: z.literal('Asia/Shanghai'),
  title: z.string().trim().min(1).max(240),
  items: z.array(TripItemSchema),
  routeSegments: z.array(RouteSegmentSchema),
  accommodationId: IdentifierSchema.nullable(),
  planBItemIds: z.array(IdentifierSchema),
});

export const RemovedTripItemSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  item: TripItemSchema,
  originalDayId: IdentifierSchema,
  originalPlaceIndex: z.number().int().nonnegative(),
  originalPriority: PlacePrioritySchema,
  removalMode: z.enum(['disabled', 'deleted']),
  removedAt: IsoDateTimeSchema,
});

const ConflictSchema = z.object({
  id: IdentifierSchema,
  kind: z.enum([
    'must-not-scheduled',
    'overlap',
    'opening-hours',
    'transport',
    'reservation',
    'accommodation',
    'weather',
    'locked-item',
    'provider-failure',
  ]),
  severity: z.enum(['info', 'warning', 'error']),
  itemIds: z.array(IdentifierSchema),
  message: z.string().trim().min(1).max(2000),
});

const RiskSchema = z.object({
  id: IdentifierSchema,
  kind: z.enum(['fitness', 'heat', 'rain', 'wind', 'crowd', 'safety', 'data-quality']),
  level: z.enum(['low', 'medium', 'high', 'unknown']),
  itemIds: z.array(IdentifierSchema),
  explanation: z.string().trim().min(1).max(2000),
});

export const TripPlanSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  inputVersion: z.string().trim().min(1).max(80),
  plannerVersion: z.string().trim().min(1).max(80),
  dataVersion: z.string().trim().min(1).max(80),
  generatedAt: IsoDateTimeSchema,
  request: TripRequestSchema,
  days: z.array(TripDaySchema).min(1),
  placeIds: z.array(IdentifierSchema),
  activityIds: z.array(IdentifierSchema),
  accommodationItemIds: z.array(IdentifierSchema),
  reservationItemIds: z.array(IdentifierSchema),
  mealItemIds: z.array(IdentifierSchema),
  restItemIds: z.array(IdentifierSchema),
  conflicts: z.array(ConflictSchema),
  risks: z.array(RiskSchema),
  planBItemIds: z.array(IdentifierSchema),
  rejectedPlaces: z.array(
    z.object({
      placeId: IdentifierSchema,
      reasonCode: z.string().trim().min(1).max(120),
      explanation: z.string().trim().min(1).max(2000),
    }),
  ),
  estimationNotes: z.array(z.string().trim().min(1).max(2000)),
  dataFreshness: FreshnessSchema,
  customPois: z.array(CustomPoiSchema).default([]),
  markerStyles: z.array(MarkerStyleSchema).default([]),
  routeStyles: z.array(RouteStyleSchema).default([]),
  markerNumbering: MarkerNumberingSettingsSchema.default({
    schemaVersion: 1,
    createdAt: '2026-08-01T00:00:00+08:00',
    updatedAt: '2026-08-01T00:00:00+08:00',
    mode: 'per-day',
    startNumber: 1,
    customNumbers: {},
  }),
  removedItems: z.array(RemovedTripItemSchema).default([]),
  accommodationAnalysis: AccommodationAnalysisSchema.nullable().default(null),
  editHistory: z.array(
    z.object({
      commandId: IdentifierSchema,
      commandType: z.string().trim().min(1).max(120),
      appliedAt: IsoDateTimeSchema,
      explanation: z.string().max(2000),
    }),
  ),
});

export type RouteSegment = z.infer<typeof RouteSegmentSchema>;
export type RemovedTripItem = z.infer<typeof RemovedTripItemSchema>;
export type TripDay = z.infer<typeof TripDaySchema>;
export type TripItem = z.infer<typeof TripItemSchema>;
export type TripPlan = z.infer<typeof TripPlanSchema>;
