import { z } from 'zod';

import {
  ConfidenceSchema,
  CoordinateSchema,
  IdentifierSchema,
  IsoDateTimeSchema,
  VersionedMetadataSchema,
} from './common.js';
import { RouteModeSchema } from './styles.js';

export const ProviderResultMetaSchema = z.strictObject({
  provider: z.string().trim().min(1).max(120),
  queryId: IdentifierSchema,
  queriedAt: IsoDateTimeSchema,
  validUntil: IsoDateTimeSchema.nullable(),
  estimated: z.boolean(),
  confidence: ConfidenceSchema,
});

const ProviderSuccessSchema = VersionedMetadataSchema.extend({
  ok: z.literal(true),
  meta: ProviderResultMetaSchema,
  data: z.unknown(),
}).strict();

export const ProviderFailureSchema = VersionedMetadataSchema.extend({
  ok: z.literal(false),
  meta: ProviderResultMetaSchema,
  error: z.strictObject({
    kind: z.enum([
      'validation',
      'network',
      'timeout',
      'rate-limit',
      'provider',
      'expired',
      'unsupported',
    ]),
    code: z.string().max(120).nullable(),
    message: z.string().trim().min(1).max(2000),
    retryable: z.boolean(),
  }),
}).strict();

export const ProviderResultSchema = z.discriminatedUnion('ok', [
  ProviderSuccessSchema,
  ProviderFailureSchema,
]);

export const RouteProviderQuerySchema = VersionedMetadataSchema.extend({
  queryId: IdentifierSchema,
  origin: CoordinateSchema,
  destination: CoordinateSchema,
  mode: RouteModeSchema,
  departureAt: IsoDateTimeSchema.nullable(),
})
  .strict()
  .superRefine((query, context) => {
    if (query.origin.coordinateSystem !== query.destination.coordinateSystem) {
      context.addIssue({
        code: 'custom',
        message: '查询起终点必须使用相同坐标系',
        path: ['destination', 'coordinateSystem'],
      });
    }
  });

export const RouteProviderDataSchema = z
  .strictObject({
    origin: CoordinateSchema,
    destination: CoordinateSchema,
    mode: RouteModeSchema,
    distanceMeters: z.number().nonnegative(),
    durationMinutes: z.number().nonnegative(),
    polyline: z.array(CoordinateSchema).min(2),
  })
  .superRefine((route, context) => {
    if (route.origin.coordinateSystem !== route.destination.coordinateSystem) {
      context.addIssue({
        code: 'custom',
        message: '路线起终点必须使用相同坐标系',
        path: ['destination', 'coordinateSystem'],
      });
    }
    route.polyline.forEach((coordinate, index) => {
      if (coordinate.coordinateSystem !== route.origin.coordinateSystem) {
        context.addIssue({
          code: 'custom',
          message: '路线折线坐标系必须与起点一致',
          path: ['polyline', index, 'coordinateSystem'],
        });
      }
    });
  });

const RouteProviderSuccessSchema = VersionedMetadataSchema.extend({
  ok: z.literal(true),
  meta: ProviderResultMetaSchema,
  data: RouteProviderDataSchema,
}).strict();

export const RouteProviderResultSchema = z.discriminatedUnion('ok', [
  RouteProviderSuccessSchema,
  ProviderFailureSchema,
]);

export type ProviderResult = z.infer<typeof ProviderResultSchema>;
export type RouteProviderData = z.infer<typeof RouteProviderDataSchema>;
export type RouteProviderQuery = z.infer<typeof RouteProviderQuerySchema>;
export type RouteProviderResult = z.infer<typeof RouteProviderResultSchema>;
