import type { Coordinate } from '@qingdao/schema';

const PI = Math.PI;
const AXIS = 6_378_245;
const ECCENTRICITY_SQUARED = 0.006693421622965943;

function outsideChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLatitude(x: number, y: number): number {
  let result = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  result += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3;
  result += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3;
  return result;
}

function transformLongitude(x: number, y: number): number {
  let result = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  result += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3;
  result += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3;
  return result;
}

function delta(lat: number, lng: number): { readonly lat: number; readonly lng: number } {
  const latitudeRadians = (lat / 180) * PI;
  const magic = 1 - ECCENTRICITY_SQUARED * Math.sin(latitudeRadians) ** 2;
  const rootMagic = Math.sqrt(magic);
  return {
    lat:
      (transformLatitude(lng - 105, lat - 35) * 180) /
      (((AXIS * (1 - ECCENTRICITY_SQUARED)) / (magic * rootMagic)) * PI),
    lng:
      (transformLongitude(lng - 105, lat - 35) * 180) /
      ((AXIS / rootMagic) * Math.cos(latitudeRadians) * PI),
  };
}

export function gcj02ToWgs84(input: Coordinate): Coordinate {
  if (input.coordinateSystem === 'WGS84' || outsideChina(input.lat, input.lng)) return input;
  const offset = delta(input.lat, input.lng);
  return {
    lat: Number((input.lat - offset.lat).toFixed(7)),
    lng: Number((input.lng - offset.lng).toFixed(7)),
    coordinateSystem: 'WGS84',
  };
}
