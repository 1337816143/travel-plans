import { z } from 'zod';

import {
  HttpUrlSchema,
  IdentifierSchema,
  MoneySchema,
  QingdaoCoordinateSchema,
  TimeOfDaySchema,
  VersionedMetadataSchema,
} from './common.js';
import { PlaceCategorySchema } from './content.js';

export const CustomPoiSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  alias: z.string().trim().max(160),
  address: z.string().trim().max(500),
  location: QingdaoCoordinateSchema,
  category: PlaceCategorySchema,
  iconId: IdentifierSchema,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  priority: z.enum(['must', 'want', 'optional', 'exclude']),
  recommendedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  arrivalTime: TimeOfDaySchema.nullable(),
  durationMinutes: z.number().int().positive().max(1440),
  openingHours: z.string().max(1000),
  estimatedCost: MoneySchema.nullable(),
  notes: z.string().max(5000),
  detail: z.string().max(5000),
  reservation: z.string().max(2000),
  reminders: z.array(z.string().trim().min(1).max(500)),
  sourceUrls: z.array(HttpUrlSchema),
  participatesInPlanning: z.boolean(),
  locked: z.boolean(),
  planB: z.boolean(),
});

export type CustomPoi = z.infer<typeof CustomPoiSchema>;
