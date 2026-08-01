import {
  ConfidenceSchema,
  CoordinateSchema,
  IdentifierSchema,
  PlacePrioritySchema,
  PlaceSchema,
  RouteModeSchema,
  TripPlanSchema,
  VersionedMetadataSchema,
  type Place,
  type TripPlan,
} from '@qingdao/schema';
import { z } from 'zod';

export const MapMarkerRenderModelSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  itemId: IdentifierSchema,
  dayId: IdentifierSchema,
  placeId: IdentifierSchema,
  label: z.string().trim().min(1).max(240),
  mapNumber: z.string().trim().max(20),
  location: CoordinateSchema,
  priority: PlacePrioritySchema.exclude(['exclude']),
  locked: z.boolean(),
  optional: z.boolean(),
  iconId: IdentifierSchema,
  markerStyleId: IdentifierSchema.nullable(),
});

export const MapRouteRenderModelSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  segmentId: IdentifierSchema,
  dayId: IdentifierSchema,
  fromItemId: IdentifierSchema,
  toItemId: IdentifierSchema,
  mode: RouteModeSchema,
  points: z.array(CoordinateSchema).min(2),
  provider: z.string().trim().min(1).max(120),
  estimated: z.boolean(),
  confidence: ConfidenceSchema,
  routeStyleId: IdentifierSchema.nullable(),
});

export const MapBoundsSchema = z.object({
  north: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  west: z.number().min(-180).max(180),
});

export const TripMapRenderModelSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  planId: IdentifierSchema,
  coordinateSystem: z.literal('WGS84'),
  markers: z.array(MapMarkerRenderModelSchema),
  routes: z.array(MapRouteRenderModelSchema),
  bounds: MapBoundsSchema.nullable(),
  warnings: z.array(z.string().trim().min(1).max(1000)),
});

export type MapMarkerRenderModel = z.infer<typeof MapMarkerRenderModelSchema>;
export type MapRouteRenderModel = z.infer<typeof MapRouteRenderModelSchema>;
export type MapBounds = z.infer<typeof MapBoundsSchema>;
export type TripMapRenderModel = z.infer<typeof TripMapRenderModelSchema>;

export class MapRenderModelError extends Error {
  readonly code: 'missing-place' | 'mixed-coordinate-system';

  constructor(code: MapRenderModelError['code'], message: string) {
    super(message);
    this.name = 'MapRenderModelError';
    this.code = code;
  }
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function renderId(prefix: string, value: string): string {
  return `${prefix}-${stableHash(value)}`;
}

function boundsFor(markers: readonly MapMarkerRenderModel[]): MapBounds | null {
  if (markers.length === 0) return null;
  const latitudes = markers.map((marker) => marker.location.lat);
  const longitudes = markers.map((marker) => marker.location.lng);
  return {
    north: Math.max(...latitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    west: Math.min(...longitudes),
  };
}

function iconIdFor(place: Place): string {
  const map: Partial<Record<Place['category'], string>> = {
    attraction: 'attraction',
    'historic-building': 'historic-building',
    mountain: 'mountain',
    seaside: 'seaside',
    park: 'park',
    museum: 'museum',
    restaurant: 'restaurant',
    food: 'food',
    shopping: 'shopping',
    hotel: 'hotel',
    'transport-hub': 'transport',
    service: 'service',
  };
  return `placeholder-${map[place.category] ?? 'custom'}`;
}

export function buildTripMapRenderModel(options: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
}): TripMapRenderModel {
  const plan: TripPlan = TripPlanSchema.parse(options.plan);
  const places = options.places.map((place) => PlaceSchema.parse(place));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const selectionById = new Map(plan.request.selections.map((selection) => [selection.placeId, selection]));
  const markers: MapMarkerRenderModel[] = [];

  for (const day of plan.days) {
    for (const item of day.items) {
      if (item.placeId === null) continue;
      const place = placeById.get(item.placeId);
      const selection = selectionById.get(item.placeId);
      if (!place || !selection || selection.priority === 'exclude') {
        throw new MapRenderModelError('missing-place', `地图渲染缺少地点数据：${item.placeId}`);
      }
      if (place.location.coordinateSystem !== 'WGS84') {
        throw new MapRenderModelError(
          'mixed-coordinate-system',
          `Phase 2 RenderModel 只接受 WGS84：${place.id}`,
        );
      }
      markers.push(
        MapMarkerRenderModelSchema.parse({
          schemaVersion: 1,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          id: renderId('marker', item.id),
          itemId: item.id,
          dayId: day.id,
          placeId: place.id,
          label: item.customTitle,
          mapNumber: item.mapNumber,
          location: place.location,
          priority: selection.priority,
          locked: item.locked,
          optional: item.optional,
          iconId: iconIdFor(place),
          markerStyleId: item.markerStyleId,
        }),
      );
    }
  }

  const routes = plan.days.flatMap((day) =>
    day.routeSegments.map((segment) =>
      MapRouteRenderModelSchema.parse({
        schemaVersion: 1,
        createdAt: segment.createdAt,
        updatedAt: segment.updatedAt,
        id: renderId('map-route', segment.id),
        segmentId: segment.id,
        dayId: segment.dayId,
        fromItemId: segment.fromItemId,
        toItemId: segment.toItemId,
        mode: segment.mode,
        points: segment.polyline,
        provider: segment.provider,
        estimated: segment.estimated,
        confidence: segment.confidence,
        routeStyleId: segment.routeStyleId,
      }),
    ),
  );

  return TripMapRenderModelSchema.parse({
    schemaVersion: 1,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    id: renderId('map', plan.id),
    planId: plan.id,
    coordinateSystem: 'WGS84',
    markers,
    routes,
    bounds: boundsFor(markers),
    warnings: routes.some((route) => route.estimated)
      ? ['当前路线是直线降级示意，不代表真实道路距离或通行时间。']
      : [],
  });
}
