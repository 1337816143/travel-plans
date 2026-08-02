import { z } from 'zod';

import { HttpUrlSchema, IdentifierSchema, VersionedMetadataSchema } from './common.js';

const IconAssetSchema = z.object({
  id: IdentifierSchema,
  url: HttpUrlSchema,
  pixelSize: z.number().int().positive().max(4096),
  theme: z.enum(['light-map', 'dark-map', 'both']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const IconManifestSchema = VersionedMetadataSchema.extend({
  resourceVersion: z.string().trim().min(1).max(80),
  scope: z.literal('qingdao'),
  numberingSeparated: z.literal(true),
  themes: z.array(z.enum(['light-map', 'dark-map'])).min(1),
  entries: z.array(
    z.object({
      id: IdentifierSchema,
      label: z.string().trim().min(1).max(120),
      status: z.enum(['placeholder', 'candidate', 'approved', 'retired']),
      assets: z.array(IconAssetSchema),
    }),
  ),
}).superRefine((manifest, context) => {
  const seen = new Set<string>();
  manifest.entries.forEach((entry, index) => {
    if (seen.has(entry.id)) {
      context.addIssue({
        code: 'custom',
        message: '图标类别 ID 必须唯一',
        path: ['entries', index, 'id'],
      });
    }
    if (entry.status === 'approved' && entry.assets.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'approved 图标必须包含正式资源',
        path: ['entries', index, 'assets'],
      });
    }
    seen.add(entry.id);
  });
});

export type IconManifest = z.infer<typeof IconManifestSchema>;
