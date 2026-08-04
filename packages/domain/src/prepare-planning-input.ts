import {
  PlanningInputSchema,
  PlaceSchema,
  TripRequestSchema,
  type PlanningInput,
  type TripRequest,
} from '@qingdao/schema';

export class PlanningInputError extends Error {
  readonly code: 'duplicate-place' | 'invalid-request' | 'missing-place';

  constructor(code: PlanningInputError['code'], message: string) {
    super(message);
    this.name = 'PlanningInputError';
    this.code = code;
  }
}

function effectiveDays(request: TripRequest): number {
  if (request.totalDays !== null) return request.totalDays;
  if (request.endDate === null) throw new PlanningInputError('invalid-request', '缺少旅行结束日期');
  const start = Date.parse(`${request.startDate}T00:00:00Z`);
  const end = Date.parse(`${request.endDate}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

export interface PreparePlanningInputOptions {
  readonly places: readonly unknown[];
  readonly request: unknown;
}

export function preparePlanningInput(options: PreparePlanningInputOptions): PlanningInput {
  const request = TripRequestSchema.parse(options.request);
  const places = options.places.map((place) => PlaceSchema.parse(place));
  const placeById = new Map<string, (typeof places)[number]>();

  for (const place of places) {
    if (placeById.has(place.id)) {
      throw new PlanningInputError('duplicate-place', `重复的地点 ID：${place.id}`);
    }
    placeById.set(place.id, place);
  }

  const selectedPlaces = request.selections
    .filter((selection) => selection.priority !== 'exclude')
    .map((selection) => {
      const place = placeById.get(selection.placeId);
      if (!place) {
        throw new PlanningInputError(
          'missing-place',
          `TripRequest 引用了缺失地点：${selection.placeId}`,
        );
      }
      return {
        place,
        priority: selection.priority,
        locked: selection.locked,
        notes: selection.notes,
      };
    });

  return PlanningInputSchema.parse({
    schemaVersion: 1,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    request,
    selectedPlaces,
    excludedPlaceIds: request.selections
      .filter((selection) => selection.priority === 'exclude')
      .map((selection) => selection.placeId),
    effectiveDays: effectiveDays(request),
    timezone: 'Asia/Shanghai',
  });
}
