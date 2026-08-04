import type { TripMapRenderModel } from '@qingdao/map-core';
import type { PlannerHistoryState } from '@qingdao/planner';
import type { Place, PlaceSearchCandidate, StoredPlanCollection, TripPlan } from '@qingdao/schema';

import type { RequestFormState } from './request.js';

export interface AppStatus {
  readonly tone: 'info' | 'success' | 'warning' | 'error';
  readonly message: string;
}

export interface AppState {
  readonly workspace: 'guide' | 'planner';
  readonly allPlaces: readonly Place[];
  readonly form: RequestFormState;
  readonly plan: TripPlan | null;
  readonly map: TripMapRenderModel | null;
  readonly selectedItemId: string | null;
  readonly selectedItemIds: readonly string[];
  readonly history: PlannerHistoryState;
  readonly collection: StoredPlanCollection | null;
  readonly search: {
    readonly query: string;
    readonly candidates: readonly PlaceSearchCandidate[];
    readonly message: string;
    readonly provider: 'amap-js' | 'qingdao-curated-offline' | null;
  };
  readonly toolDayId: string | null;
  readonly status: AppStatus;
  readonly persistedUpdatedAt: string | null;
  readonly busy: boolean;
}
