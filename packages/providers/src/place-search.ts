import {
  PlaceSchema,
  PlaceSearchProviderResultSchema,
  PlaceSearchQuerySchema,
  PlaceSearchResponseSchema,
  type Place,
  type PlaceCategory,
  type PlaceSearchProviderResult,
  type PlaceSearchQuery,
} from '@qingdao/schema';

import { gcj02ToWgs84 } from './gcj02.js';
import type { PlaceSearchProviderPort } from './place-search-provider-port.js';

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN');
}

function failure(
  provider: string,
  query: PlaceSearchQuery,
  kind: 'network' | 'timeout' | 'provider' | 'unsupported',
  message: string,
): PlaceSearchProviderResult {
  return PlaceSearchProviderResultSchema.parse({
    schemaVersion: 1,
    createdAt: query.createdAt,
    updatedAt: query.updatedAt,
    ok: false,
    meta: {
      provider,
      queryId: query.id,
      queriedAt: query.updatedAt,
      validUntil: null,
      estimated: false,
      confidence: 0,
    },
    error: { kind, code: null, message, retryable: kind !== 'unsupported' },
  });
}

export class CuratedQingdaoSearchProvider implements PlaceSearchProviderPort {
  readonly capabilities = {
    provider: 'qingdao-curated-offline' as const,
    requiresRuntimeSdk: false,
    outputCoordinateSystem: 'WGS84' as const,
  };

  private readonly places: readonly Place[];

  constructor(rawPlaces: readonly unknown[]) {
    this.places = rawPlaces.map((place) => PlaceSchema.parse(place));
  }

  search(rawQuery: PlaceSearchQuery): Promise<PlaceSearchProviderResult> {
    const query = PlaceSearchQuerySchema.parse(rawQuery);
    const keyword = normalized(query.keyword);
    const candidates = this.places
      .filter((place) =>
        [place.name, ...place.aliases, place.address ?? '', ...place.tags]
          .map(normalized)
          .some((value) => value.includes(keyword)),
      )
      .slice(0, query.limit)
      .map((place) => ({
        schemaVersion: 1 as const,
        createdAt: query.createdAt,
        updatedAt: query.updatedAt,
        id: `search-offline-${place.id}`,
        providerPlaceId: place.id,
        provider: 'qingdao-curated-offline' as const,
        name: place.name,
        address: place.address ?? '',
        location: place.location,
        category: place.category,
        observedAt: query.updatedAt,
        confidence: place.reviewStatus === 'approved' ? 0.9 : 0.55,
        requiresReview: place.reviewStatus !== 'approved',
      }));
    const data = PlaceSearchResponseSchema.parse({
      schemaVersion: 1,
      createdAt: query.createdAt,
      updatedAt: query.updatedAt,
      queryId: query.id,
      provider: 'qingdao-curated-offline',
      candidates,
      degraded: true,
      message: '高德 JS SDK 当前未注入；已降级检索 49 个 Legacy 青岛点位。',
    });
    return Promise.resolve(
      PlaceSearchProviderResultSchema.parse({
        schemaVersion: 1,
        createdAt: query.createdAt,
        updatedAt: query.updatedAt,
        ok: true,
        meta: {
          provider: 'qingdao-curated-offline',
          queryId: query.id,
          queriedAt: query.updatedAt,
          validUntil: null,
          estimated: false,
          confidence: 0.55,
        },
        data,
      }),
    );
  }
}

export interface AmapSearchRawCandidate {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly type: string;
}

export interface AmapSearchClient {
  search(keyword: string, city: '青岛', limit: number): Promise<readonly AmapSearchRawCandidate[]>;
}

function categoryForAmap(type: string): PlaceCategory {
  if (/餐饮|美食/.test(type)) return 'restaurant';
  if (/酒店|住宿/.test(type)) return 'hotel';
  if (/购物|商场/.test(type)) return 'shopping';
  if (/交通|机场|火车|地铁|码头/.test(type)) return 'transport-hub';
  if (/博物馆/.test(type)) return 'museum';
  if (/公园/.test(type)) return 'park';
  if (/风景|景点|旅游/.test(type)) return 'attraction';
  return 'custom';
}

export class AmapJsPlaceSearchProvider implements PlaceSearchProviderPort {
  readonly capabilities = {
    provider: 'amap-js' as const,
    requiresRuntimeSdk: true,
    outputCoordinateSystem: 'WGS84' as const,
  };

  constructor(private readonly client: AmapSearchClient | null) {}

  async search(rawQuery: PlaceSearchQuery): Promise<PlaceSearchProviderResult> {
    const query = PlaceSearchQuerySchema.parse(rawQuery);
    if (!this.client) {
      return failure('amap-js', query, 'unsupported', '页面没有注入高德 JS SDK；v3 不复制 Legacy 明文密钥。');
    }
    try {
      const raw = await this.client.search(query.keyword, query.city, query.limit);
      const candidates = raw.map((candidate) => ({
        schemaVersion: 1 as const,
        createdAt: query.createdAt,
        updatedAt: query.updatedAt,
        id: `search-amap-${candidate.id}`,
        providerPlaceId: candidate.id,
        provider: 'amap-js' as const,
        name: candidate.name,
        address: candidate.address,
        location: gcj02ToWgs84({
          lat: candidate.lat,
          lng: candidate.lng,
          coordinateSystem: 'GCJ02',
        }),
        category: categoryForAmap(candidate.type),
        observedAt: query.updatedAt,
        confidence: 0.7,
        requiresReview: true,
      }));
      const data = PlaceSearchResponseSchema.parse({
        schemaVersion: 1,
        createdAt: query.createdAt,
        updatedAt: query.updatedAt,
        queryId: query.id,
        provider: 'amap-js',
        candidates,
        degraded: false,
        message: '结果来自运行时高德 JS SDK；加入后仍标记为待核验。',
      });
      return PlaceSearchProviderResultSchema.parse({
        schemaVersion: 1,
        createdAt: query.createdAt,
        updatedAt: query.updatedAt,
        ok: true,
        meta: {
          provider: 'amap-js',
          queryId: query.id,
          queriedAt: query.updatedAt,
          validUntil: null,
          estimated: false,
          confidence: 0.7,
        },
        data,
      });
    } catch (error) {
      return failure(
        'amap-js',
        query,
        'provider',
        error instanceof Error ? error.message : '高德搜索失败。',
      );
    }
  }
}

export class FallbackPlaceSearchProvider implements PlaceSearchProviderPort {
  readonly capabilities = {
    provider: 'amap-js' as const,
    requiresRuntimeSdk: true,
    outputCoordinateSystem: 'WGS84' as const,
  };

  constructor(
    private readonly primary: PlaceSearchProviderPort,
    private readonly fallbackProvider: PlaceSearchProviderPort,
  ) {}

  async search(query: PlaceSearchQuery): Promise<PlaceSearchProviderResult> {
    const primary = await this.primary.search(query);
    return primary.ok ? primary : this.fallbackProvider.search(query);
  }
}
