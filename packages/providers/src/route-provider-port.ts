import type { RouteProviderQuery, RouteProviderResult } from '@qingdao/schema';

export interface RouteProviderCapabilities {
  readonly provider: string;
  readonly supportedModes: readonly RouteProviderQuery['mode'][];
  readonly inputCoordinateSystems: readonly RouteProviderQuery['origin']['coordinateSystem'][];
}

export interface RouteProviderPort {
  readonly capabilities: RouteProviderCapabilities;
  route(query: RouteProviderQuery): Promise<RouteProviderResult>;
}
