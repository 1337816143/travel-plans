import { TripRequestSchema, type PlacePriority, type TripRequest } from '@qingdao/schema';

export interface RequestFormState {
  readonly startDate: string;
  readonly totalDays: number;
  readonly priorities: Readonly<Record<string, PlacePriority>>;
}

function addDays(date: string, offset: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function buildTripRequest(form: RequestFormState, now: string): TripRequest {
  return TripRequestSchema.parse({
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    id: 'qingdao-phase2-sidecar-request',
    name: `我的青岛 ${form.totalDays} 日自由行`,
    startDate: form.startDate,
    endDate: addDays(form.startDate, form.totalDays - 1),
    totalDays: form.totalDays,
    arrival: {
      at: null,
      hubPlaceId: null,
      notes: 'Phase 2 尚未采集抵达班次。',
    },
    departure: {
      at: null,
      hubPlaceId: null,
      notes: 'Phase 2 尚未采集离开班次。',
    },
    accommodation: {
      status: 'undetermined',
      placeId: null,
      areaId: null,
      allowSplitStay: false,
    },
    selections: Object.entries(form.priorities).map(([placeId, priority]) => ({
      placeId,
      priority,
      locked: false,
      notes: priority === 'must' ? '用户标记为一定要去。' : '',
    })),
    dailyWindow: { start: '08:30', end: '20:30' },
    pace: 'comfortable',
    fitness: 'standard',
    lunchBreak: {
      required: true,
      durationMinutes: 90,
      earliestStart: '12:00',
      latestEnd: '15:00',
    },
    mealDurationMinutes: 60,
    budget: { currency: 'CNY', total: null },
    transportPreferences: ['walking', 'transit'],
    taxiAcceptance: 'short-rides',
    accessibilityNeeds: [],
    party: { adults: 2, children: 0, seniors: 0 },
    luggage: 'none',
    weatherPreferences: {
      avoidRain: true,
      avoidStrongSun: true,
      avoidStrongWind: true,
    },
    lockedItemIds: [],
    notes: 'Phase 2 旁路 Web 最小闭环输入。',
    seed: 20260810,
  });
}
