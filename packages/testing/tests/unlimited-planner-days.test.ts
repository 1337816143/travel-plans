import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PLANNER_ASSUMPTIONS, generateTripPlan } from '@qingdao/planner';
import { TripRequestSchema, migrateLegacyV2RuntimePointBundle, type TripRequest } from '@qingdao/schema';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-08T21:30:00+08:00';

function fixture(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(`${repositoryRoot}${relativePath}`, 'utf8')) as unknown;
}

function request(totalDays: number): TripRequest {
  const base = TripRequestSchema.parse(
    fixture('packages/testing/fixtures/minimal-trip-request.v1.json'),
  );
  const endDate = new Date(Date.parse(`${base.startDate}T00:00:00Z`) + (totalDays - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return TripRequestSchema.parse({
    ...base,
    id: `unlimited-days-${totalDays}`,
    name: `青岛 ${totalDays} 日自定义计划`,
    endDate,
    totalDays,
  });
}

describe('unlimited custom trip duration', () => {
  it('accepts day counts beyond the previous 30-day schema ceiling', () => {
    expect(request(31).totalDays).toBe(31);
    expect(request(45).totalDays).toBe(45);
  });

  it('keeps every requested day, including empty days that can be edited later', () => {
    const places = migrateLegacyV2RuntimePointBundle(
      fixture('data/qingdao/places/imports/legacy-v2.5.4-runtime-points.v1.json'),
      { now: NOW },
    ).places;
    const plan = generateTripPlan({
      places,
      request: request(45),
      context: {
        now: NOW,
        plannerVersion: '0.5.1-unlimited-days',
        dataVersion: 'legacy-v2.5.4-review-required',
        assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
      },
    });

    expect(plan.days).toHaveLength(45);
    expect(plan.days.at(-1)?.date).toBe('2026-09-23');
    expect(plan.days.some((day) => day.items.filter((item) => item.kind === 'place').length === 0)).toBe(
      true,
    );
  });

  it('renders a free positive-integer day input with no HTML maximum', () => {
    const view = fs.readFileSync(`${repositoryRoot}apps/web/src/view.ts`, 'utf8');
    expect(view).toContain('type="number" min="1" step="1"');
    expect(view).toContain('正整数，不设产品上限');
    expect(view).not.toContain('${[1, 2, 3]');
    expect(view).not.toMatch(/data-field="total-days"[^>]*\bmax=/);
  });
});
