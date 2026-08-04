import type { AmapSearchClient, AmapSearchRawCandidate } from '@qingdao/providers';

interface AmapPoiLike {
  readonly id?: string;
  readonly name?: string;
  readonly address?: string;
  readonly type?: string;
  readonly location?: { readonly lat?: number; readonly lng?: number };
}

interface AmapPlaceSearchLike {
  search(
    keyword: string,
    callback: (
      status: string,
      result: { readonly poiList?: { readonly pois?: readonly AmapPoiLike[] } },
    ) => void,
  ): void;
}

interface AmapGlobalLike {
  readonly PlaceSearch?: new (options: {
    readonly city: string;
    readonly citylimit: boolean;
    readonly pageSize: number;
  }) => AmapPlaceSearchLike;
}

function runtimeAmap(): AmapGlobalLike | null {
  const value = (globalThis as { readonly AMap?: unknown }).AMap;
  return typeof value === 'object' && value !== null ? value : null;
}

export function createRuntimeAmapSearchClient(): AmapSearchClient | null {
  const amap = runtimeAmap();
  if (!amap?.PlaceSearch) return null;
  const PlaceSearch = amap.PlaceSearch;
  return {
    search(keyword, city, limit): Promise<readonly AmapSearchRawCandidate[]> {
      return new Promise<readonly AmapSearchRawCandidate[]>((resolve, reject) => {
        const search = new PlaceSearch({ city, citylimit: true, pageSize: limit });
        search.search(keyword, (status, result) => {
          if (status !== 'complete') {
            reject(new Error(`高德 PlaceSearch 返回状态：${status}`));
            return;
          }
          const candidates = (result.poiList?.pois ?? []).flatMap((poi, index) => {
            const lat = poi.location?.lat;
            const lng = poi.location?.lng;
            if (typeof lat !== 'number' || typeof lng !== 'number' || !poi.name) return [];
            return [
              {
                id: poi.id ?? `runtime-${index}`,
                name: poi.name,
                address: poi.address ?? '',
                lat,
                lng,
                type: poi.type ?? '',
              },
            ];
          });
          resolve(candidates);
        });
      });
    },
  };
}
