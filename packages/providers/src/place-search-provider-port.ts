import type { PlaceSearchProviderResult, PlaceSearchQuery } from '@qingdao/schema';

export interface PlaceSearchProviderCapabilities {
  readonly provider: 'amap-js' | 'qingdao-curated-offline';
  readonly requiresRuntimeSdk: boolean;
  readonly outputCoordinateSystem: 'WGS84';
}

export interface PlaceSearchProviderPort {
  readonly capabilities: PlaceSearchProviderCapabilities;
  search(query: PlaceSearchQuery): Promise<PlaceSearchProviderResult>;
}
