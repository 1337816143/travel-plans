import { z } from 'zod';

import {
  ConfidenceSchema,
  IdentifierSchema,
  IsoDateTimeSchema,
  VersionedMetadataSchema,
} from './common.js';

export const ProviderResultMetaSchema = z.object({
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
});

const ProviderFailureSchema = VersionedMetadataSchema.extend({
  ok: z.literal(false),
  meta: ProviderResultMetaSchema,
  error: z.object({
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
});

export const ProviderResultSchema = z.discriminatedUnion('ok', [
  ProviderSuccessSchema,
  ProviderFailureSchema,
]);

export type ProviderResult = z.infer<typeof ProviderResultSchema>;
