import type { TripMapRenderModel } from '@qingdao/map-core';
import type { PlannerHistoryState } from '@qingdao/planner';
import type { Place, TripPlan } from '@qingdao/schema';

import type { RequestFormState } from './request.js';

export interface AppStatus {
  readonly tone: 'info' | 'success' | 'warning' | 'error';
  readonly message: string;
}

export interface AppState {
  readonly allPlaces: readonly Place[];
  readonly form: RequestFormState;
  readonly plan: TripPlan | null;
  readonly map: TripMapRenderModel | null;
  readonly selectedItemId: string | null;
  readonly history: PlannerHistoryState;
  readonly status: AppStatus;
  readonly persistedUpdatedAt: string | null;
  readonly busy: boolean;
}
