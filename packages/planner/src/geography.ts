import type { Coordinate, Place } from '@qingdao/schema';

const EARTH_RADIUS_METERS = 6_371_000;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function straightLineDistanceMeters(origin: Coordinate, destination: Coordinate): number {
  const latitudeDelta = radians(destination.lat - origin.lat);
  const longitudeDelta = radians(destination.lng - origin.lng);
  const originLatitude = radians(origin.lat);
  const destinationLatitude = radians(destination.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(
    2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)),
  );
}

export function splitIntoGeographicDays(
  places: readonly Place[],
  dayCount: number,
): readonly Place[][] {
  const ordered = [...places].sort(
    (left, right) =>
      left.location.lng - right.location.lng ||
      left.location.lat - right.location.lat ||
      left.id.localeCompare(right.id),
  );
  const days: Place[][] = [];
  let offset = 0;

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const remainingPlaces = ordered.length - offset;
    const remainingDays = dayCount - dayIndex;
    const size = remainingPlaces > 0 ? Math.ceil(remainingPlaces / remainingDays) : 0;
    days.push(ordered.slice(offset, offset + size));
    offset += size;
  }

  return days.map((dayPlaces) => nearestNeighborOrder(dayPlaces));
}

function nearestNeighborOrder(places: readonly Place[]): Place[] {
  if (places.length < 2) return [...places];
  const remaining = [...places];
  const result: Place[] = [];
  const first = remaining.shift();
  if (!first) return result;
  result.push(first);

  while (remaining.length > 0) {
    const current = result[result.length - 1];
    if (!current) break;
    remaining.sort((left, right) => {
      const distanceDifference =
        straightLineDistanceMeters(current.location, left.location) -
        straightLineDistanceMeters(current.location, right.location);
      return distanceDifference || left.id.localeCompare(right.id);
    });
    const next = remaining.shift();
    if (next) result.push(next);
  }

  return result;
}
