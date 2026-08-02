import { PlaceFacetSchema, PlaceSchema, type Place, type PlaceFacet } from '@qingdao/schema';

const CATEGORY_FACETS: Readonly<Partial<Record<Place['category'], readonly PlaceFacet[]>>> = {
  attraction: ['classic-attraction'],
  'historic-building': ['historic-building'],
  mountain: ['mountain', 'hiking'],
  seaside: ['seaside'],
  island: ['island', 'seaside'],
  park: ['park'],
  museum: ['museum', 'indoor', 'rainy-day'],
  'art-gallery': ['art-gallery', 'indoor', 'rainy-day'],
  culture: ['religion-culture'],
  landmark: ['city-landmark'],
  photography: ['photography'],
  indoor: ['indoor', 'rainy-day'],
  restaurant: ['restaurant'],
  food: ['must-eat'],
  shopping: ['must-buy'],
  hotel: ['hotel'],
  'accommodation-area': ['accommodation-area'],
  'transport-hub': ['travel-service'],
  service: ['travel-service'],
  custom: ['travel-service'],
};

const PLACE_FACETS: Readonly<Record<string, readonly PlaceFacet[]>> = {
  signal: ['mountain', 'photography', 'couple', 'city-landmark'],
  zhanqiao: ['seaside', 'historic-building', 'photography', 'city-landmark'],
  xiaoyushan: ['mountain', 'photography', 'couple', 'low-fitness'],
  qinyu: ['seaside', 'photography', 'couple', 'sunset'],
  xiaoqingdao: ['island', 'park', 'photography', 'couple'],
  badaguan: ['historic-building', 'park', 'photography', 'couple'],
  sculpture: ['seaside', 'sunrise', 'photography'],
  'sea-love': ['seaside', 'photography', 'couple'],
  xiaomai: ['island', 'park', 'seaside', 'sunset', 'couple'],
  shilaoren: ['seaside', 'sunrise', 'sunset'],
  dhedong: ['metro-station', 'visitor-center'],
  taiqing: ['mountain', 'hiking', 'religion-culture'],
  ferry: ['pier', 'water-activity'],
  tianmushan: ['metro-station'],
  golden: ['seaside', 'sunset', 'water-activity'],
  yumingzui: ['seaside', 'sunset', 'photography', 'hidden-gem'],
  beer: ['museum', 'indoor', 'rainy-day'],
  yanerdao: ['park', 'seaside', 'couple', 'low-fitness'],
  aofan: ['pier', 'water-activity', 'night-view'],
  mayfourth: ['city-landmark', 'night-view', 'photography', 'accessible'],
  underwater: ['indoor', 'rainy-day', 'family'],
  naval: ['museum', 'indoor', 'rainy-day', 'family'],
  'rec-redwall': ['historic-building', 'photography', 'couple'],
  'rec-comic': ['photography', 'hidden-gem'],
  'rec-silverfish': ['historic-building', 'photography', 'hidden-gem'],
  'rec-xilingxia': ['seaside', 'photography', 'hidden-gem'],
  'rec-taidong': ['market', 'snack', 'night-view'],
  'rec-haipo': ['market', 'breakfast'],
  'rec-thirdbeach': ['seaside', 'night-view', 'photography'],
  'wishmap-wanhechun': ['restaurant', 'must-eat'],
  'wishmap-wangjie': ['restaurant', 'must-eat', 'snack'],
  'wishmap-gaojia': ['dessert', 'must-eat', 'specialty'],
  'wishmap-qianhaiyan': ['restaurant', 'must-eat', 'seafood'],
  'wishmap-lizhizha': ['must-buy', 'specialty'],
  'wishmap-laoshan-drinks': ['must-buy', 'specialty'],
  'wishmap-yingkou-seafood': ['market', 'seafood', 'must-eat'],
  'wishmap-jimiya-seafood': ['market', 'seafood', 'must-eat'],
  'wishmap-xiaomujia': ['restaurant', 'must-eat'],
  'wishmap-yunnan-noodle': ['restaurant', 'must-eat'],
  'holiday-inn': ['hotel'],
  westin: ['hotel'],
  haitian: ['hotel'],
  'hotel-zone': ['accommodation-area'],
  fushansuo: ['metro-station'],
};

export function classifyQingdaoPlace(rawPlace: unknown): Place {
  const place = PlaceSchema.parse(rawPlace);
  const facets = new Set<PlaceFacet>([
    ...place.facets,
    ...(CATEGORY_FACETS[place.category] ?? []),
    ...(PLACE_FACETS[place.id] ?? []),
  ]);
  return PlaceSchema.parse({ ...place, facets: [...facets] });
}

export function classificationCounts(places: readonly unknown[]): ReadonlyMap<PlaceFacet, number> {
  const counts = new Map<PlaceFacet, number>();
  places
    .map((place) => classifyQingdaoPlace(place))
    .forEach((place) => {
      place.facets.forEach((facet) => counts.set(facet, (counts.get(facet) ?? 0) + 1));
    });
  return counts;
}

export function missingQingdaoFacets(places: readonly unknown[]): readonly PlaceFacet[] {
  const counts = classificationCounts(places);
  return PlaceFacetSchema.options.filter((facet) => !counts.has(facet));
}
