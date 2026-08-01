import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = 1 as const;

export const IdentifierSchema = z.string().trim().min(1).max(160);
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '必须是 YYYY-MM-DD');
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const TimeOfDaySchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, '必须是 HH:mm');
export const HttpUrlSchema = z.string().url().refine((value) => /^https?:\/\//i.test(value), {
  message: '只允许 HTTP/HTTPS URL',
});

export const VersionedMetadataSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CoordinateSystemSchema = z.enum(['WGS84', 'GCJ02']);
export const CoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  coordinateSystem: CoordinateSystemSchema,
});
export const QingdaoCoordinateSchema = CoordinateSchema.superRefine((coordinate, context) => {
  if (
    coordinate.lat < 35.4 ||
    coordinate.lat > 37.2 ||
    coordinate.lng < 119.2 ||
    coordinate.lng > 122.2
  ) {
    context.addIssue({
      code: 'custom',
      message: '坐标不在青岛及青岛直接相关线路的允许范围内',
      path: ['lat'],
    });
  }
});

export const ConfidenceSchema = z.number().min(0).max(1);
export const CurrencySchema = z.literal('CNY');
export const MoneySchema = z.object({
  currency: CurrencySchema,
  amount: z.number().nonnegative(),
});

export const ReviewStatusSchema = z.enum([
  'draft',
  'review-required',
  'approved',
  'published',
  'rejected',
]);
export const FreshnessSchema = z.enum(['fresh', 'aging', 'expired', 'unknown']);

export type Coordinate = z.infer<typeof CoordinateSchema>;
export type VersionedMetadata = z.infer<typeof VersionedMetadataSchema>;
