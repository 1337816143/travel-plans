import {
  AccommodationAnalysisSchema,
  AccommodationAreaCandidateSchema,
  PlaceSchema,
  TripPlanSchema,
  type AccommodationAnalysis,
  type AccommodationAreaCandidate,
  type Place,
  type TripPlan,
} from '@qingdao/schema';

import { PlannerRunContextSchema } from './assumptions.js';
import { appendAuditEntry, createEditCommand, type PlannerEditResult } from './edit-result.js';
import { straightLineDistanceMeters } from './geography.js';
import { stableId } from './schedule.js';

function priorityWeight(plan: TripPlan, placeId: string): number {
  const priority = plan.request.selections.find(
    (selection) => selection.placeId === placeId,
  )?.priority;
  if (priority === 'must') return 3;
  if (priority === 'want') return 2;
  return 1;
}

function weightedDistance(
  plan: TripPlan,
  places: ReadonlyMap<string, Place>,
  area: AccommodationAreaCandidate,
): number {
  const scheduled = plan.days.flatMap((day) =>
    day.items.flatMap((item) => {
      const place = item.placeId ? places.get(item.placeId) : undefined;
      return place ? [{ place, weight: priorityWeight(plan, place.id) }] : [];
    }),
  );
  const totalWeight = scheduled.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) return 0;
  return scheduled.reduce(
    (sum, entry) => sum + straightLineDistanceMeters(area.center, entry.place.location) * entry.weight,
    0,
  ) / totalWeight;
}

function scheduledSpread(plan: TripPlan, places: ReadonlyMap<string, Place>): number {
  const locations = plan.days.flatMap((day) =>
    day.items.flatMap((item) => {
      const place = item.placeId ? places.get(item.placeId) : undefined;
      return place ? [place.location] : [];
    }),
  );
  let maximum = 0;
  locations.forEach((left, leftIndex) => {
    locations.slice(leftIndex + 1).forEach((right) => {
      maximum = Math.max(maximum, straightLineDistanceMeters(left, right));
    });
  });
  return maximum;
}

export function analyzeAccommodationAreas(input: {
  readonly plan: unknown;
  readonly places: readonly unknown[];
  readonly candidates: readonly unknown[];
  readonly commandId: string;
  readonly context: unknown;
}): PlannerEditResult & { readonly analysis: AccommodationAnalysis } {
  const plan = TripPlanSchema.parse(input.plan);
  const places = input.places.map((place) => PlaceSchema.parse(place));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const candidates = input.candidates.map((candidate) =>
    AccommodationAreaCandidateSchema.parse(candidate),
  );
  if (candidates.length === 0) throw new Error('住宿分析至少需要一个候选区域。');
  const context = PlannerRunContextSchema.parse(input.context);
  const rawScores = candidates.map((candidate) => {
    const distance = weightedDistance(plan, placeById, candidate);
    const arrivalDeparturePenalty =
      (plan.request.arrival.hubPlaceId === null ? 0 : 0.4) +
      (plan.request.departure.hubPlaceId === null ? 0 : 0.4);
    const splitStayPenalty = plan.request.accommodation.allowSplitStay ? 0 : 0.25;
    return {
      areaId: candidate.id,
      weightedStraightLineMeters: Math.round(distance),
      arrivalDeparturePenalty,
      splitStayPenalty,
      score: Number((distance / 1000 + arrivalDeparturePenalty + splitStayPenalty).toFixed(3)),
    };
  });
  const ordered = [...rawScores].sort(
    (left, right) => left.score - right.score || left.areaId.localeCompare(right.areaId),
  );
  const scores = rawScores.map((score) => ({
    ...score,
    rank: ordered.findIndex((candidate) => candidate.areaId === score.areaId) + 1,
    confidence: 0.45,
    explanation:
      '按当前日程地点优先级计算加权直线距离，仅用于住宿区域初筛；不等同于真实道路时间、夜间返程或酒店价格。',
  }));
  const leadingCandidateAreaId = ordered[0]?.areaId;
  if (!leadingCandidateAreaId) throw new Error('住宿分析没有产生有效结果。');
  const spread = scheduledSpread(plan, placeById);
  const analysis = AccommodationAnalysisSchema.parse({
    schemaVersion: 1,
    createdAt: context.now,
    updatedAt: context.now,
    planId: plan.id,
    method: 'weighted-straight-line-area-comparison',
    estimated: true,
    candidates,
    scores,
    leadingCandidateAreaId,
    singleStayPreliminary: spread < 25_000 || plan.days.length <= 3,
    warnings: [
      '当前没有经过核验的实时酒店价格、评分、库存或退改数据，因此结果只是区域初筛，不能作为正式住宿推荐。',
      '评分使用 WGS84 直线距离，不显示为道路距离或真实交通时间。',
    ],
  });
  const inverseCommandId = stableId('command', `${input.commandId}-inverse`);
  const command = createEditCommand({
    id: input.commandId,
    inverseCommandId,
    type: 'analyze-accommodation',
    plan,
    targetIds: [plan.id],
    context,
    reason: '根据当前青岛日程生成可解释的住宿区域比较。',
  });
  const inverseCommand = createEditCommand({
    id: inverseCommandId,
    inverseCommandId: command.id,
    type: 'analyze-accommodation',
    plan,
    targetIds: [plan.id],
    context,
    reason: '撤销住宿区域分析并恢复此前结果。',
  });
  const leading = candidates.find((candidate) => candidate.id === leadingCandidateAreaId);
  const explanation = `住宿区域初筛完成：加权距离排序首位为“${leading?.name ?? leadingCandidateAreaId}”；这不是正式住宿推荐，结果明确标记为直线距离估算。`;
  const next = TripPlanSchema.parse({
    ...plan,
    updatedAt: context.now,
    accommodationAnalysis: analysis,
    editHistory: appendAuditEntry(plan, command, explanation, context.now),
  });
  return { plan: next, command, inverseCommand, explanation, focusItemId: null, analysis };
}
