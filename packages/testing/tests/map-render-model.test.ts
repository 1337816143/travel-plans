import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildTripMapRenderModel, MapRenderModelError } from '@qingdao/map-core';
import {
  DEFAULT_PLANNER_ASSUMPTIONS,
  deterministicCommandId,
  generateTripPlan,
  moveItemWithinDay,
} from '@qingdao/planner';
import { TripRequestSchema, migrateLegacyV2RuntimePointBundle, type Place } from '@qingdao/schema';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-01T08:00:00+08:00';

function fixture(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(`${repositoryRoot}${relativePath}`, 'utf8')) as unknown;
}

function places(): Place[] {
  return migrateLegacyV2RuntimePointBundle(
    fixture('data/qingdao/places/imports/legacy-v2.5.4-runtime-points.v1.json'),
    { now: NOW },
  ).places;
}

function plannerInput() {
  const base = TripRequestSchema.parse(
    fixture('packages/testing/fixtures/minimal-trip-request.v1.json'),
  );
  return {
    places: places(),
    request: TripRequestSchema.parse({
      ...base,
      id: 'map-render-model-request',
      lunchBreak: { ...base.lunchBreak, required: false },
      selections: [
        { placeId: 'signal', priority: 'must', locked: false, notes: '' },
        { placeId: 'zhanqiao', priority: 'want', locked: false, notes: '' },
        { placeId: 'xiaoyushan', priority: 'optional', locked: false, notes: '' },
      ],
    }),
    context: {
      now: NOW,
      plannerVersion: '0.2.0-phase2',
      dataVersion: 'legacy-v2.5.4-review-required',
      assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
    },
  } as const;
}

describe('SDK-independent map RenderModel', () => {
  it('keeps marker numbering separate from placeholder icon identity', () => {
    const input = plannerInput();
    const plan = generateTripPlan(input);
    const renderModel = buildTripMapRenderModel({ plan, places: input.places });

    expect(renderModel.markers).toHaveLength(3);
    expect(renderModel.routes).toHaveLength(2);
    expect(renderModel.markers.map((marker) => marker.mapNumber)).toEqual(['1', '2', '3']);
    expect(renderModel.markers.every((marker) => !marker.iconId.includes(marker.mapNumber))).toBe(
      true,
    );
    expect(renderModel.warnings[0]).toContain('直线降级示意');
  });

  it('synchronizes map numbering and routes after a same-day move', () => {
    const input = plannerInput();
    const original = generateTripPlan(input);
    const firstDay = original.days[0];
    const firstItem = firstDay?.items[0];
    if (!firstDay || !firstItem) throw new Error('expected first map item');
    const moved = moveItemWithinDay({
      plan: original,
      places: input.places,
      dayId: firstDay.id,
      itemId: firstItem.id,
      toPlaceIndex: 2,
      commandId: deterministicCommandId(original, firstItem.id, 2),
      context: { ...input.context, now: '2026-08-01T08:05:00+08:00' },
    }).plan;
    const renderModel = buildTripMapRenderModel({ plan: moved, places: input.places });
    const dayMarkers = renderModel.markers.filter((marker) => marker.dayId === firstDay.id);

    expect(dayMarkers.map((marker) => marker.mapNumber)).toEqual(['1', '2', '3']);
    expect(dayMarkers.at(-1)?.placeId).toBe(firstItem.placeId);
    expect(renderModel.routes).toHaveLength(2);
  });

  it('fails explicitly when a plan place is unavailable', () => {
    const input = plannerInput();
    const plan = generateTripPlan(input);

    expect(() =>
      buildTripMapRenderModel({
        plan,
        places: input.places.filter((place) => place.id !== 'signal'),
      }),
    ).toThrow(MapRenderModelError);
  });
});
