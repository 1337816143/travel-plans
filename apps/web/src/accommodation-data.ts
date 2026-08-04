import {
  AccommodationAreaCandidateSchema,
  type AccommodationAreaCandidate,
  type Place,
} from '@qingdao/schema';

const DEFINITIONS = [
  {
    id: 'stay-old-city',
    name: '老城／中山路区域',
    districtLabel: '市南老城',
    anchorPlaceId: 'rent-zone',
    description: '适合老城、栈桥、信号山及铁路抵离占比较高的行程。',
    strengths: ['老城步行串联更集中', '靠近既有老城点位'],
    tradeoffs: ['前往东部城区及崂山方向距离更长'],
  },
  {
    id: 'stay-central-east',
    name: '五四广场／浮山所区域',
    districtLabel: '市南东部城区',
    anchorPlaceId: 'hotel-zone',
    description: '适合东西城区混合日程及夜间返回需求。',
    strengths: ['现有计划中的中心住宿锚点', '东岸与老城之间相对折中'],
    tradeoffs: ['不是所有日期的最短距离选择'],
  },
  {
    id: 'stay-east-coast',
    name: '石老人／东海岸区域',
    districtLabel: '崂山西部与东海岸',
    anchorPlaceId: 'shilaoren',
    description: '适合东海岸、石老人和崂山方向权重较高的计划。',
    strengths: ['东部海岸点位距离更近', '适合东部连续日程'],
    tradeoffs: ['老城与黄岛往返成本更高'],
  },
] as const;

export function accommodationCandidates(
  places: readonly Place[],
  now: string,
): AccommodationAreaCandidate[] {
  return DEFINITIONS.map((definition) => {
    const anchor = places.find((place) => place.id === definition.anchorPlaceId);
    if (!anchor) throw new Error(`住宿区域锚点不存在：${definition.anchorPlaceId}`);
    return AccommodationAreaCandidateSchema.parse({
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      id: definition.id,
      name: definition.name,
      districtLabel: definition.districtLabel,
      center: anchor.location,
      description: definition.description,
      strengths: definition.strengths,
      tradeoffs: definition.tradeoffs,
      sourceRefIds: anchor.sourceRefs.map((source) => source.id),
    });
  });
}
