import { classifyQingdaoPlace } from '@qingdao/content';
import {
  PlaceSchema,
  migrateLegacyV2RuntimePointBundle,
  type Place,
  type PlacePriority,
} from '@qingdao/schema';

import legacyRuntimePoints from '../../../data/qingdao/places/imports/legacy-v2.5.4-runtime-points.v1.json' with { type: 'json' };
import curatedSignal from '../../../data/qingdao/places/signal-hill-west-gate.v1.json' with { type: 'json' };

export const LEGACY_IMPORT_NOW = '2026-08-01T00:00:00+08:00';

export interface DemoPlaceOption {
  readonly id: string;
  readonly eyebrow: string;
  readonly shortName: string;
  readonly summary: string;
  readonly accent: 'coral' | 'cyan' | 'gold' | 'navy';
  readonly defaultPriority: PlacePriority;
}

export const DEMO_PLACE_OPTIONS: readonly DemoPlaceOption[] = [
  {
    id: 'signal',
    eyebrow: '老城制高点',
    shortName: '信号山',
    summary: '红瓦老城与海岸线的俯瞰起点',
    accent: 'coral',
    defaultPriority: 'must',
  },
  {
    id: 'zhanqiao',
    eyebrow: '百年地标',
    shortName: '栈桥',
    summary: '从老城走向海面的经典第一站',
    accent: 'cyan',
    defaultPriority: 'must',
  },
  {
    id: 'xiaoyushan',
    eyebrow: '山海摄影',
    shortName: '小鱼山',
    summary: '低强度登高，串联福山支路街区',
    accent: 'gold',
    defaultPriority: 'want',
  },
  {
    id: 'qinyu',
    eyebrow: '海岸漫步',
    shortName: '琴屿路',
    summary: '礁石、长椅与小青岛方向的慢行段',
    accent: 'navy',
    defaultPriority: 'want',
  },
  {
    id: 'beer',
    eyebrow: '城市文化',
    shortName: '啤酒博物馆',
    summary: '室内内容与台东街区的组合锚点',
    accent: 'gold',
    defaultPriority: 'want',
  },
  {
    id: 'yanerdao',
    eyebrow: '东岸步道',
    shortName: '燕儿岛山',
    summary: '傍晚海岸步道与奥帆片区衔接点',
    accent: 'cyan',
    defaultPriority: 'optional',
  },
  {
    id: 'mayfourth',
    eyebrow: '城市夜景',
    shortName: '五四广场',
    summary: '东部城区夜景与返程交通锚点',
    accent: 'coral',
    defaultPriority: 'want',
  },
  {
    id: 'xiaoqingdao',
    eyebrow: '本次取舍',
    shortName: '小青岛',
    summary: '保留在候选库，本次默认明确排除',
    accent: 'navy',
    defaultPriority: 'exclude',
  },
] as const;

export function loadQingdaoPlaces(): Place[] {
  const imported = migrateLegacyV2RuntimePointBundle(legacyRuntimePoints, {
    now: LEGACY_IMPORT_NOW,
  }).places;
  const signal = PlaceSchema.parse(curatedSignal);
  return imported.map((place) => classifyQingdaoPlace(place.id === signal.id ? signal : place));
}

export function demoPlaces(allPlaces: readonly Place[]): Place[] {
  const ids = new Set(DEMO_PLACE_OPTIONS.map((option) => option.id));
  return allPlaces.filter((place) => ids.has(place.id));
}
