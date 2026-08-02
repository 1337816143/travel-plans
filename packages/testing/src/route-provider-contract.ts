import {
  RouteProviderQuerySchema,
  RouteProviderResultSchema,
  type RouteProviderQuery,
  type RouteProviderResult,
} from '@qingdao/schema';
import type { RouteProviderPort } from '@qingdao/providers';

export class ProviderContractError extends Error {
  override readonly name = 'ProviderContractError';
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function verifyRouteProviderContract(
  provider: RouteProviderPort,
  input: RouteProviderQuery,
): Promise<RouteProviderResult> {
  const query = RouteProviderQuerySchema.parse(input);
  if (!provider.capabilities.supportedModes.includes(query.mode)) {
    throw new ProviderContractError('Provider capabilities do not include the requested mode');
  }
  if (!provider.capabilities.inputCoordinateSystems.includes(query.origin.coordinateSystem)) {
    throw new ProviderContractError(
      'Provider capabilities do not include the input coordinate system',
    );
  }

  const result = RouteProviderResultSchema.parse(await provider.route(query));
  if (result.meta.provider !== provider.capabilities.provider) {
    throw new ProviderContractError('Result provider does not match advertised capabilities');
  }
  if (result.meta.queryId !== query.queryId) {
    throw new ProviderContractError('Result queryId does not match the request');
  }
  if (result.ok) {
    if (!sameValue(result.data.origin, query.origin)) {
      throw new ProviderContractError('Route origin does not match the request');
    }
    if (!sameValue(result.data.destination, query.destination)) {
      throw new ProviderContractError('Route destination does not match the request');
    }
    if (result.data.mode !== query.mode) {
      throw new ProviderContractError('Route mode does not match the request');
    }
  }
  return result;
}
