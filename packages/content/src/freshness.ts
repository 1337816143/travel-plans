import { DynamicObservationSchema, type DynamicObservation, type SourceRef } from '@qingdao/schema';

export type FreshnessState = DynamicObservation['freshness'];

export function freshnessAt(input: {
  readonly observedAt: string | null;
  readonly expiresAt: string | null;
  readonly now: string;
  readonly agingAfterHours?: number;
}): FreshnessState {
  if (input.observedAt === null) return 'unknown';
  const now = Date.parse(input.now);
  const observedAt = Date.parse(input.observedAt);
  if (!Number.isFinite(now) || !Number.isFinite(observedAt)) return 'unknown';
  if (input.expiresAt !== null && Date.parse(input.expiresAt) <= now) return 'expired';
  const agingAfterHours = input.agingAfterHours ?? 72;
  return now - observedAt >= agingAfterHours * 3_600_000 ? 'aging' : 'fresh';
}

export function refreshSourceFreshness(source: SourceRef, now: string): SourceRef {
  return {
    ...source,
    freshness: freshnessAt({
      observedAt: source.observedAt,
      expiresAt: source.expiresAt,
      now,
    }),
  };
}

export function refreshObservationFreshness(
  observation: DynamicObservation,
  now: string,
): DynamicObservation {
  return DynamicObservationSchema.parse({
    ...observation,
    updatedAt: now,
    freshness: freshnessAt({
      observedAt: observation.observedAt,
      expiresAt: observation.expiresAt,
      now,
      agingAfterHours: 24,
    }),
  });
}
