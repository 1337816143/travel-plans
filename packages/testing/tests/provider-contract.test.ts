import {
  RouteProviderQuerySchema,
  RouteProviderResultSchema,
  validationIssues,
  type RouteProviderQuery,
  type RouteProviderResult,
} from '@qingdao/schema';
import type { RouteProviderPort } from '@qingdao/providers';
import { verifyRouteProviderContract } from '@qingdao/testing';
import { describe, expect, it } from 'vitest';

const timestamp = '2026-08-01T00:00:00+08:00';
const query = RouteProviderQuerySchema.parse({
  schemaVersion: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  queryId: 'route-signal-to-zhanqiao',
  origin: { lat: 36.065839, lng: 120.324916, coordinateSystem: 'WGS84' },
  destination: { lat: 36.061, lng: 120.306, coordinateSystem: 'WGS84' },
  mode: 'walking',
  departureAt: null,
});

function resultMeta(estimated: boolean): RouteProviderResult['meta'] {
  return {
    provider: 'contract-fake',
    queryId: query.queryId,
    queriedAt: timestamp,
    validUntil: null,
    estimated,
    confidence: estimated ? 0.4 : 1,
  };
}

function provider(
  route: (input: RouteProviderQuery) => Promise<RouteProviderResult>,
): RouteProviderPort {
  return {
    capabilities: {
      provider: 'contract-fake',
      supportedModes: ['walking'],
      inputCoordinateSystems: ['WGS84'],
    },
    route,
  };
}

describe('RouteProvider contract', () => {
  it('accepts an attributed route that matches the exact query', async () => {
    const fake = provider((input) =>
      Promise.resolve({
        schemaVersion: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        ok: true,
        meta: resultMeta(false),
        data: {
          origin: input.origin,
          destination: input.destination,
          mode: input.mode,
          distanceMeters: 2300,
          durationMinutes: 34,
          polyline: [input.origin, input.destination],
        },
      }),
    );

    const result = await verifyRouteProviderContract(fake, query);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected provider success');
    expect(result.meta.estimated).toBe(false);
    expect(result.data.distanceMeters).toBe(2300);
  });

  it('keeps Provider failure explicit and free of fabricated route data', async () => {
    const fake = provider(() =>
      Promise.resolve({
        schemaVersion: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        ok: false,
        meta: resultMeta(false),
        error: {
          kind: 'network',
          code: null,
          message: 'Provider unavailable in contract fixture',
          retryable: true,
        },
      }),
    );

    const result = await verifyRouteProviderContract(fake, query);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected provider failure');
    expect(result.error.kind).toBe('network');
    expect('data' in result).toBe(false);
  });

  it('rejects failure payloads that smuggle distance or duration in data', () => {
    const malformed = {
      schemaVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      ok: false,
      meta: resultMeta(true),
      error: { kind: 'network', code: null, message: 'offline', retryable: true },
      data: { distanceMeters: 1000, durationMinutes: 10 },
    };

    const result = RouteProviderResultSchema.safeParse(malformed);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected strict failure Schema to reject data');
    expect(validationIssues(result.error)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'unrecognized_keys', path: '$' })]),
    );
  });

  it('rejects mixed coordinate systems before calling a Provider', () => {
    const result = RouteProviderQuerySchema.safeParse({
      ...query,
      destination: { ...query.destination, coordinateSystem: 'GCJ02' },
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected coordinate validation to fail');
    expect(validationIssues(result.error)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '$.destination.coordinateSystem',
          code: 'custom',
        }),
      ]),
    );
  });
});
