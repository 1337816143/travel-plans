import {
  CustomPoiSchema,
  MarkerNumberingSettingsSchema,
  MarkerStyleSchema,
  RouteStyleSchema,
  type CustomPoi,
  type MarkerNumberingSettings,
  type MarkerStyle,
  type PlacePriority,
  type PlaceSearchCandidate,
  type RouteStyle,
} from '@qingdao/schema';

function textValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function required(form: FormData, name: string): string {
  const value = textValue(form, name);
  if (!value) throw new Error(`请填写${name}。`);
  return value;
}

function checked(form: FormData, name: string): boolean {
  return form.get(name) !== null;
}

function safeId(value: string): string {
  return value
    .toLocaleLowerCase('zh-CN')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'place';
}

export function customPoiFromForm(form: FormData, now: string): CustomPoi {
  const name = required(form, 'name');
  const sourceUrl = textValue(form, 'sourceUrl');
  const recommendedDate = textValue(form, 'recommendedDate');
  const arrivalTime = textValue(form, 'arrivalTime');
  const cost = textValue(form, 'estimatedCost');
  return CustomPoiSchema.parse({
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    id: `custom-${safeId(name)}-${Date.parse(now).toString(36)}`,
    name,
    alias: textValue(form, 'alias'),
    address: textValue(form, 'address'),
    location: {
      lat: Number(required(form, 'lat')),
      lng: Number(required(form, 'lng')),
      coordinateSystem: 'WGS84',
    },
    category: required(form, 'category'),
    iconId: required(form, 'iconId'),
    color: required(form, 'color'),
    priority: required(form, 'priority'),
    recommendedDate: recommendedDate || null,
    arrivalTime: arrivalTime || null,
    durationMinutes: Number(required(form, 'durationMinutes')),
    openingHours: textValue(form, 'openingHours'),
    estimatedCost: cost ? { currency: 'CNY', amount: Number(cost) } : null,
    notes: textValue(form, 'notes'),
    detail: textValue(form, 'detail'),
    reservation: textValue(form, 'reservation'),
    reminders: textValue(form, 'reminders')
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean),
    sourceUrls: sourceUrl ? [sourceUrl] : [],
    participatesInPlanning: checked(form, 'participatesInPlanning'),
    locked: checked(form, 'locked'),
    planB: checked(form, 'planB'),
  });
}

export function searchCandidateToCustomPoi(
  candidate: PlaceSearchCandidate,
  priority: Exclude<PlacePriority, 'exclude'>,
  now: string,
): CustomPoi {
  return CustomPoiSchema.parse({
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    id: `custom-amap-${safeId(candidate.providerPlaceId)}-${Date.parse(now).toString(36)}`,
    name: candidate.name,
    alias: '',
    address: candidate.address,
    location: candidate.location,
    category: candidate.category,
    iconId: `placeholder-${candidate.category}`,
    color: '#14a9a3',
    priority,
    recommendedDate: null,
    arrivalTime: null,
    durationMinutes: 90,
    openingHours: '',
    estimatedCost: null,
    notes: `来自${candidate.provider === 'amap-js' ? '运行时高德搜索' : '青岛离线候选库'}，待人工核验。`,
    detail: '搜索结果只提供名称、地址、坐标和类型，不自动生成开放时间、票价或推荐结论。',
    reservation: '',
    reminders: [],
    sourceUrls: [
      `https://ditu.amap.com/search?query=${encodeURIComponent(candidate.name)}`,
    ],
    participatesInPlanning: true,
    locked: false,
    planB: false,
  });
}

export function markerStyleFromForm(form: FormData, now: string): MarkerStyle {
  const iconId = required(form, 'iconId');
  const color = required(form, 'color');
  return MarkerStyleSchema.parse({
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    id: `marker-${safeId(iconId)}-${color.slice(1)}`,
    iconId,
    color,
    numberingMode: 'per-day',
    startNumber: 1,
    customNumber: null,
    scaleWithMap: true,
    clusterShowsCount: true,
    state: 'pending',
  });
}

export function routeStyleFromForm(form: FormData, now: string): RouteStyle {
  const color = required(form, 'color');
  const pattern = required(form, 'pattern');
  return RouteStyleSchema.parse({
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    id: `route-${color.slice(1)}-${safeId(pattern)}`,
    color,
    width: Number(required(form, 'width')),
    opacity: Number(required(form, 'opacity')),
    pattern,
    arrowsVisible: checked(form, 'arrowsVisible'),
    arrowDirection: required(form, 'arrowDirection'),
    arrowSize: Number(required(form, 'arrowSize')),
    arrowSpacing: Number(required(form, 'arrowSpacing')),
    startMarkerStyleId: null,
    endMarkerStyleId: null,
    zIndex: Number(required(form, 'zIndex')),
    visible: checked(form, 'visible'),
    scope: required(form, 'scope'),
  });
}

export function numberingFromForm(
  form: FormData,
  now: string,
  previous?: MarkerNumberingSettings,
): MarkerNumberingSettings {
  const customNumbers = { ...(previous?.customNumbers ?? {}) };
  for (const [name, rawValue] of form.entries()) {
    if (!name.startsWith('customNumber:')) continue;
    const itemId = name.slice('customNumber:'.length);
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (value) customNumbers[itemId] = value;
    else delete customNumbers[itemId];
  }
  return MarkerNumberingSettingsSchema.parse({
    schemaVersion: 1,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    mode: required(form, 'mode'),
    startNumber: Number(required(form, 'startNumber')),
    customNumbers,
  });
}
