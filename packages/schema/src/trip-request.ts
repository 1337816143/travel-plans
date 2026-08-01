import { z } from 'zod';

import {
  CurrencySchema,
  IdentifierSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  TimeOfDaySchema,
  VersionedMetadataSchema,
} from './common.js';
import { PlaceSchema } from './content.js';
import { RouteModeSchema } from './styles.js';

export const PlacePrioritySchema = z.enum(['must', 'want', 'optional', 'exclude']);

export const PlaceSelectionSchema = z.object({
  placeId: IdentifierSchema,
  priority: PlacePrioritySchema,
  locked: z.boolean(),
  notes: z.string().max(2000),
});

const ArrivalDepartureSchema = z.object({
  at: IsoDateTimeSchema.nullable(),
  hubPlaceId: IdentifierSchema.nullable(),
  notes: z.string().max(1000),
});

const AccommodationRequestSchema = z.object({
  status: z.enum(['undetermined', 'area-selected', 'booked']),
  placeId: IdentifierSchema.nullable(),
  areaId: IdentifierSchema.nullable(),
  allowSplitStay: z.boolean(),
});

export const TripRequestSchema = VersionedMetadataSchema.extend({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(240),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema.nullable(),
  totalDays: z.number().int().min(1).max(30).nullable(),
  arrival: ArrivalDepartureSchema,
  departure: ArrivalDepartureSchema,
  accommodation: AccommodationRequestSchema,
  selections: z.array(PlaceSelectionSchema).min(1),
  dailyWindow: z.object({
    start: TimeOfDaySchema,
    end: TimeOfDaySchema,
  }),
  pace: z.enum(['relaxed', 'comfortable', 'balanced', 'intensive']),
  fitness: z.enum(['low', 'standard', 'high']),
  lunchBreak: z.object({
    required: z.boolean(),
    durationMinutes: z.number().int().nonnegative().max(240),
    earliestStart: TimeOfDaySchema,
    latestEnd: TimeOfDaySchema,
  }),
  mealDurationMinutes: z.number().int().min(15).max(240),
  budget: z.object({
    currency: CurrencySchema,
    total: z.number().nonnegative().nullable(),
  }),
  transportPreferences: z.array(RouteModeSchema).min(1),
  taxiAcceptance: z.enum(['never', 'emergency-only', 'short-rides', 'comfortable']),
  accessibilityNeeds: z.array(z.string().trim().min(1).max(200)),
  party: z.object({
    adults: z.number().int().nonnegative(),
    children: z.number().int().nonnegative(),
    seniors: z.number().int().nonnegative(),
  }),
  luggage: z.enum(['none', 'light', 'large']),
  weatherPreferences: z.object({
    avoidRain: z.boolean(),
    avoidStrongSun: z.boolean(),
    avoidStrongWind: z.boolean(),
  }),
  lockedItemIds: z.array(IdentifierSchema),
  notes: z.string().max(5000),
  seed: z.number().int().min(0).max(4_294_967_295),
}).superRefine((request, context) => {
  const minutes = (value: string): number => {
    const [hours = 0, minute = 0] = value.split(':').map(Number);
    return hours * 60 + minute;
  };

  if (request.endDate === null && request.totalDays === null) {
    context.addIssue({
      code: 'custom',
      message: 'endDate 与 totalDays 至少提供一个',
      path: ['totalDays'],
    });
  }

  const start = Date.parse(`${request.startDate}T00:00:00Z`);
  if (request.endDate !== null) {
    const end = Date.parse(`${request.endDate}T00:00:00Z`);
    if (end < start) {
      context.addIssue({ code: 'custom', message: 'endDate 不能早于 startDate', path: ['endDate'] });
    } else if (request.totalDays !== null && Math.floor((end - start) / 86_400_000) + 1 !== request.totalDays) {
      context.addIssue({
        code: 'custom',
        message: 'endDate 与 totalDays 不一致',
        path: ['totalDays'],
      });
    }
  }

  const seen = new Set<string>();
  request.selections.forEach((selection, index) => {
    if (seen.has(selection.placeId)) {
      context.addIssue({
        code: 'custom',
        message: '同一地点只能出现一次',
        path: ['selections', index, 'placeId'],
      });
    }
    seen.add(selection.placeId);
  });

  if (request.party.adults + request.party.children + request.party.seniors < 1) {
    context.addIssue({ code: 'custom', message: '同行人数至少为 1', path: ['party'] });
  }

  if (minutes(request.dailyWindow.start) >= minutes(request.dailyWindow.end)) {
    context.addIssue({
      code: 'custom',
      message: '每日结束时间必须晚于出发时间',
      path: ['dailyWindow', 'end'],
    });
  }

  if (minutes(request.lunchBreak.earliestStart) >= minutes(request.lunchBreak.latestEnd)) {
    context.addIssue({
      code: 'custom',
      message: '午休窗口结束时间必须晚于开始时间',
      path: ['lunchBreak', 'latestEnd'],
    });
  }
});

export const PlanningInputSchema = VersionedMetadataSchema.extend({
  request: TripRequestSchema,
  selectedPlaces: z.array(
    z.object({
      place: PlaceSchema,
      priority: z.enum(['must', 'want', 'optional']),
      locked: z.boolean(),
      notes: z.string().max(2000),
    }),
  ),
  excludedPlaceIds: z.array(IdentifierSchema),
  effectiveDays: z.number().int().min(1).max(30),
  timezone: z.literal('Asia/Shanghai'),
});

export type PlacePriority = z.infer<typeof PlacePrioritySchema>;
export type PlanningInput = z.infer<typeof PlanningInputSchema>;
export type TripRequest = z.infer<typeof TripRequestSchema>;
