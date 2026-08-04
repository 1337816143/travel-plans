import { z } from 'zod';

import { IdentifierSchema, VersionedMetadataSchema } from './common.js';

export const MarkerNumberingModeSchema = z.enum([
  'continuous',
  'per-day',
  'day-prefixed',
  'hidden',
  'custom',
]);

export const MarkerStateSchema = z.enum([
  'pending',
  'completed',
  'skipped',
  'locked',
  'must',
  'optional',
]);

export const MarkerStyleSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  iconId: IdentifierSchema,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  numberingMode: MarkerNumberingModeSchema,
  startNumber: z.number().int().positive(),
  customNumber: z.string().trim().max(20).nullable(),
  scaleWithMap: z.boolean(),
  clusterShowsCount: z.boolean(),
  state: MarkerStateSchema,
});

export const MarkerNumberingSettingsSchema = VersionedMetadataSchema.extend({
  mode: MarkerNumberingModeSchema,
  startNumber: z.number().int().positive().max(9999),
  customNumbers: z.record(IdentifierSchema, z.string().trim().max(20)),
});

export const RouteModeSchema = z.enum([
  'walking',
  'transit',
  'driving',
  'taxi',
  'cycling',
  'ferry',
  'cableway',
  'shuttle',
  'custom',
]);

export const RouteLinePatternSchema = z.enum(['solid', 'dashed', 'dotted']);

export const RouteStyleSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  width: z.number().positive().max(32),
  opacity: z.number().min(0).max(1),
  pattern: RouteLinePatternSchema,
  arrowsVisible: z.boolean(),
  arrowDirection: z.enum(['forward', 'reverse', 'both']),
  arrowSize: z.number().positive().max(64),
  arrowSpacing: z.number().positive().max(1000),
  startMarkerStyleId: IdentifierSchema.nullable(),
  endMarkerStyleId: IdentifierSchema.nullable(),
  zIndex: z.number().int(),
  visible: z.boolean(),
  scope: z.enum(['day', 'segment']),
});

export type MarkerStyle = z.infer<typeof MarkerStyleSchema>;
export type MarkerNumberingSettings = z.infer<typeof MarkerNumberingSettingsSchema>;
export type RouteMode = z.infer<typeof RouteModeSchema>;
export type RouteStyle = z.infer<typeof RouteStyleSchema>;
