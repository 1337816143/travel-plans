import {
  MarkerNumberingSettingsSchema,
  TripPlanSchema,
  type MarkerNumberingSettings,
  type TripPlan,
} from '@qingdao/schema';

function numberFor(
  mode: MarkerNumberingSettings['mode'],
  dayIndex: number,
  placeIndex: number,
  continuousIndex: number,
  startNumber: number,
  placeId: string | null,
  itemId: string,
  customNumbers: Readonly<Record<string, string>>,
): string {
  if (mode === 'hidden') return '';
  if (mode === 'continuous') return String(startNumber + continuousIndex);
  if (mode === 'day-prefixed') return `D${dayIndex + 1}-${startNumber + placeIndex}`;
  if (mode === 'custom') return customNumbers[placeId ?? ''] ?? customNumbers[itemId] ?? '';
  return String(startNumber + placeIndex);
}

export function renumberTripPlan(
  rawPlan: unknown,
  rawSettings?: unknown,
  updatedAt?: string,
): TripPlan {
  const plan = TripPlanSchema.parse(rawPlan);
  const settings = MarkerNumberingSettingsSchema.parse(rawSettings ?? plan.markerNumbering);
  let continuousIndex = 0;
  const days = plan.days.map((day, dayIndex) => {
    let placeIndex = 0;
    const items = day.items.map((item) => {
      if (item.kind !== 'place') return item;
      const mapNumber = numberFor(
        settings.mode,
        dayIndex,
        placeIndex,
        continuousIndex,
        settings.startNumber,
        item.placeId,
        item.id,
        settings.customNumbers,
      );
      placeIndex += 1;
      continuousIndex += 1;
      return mapNumber === item.mapNumber
        ? item
        : { ...item, mapNumber, updatedAt: updatedAt ?? item.updatedAt };
    });
    const changed = items.some((item, index) => item !== day.items[index]);
    return changed ? { ...day, items, updatedAt: updatedAt ?? day.updatedAt } : day;
  });
  return TripPlanSchema.parse({
    ...plan,
    updatedAt: updatedAt ?? plan.updatedAt,
    markerNumbering: {
      ...settings,
      updatedAt: updatedAt ?? settings.updatedAt,
    },
    days,
  });
}
