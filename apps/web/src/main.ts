import { buildTripMapRenderModel } from '@qingdao/map-core';
import {
  DEFAULT_PLANNER_ASSUMPTIONS,
  PlannerEditError,
  PlannerHistoryError,
  addCustomPoiCandidate,
  addCustomPoiToDay,
  addExistingPlaceToDay,
  addItineraryModuleToDay,
  analyzeAccommodationAreas,
  createPlannerHistoryState,
  customPoiToPlace,
  deterministicAcrossDayCommandId,
  deterministicCommandId,
  generateTripPlan,
  moveItemAcrossDay,
  moveItemWithinDay,
  moveItemsToDay,
  persistPlannerHistory,
  recordPlannerEdit,
  removeItems,
  redoPlannerEdit,
  restoreRemovedItems,
  setItemsLocked,
  setItemsMarkerStyle,
  setItemsPriority,
  setMarkerNumbering,
  setRouteStyleForSegments,
  undoPlannerEdit,
  type PlannerEditResult,
} from '@qingdao/planner';
import {
  AmapJsPlaceSearchProvider,
  CuratedQingdaoSearchProvider,
  FallbackPlaceSearchProvider,
} from '@qingdao/providers';
import { PlacePrioritySchema, PlaceSearchQuerySchema, TripPlanSchema } from '@qingdao/schema';
import type { PlacePriority, PlaceSearchCandidate, TripPlan } from '@qingdao/schema';

import { accommodationCandidates } from './accommodation-data.js';
import { createRuntimeAmapSearchClient } from './amap-runtime.js';
import { DEMO_PLACE_OPTIONS, loadQingdaoPlaces } from './data.js';
import { IndexedDbPlanStorage } from './indexeddb-plan-storage.js';
import { PHASE3_ITINERARY_MODULES } from './modules.js';
import {
  customPoiFromForm,
  markerStyleFromForm,
  numberingFromForm,
  routeStyleFromForm,
  searchCandidateToCustomPoi,
} from './phase3-inputs.js';
import { buildTripRequest } from './request.js';
import './styles.css';
import type { AppState, AppStatus } from './types.js';
import { renderApp } from './view.js';

const PLANNER_VERSION = '0.4.0-phase3';
const DATA_VERSION = 'legacy-v2.5.4-review-required';

function now(): string {
  return new Date().toISOString();
}

function initialPriorities(): AppState['form']['priorities'] {
  return Object.fromEntries(
    DEMO_PLACE_OPTIONS.map((option) => [option.id, option.defaultPriority]),
  );
}

function formFromPlan(plan: TripPlan): AppState['form'] {
  return {
    startDate: plan.request.startDate,
    totalDays: plan.request.totalDays ?? plan.days.length,
    priorities: Object.fromEntries(
      plan.request.selections.map((selection) => [selection.placeId, selection.priority]),
    ),
  };
}

class QingdaoPlannerApp {
  private state: AppState;
  private draggingItemId: string | null = null;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly searchProvider: FallbackPlaceSearchProvider;
  private readonly storage = new IndexedDbPlanStorage({
    now,
    appVersion: PLANNER_VERSION,
    dataVersion: DATA_VERSION,
  });

  constructor(private readonly root: HTMLElement) {
    const allPlaces = loadQingdaoPlaces();
    this.searchProvider = new FallbackPlaceSearchProvider(
      new AmapJsPlaceSearchProvider(createRuntimeAmapSearchClient()),
      new CuratedQingdaoSearchProvider(allPlaces),
    );
    this.state = {
      allPlaces,
      form: {
        startDate: '2026-08-10',
        totalDays: 2,
        priorities: initialPriorities(),
      },
      plan: null,
      map: null,
      selectedItemId: null,
      selectedItemIds: [],
      history: createPlannerHistoryState(),
      collection: null,
      search: { query: '', candidates: [], message: '', provider: null },
      toolDayId: null,
      status: { tone: 'info', message: '正在准备青岛点位与 Planner…' },
      persistedUpdatedAt: null,
      busy: false,
    };
    this.bindEvents();
    this.render();
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    const result = await this.storage.loadCollection();
    if (result.ok) {
      this.state = { ...this.state, collection: result.value };
      const plan =
        result.value.plans.find((candidate) => candidate.id === result.value.activePlanId) ??
        result.value.plans.find((candidate) => !result.value.deletedPlanIds.includes(candidate.id));
      if (plan) {
        await this.loadPlan(plan.id, '已恢复上次打开的计划及 Undo/Redo 历史。');
        return;
      }
    }
    this.generate();
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const mapMarker = target.closest<SVGGElement>('[data-map-item]');
      if (mapMarker) {
        this.selectItem(mapMarker.dataset.mapItem ?? null, true);
        return;
      }
      const actionTarget = target.closest<HTMLElement>('[data-action]');
      if (!actionTarget) return;
      const action = actionTarget.dataset.action;
      void this.handleAction(action, actionTarget);
    });

    this.root.addEventListener('change', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.matches('[data-import-file]')) {
        void this.importFile(target.files?.[0] ?? null);
        return;
      }
      if (target instanceof HTMLInputElement && target.dataset.batchItem) {
        const selected = new Set(this.state.selectedItemIds);
        if (target.checked) selected.add(target.dataset.batchItem);
        else selected.delete(target.dataset.batchItem);
        this.state = { ...this.state, selectedItemIds: [...selected] };
        this.render();
        return;
      }
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      if (target.dataset.field === 'search-query') {
        this.state = {
          ...this.state,
          search: { ...this.state.search, query: target.value },
        };
        return;
      }
      if (target.dataset.field === 'tool-day') {
        this.state = { ...this.state, toolDayId: target.value };
        this.render();
        return;
      }
      if (target.dataset.field === 'start-date') {
        this.state = {
          ...this.state,
          form: { ...this.state.form, startDate: target.value },
          status: { tone: 'info', message: '出发日期已修改；点击“重新生成”应用设置。' },
        };
        this.render();
        return;
      }
      if (target.dataset.field === 'total-days') {
        this.state = {
          ...this.state,
          form: { ...this.state.form, totalDays: Number(target.value) },
          status: { tone: 'info', message: '旅行天数已修改；点击“重新生成”应用设置。' },
        };
        this.render();
        return;
      }
      const placeId = target.dataset.priorityPlace;
      if (placeId) {
        const priority = PlacePrioritySchema.parse(target.value);
        this.state = {
          ...this.state,
          form: {
            ...this.state.form,
            priorities: { ...this.state.form.priorities, [placeId]: priority },
          },
          status: { tone: 'info', message: '地点优先级已修改；点击“重新生成”应用设置。' },
        };
        this.render();
      }
    });

    this.root.addEventListener('dragstart', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const item = target.closest<HTMLElement>('[data-plan-item][draggable="true"]');
      if (!item) return;
      this.draggingItemId = item.dataset.planItem ?? null;
      item.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this.draggingItemId ?? '');
      }
    });

    this.root.addEventListener('dragend', () => {
      this.draggingItemId = null;
      this.root.querySelectorAll('.is-dragging').forEach((element) => {
        element.classList.remove('is-dragging');
      });
    });

    this.root.addEventListener('dragover', (event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-place-index], [data-day-drop-index]')
      ) {
        event.preventDefault();
      }
    });

    this.root.addEventListener('drop', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const destination = target.closest<HTMLElement>(
        '[data-place-index], [data-day-drop-index]',
      );
      if (!destination || !this.draggingItemId) return;
      event.preventDefault();
      const targetIndex = Number(
        destination.dataset.placeIndex ?? destination.dataset.dayDropIndex,
      );
      this.moveItem(this.draggingItemId, targetIndex, destination.dataset.dayId ?? null);
      this.draggingItemId = null;
    });

    this.root.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const marker = target.closest<SVGGElement>('[data-map-item]');
      if (marker && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.selectItem(marker.dataset.mapItem ?? null, true);
      }
      if (
        target instanceof HTMLInputElement &&
        target.dataset.field === 'search-query' &&
        event.key === 'Enter'
      ) {
        event.preventDefault();
        void this.searchPlaces();
      }
    });
  }

  private async handleAction(action: string | undefined, target: HTMLElement): Promise<void> {
    switch (action) {
      case 'generate':
        this.generate();
        break;
      case 'select-item':
        this.selectItem(target.dataset.itemId ?? null, false);
        break;
      case 'move-up':
        this.moveByOffset(target.dataset.itemId ?? null, -1);
        break;
      case 'move-down':
        this.moveByOffset(target.dataset.itemId ?? null, 1);
        break;
      case 'move-day-previous':
        this.moveToAdjacentDay(target.dataset.itemId ?? null, -1);
        break;
      case 'move-day-next':
        this.moveToAdjacentDay(target.dataset.itemId ?? null, 1);
        break;
      case 'undo':
        this.applyHistoryAction('undo');
        break;
      case 'redo':
        this.applyHistoryAction('redo');
        break;
      case 'save':
        await this.saveCurrent(true);
        break;
      case 'load':
        await this.loadLatest();
        break;
      case 'export':
        await this.exportPlan();
        break;
      case 'import':
        this.root.querySelector<HTMLInputElement>('[data-import-file]')?.click();
        break;
      case 'share':
        await this.sharePlan();
        break;
      case 'print':
        window.print();
        break;
      case 'search-place':
        await this.searchPlaces();
        break;
      case 'add-search-result':
        this.addSearchResult(
          target.dataset.candidateId ?? '',
          PlacePrioritySchema.exclude(['exclude']).parse(target.dataset.priority),
        );
        break;
      case 'create-custom-poi':
        this.createCustomPoi();
        break;
      case 'apply-module':
        this.applyModule(target.dataset.moduleId ?? '');
        break;
      case 'select-all-items':
        this.selectAllItems();
        break;
      case 'clear-selection':
        this.state = { ...this.state, selectedItemIds: [] };
        this.render();
        break;
      case 'batch-lock':
        this.setBatchLocked(true);
        break;
      case 'batch-unlock':
        this.setBatchLocked(false);
        break;
      case 'batch-move':
        this.batchMove();
        break;
      case 'batch-priority':
        this.setBatchPriority();
        break;
      case 'batch-disable':
        this.batchRemove('disabled');
        break;
      case 'batch-delete':
        this.batchRemove('deleted');
        break;
      case 'restore-removed':
        this.restoreRemoved(target.dataset.removedId ?? '');
        break;
      case 'apply-marker-style':
        this.applyMarkerStyle();
        break;
      case 'apply-numbering':
        this.applyNumbering();
        break;
      case 'apply-route-style':
        this.applyRouteStyle();
        break;
      case 'analyze-accommodation':
        this.analyzeAccommodation();
        break;
      case 'new-plan':
        this.generate(true);
        break;
      case 'duplicate-plan':
        await this.duplicatePlan();
        break;
      case 'rename-plan':
        await this.renamePlan();
        break;
      case 'snapshot-plan':
        await this.snapshotPlan();
        break;
      case 'archive-plan':
        await this.archivePlan();
        break;
      case 'unarchive-plan':
        await this.unarchivePlan(target.dataset.planId ?? '');
        break;
      case 'delete-plan':
        await this.deletePlan();
        break;
      case 'recover-plan':
        await this.recoverPlan(target.dataset.planId ?? '');
        break;
      case 'load-plan':
        await this.loadPlan(target.dataset.planId ?? '');
        break;
      case 'restore-snapshot':
        await this.restoreSnapshot(target.dataset.snapshotId ?? '');
        break;
      case 'show-warnings':
        this.setStatus({
          tone: 'warning',
          message:
            this.state.plan?.estimationNotes[0] ?? '当前没有估算说明；真实 Provider 接入后会保留查询时间与来源。',
        });
        break;
      default:
        break;
    }
  }

  private generate(createNewPlan = false): void {
    const active = Object.values(this.state.form.priorities).filter(
      (priority) => priority !== 'exclude',
    ).length;
    if (active === 0) {
      this.setStatus({ tone: 'error', message: '至少保留一个地点，才能生成青岛日程。' });
      return;
    }
    try {
      const runAt = now();
      const requestId = createNewPlan
        ? `qingdao-phase3-request-${Date.parse(runAt).toString(36)}`
        : this.state.plan?.request.id;
      const request = buildTripRequest(this.state.form, runAt, requestId);
      const generated = generateTripPlan({
        places: this.state.allPlaces,
        request,
        context: {
          now: runAt,
          plannerVersion: PLANNER_VERSION,
          dataVersion: DATA_VERSION,
          assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
        },
      });
      const plan = TripPlanSchema.parse({
        ...generated,
        name: createNewPlan ? generated.name : (this.state.plan?.name ?? generated.name),
      });
      const map = buildTripMapRenderModel({ plan, places: this.state.allPlaces });
      this.state = {
        ...this.state,
        plan,
        map,
        selectedItemId: map.markers[0]?.itemId ?? null,
        selectedItemIds: [],
        history: createPlannerHistoryState(),
        toolDayId: plan.days[0]?.id ?? null,
        persistedUpdatedAt: createNewPlan ? null : this.state.persistedUpdatedAt,
        status: {
          tone: 'success',
          message: `已生成 ${plan.days.length} 天计划；午休、排除项和 ${plan.conflicts.length} 条估算边界均已保留。`,
        },
      };
      this.render();
      this.scheduleAutoSave();
    } catch (error) {
      this.setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Planner 生成失败。',
      });
    }
  }

  private moveByOffset(itemId: string | null, offset: number): void {
    if (!itemId || !this.state.plan) return;
    const day = this.state.plan.days.find((candidate) =>
      candidate.items.some((item) => item.id === itemId),
    );
    if (!day) return;
    const places = day.items.filter((item) => item.kind === 'place');
    const index = places.findIndex((item) => item.id === itemId);
    this.moveItem(itemId, index + offset, day.id);
  }

  private moveToAdjacentDay(itemId: string | null, offset: number): void {
    const plan = this.state.plan;
    if (!itemId || !plan) return;
    const sourceIndex = plan.days.findIndex((day) =>
      day.items.some((item) => item.id === itemId),
    );
    const targetDay = plan.days[sourceIndex + offset];
    if (sourceIndex < 0 || !targetDay) return;
    const targetIndex = targetDay.items.filter((item) => item.kind === 'place').length;
    this.moveItem(itemId, targetIndex, targetDay.id);
  }

  private moveItem(itemId: string, targetIndex: number, targetDayId: string | null): void {
    const plan = this.state.plan;
    if (!plan) return;
    const day = plan.days.find((candidate) => candidate.items.some((item) => item.id === itemId));
    const targetDay = plan.days.find((candidate) => candidate.id === targetDayId);
    if (!day || !targetDay) return;
    const count = targetDay.items.filter((item) => item.kind === 'place').length;
    const withinDay = targetDay.id === day.id;
    if (targetIndex < 0 || targetIndex > count) return;
    const normalizedTargetIndex = withinDay && targetIndex === count ? count - 1 : targetIndex;
    if (normalizedTargetIndex < 0) return;
    try {
      const appliedAt = now();
      const context = this.plannerContext(appliedAt);
      const result = withinDay
        ? moveItemWithinDay({
            plan,
            places: [...this.state.allPlaces],
            dayId: day.id,
            itemId,
            toPlaceIndex: normalizedTargetIndex,
            commandId: deterministicCommandId(plan, itemId, normalizedTargetIndex),
            context,
          })
        : moveItemAcrossDay({
            plan,
            places: [...this.state.allPlaces],
            fromDayId: day.id,
            toDayId: targetDay.id,
            itemId,
            toPlaceIndex: normalizedTargetIndex,
            commandId: deterministicAcrossDayCommandId(
              plan,
              itemId,
              targetDay.id,
              normalizedTargetIndex,
            ),
            context,
          });
      this.applyPlannerResult(plan, result);
    } catch (error) {
      this.setStatus({
        tone: error instanceof PlannerEditError ? 'warning' : 'error',
        message: error instanceof Error ? error.message : '日程移动失败。',
      });
    }
  }

  private applyPlannerResult(before: TripPlan, result: PlannerEditResult): void {
    const map = buildTripMapRenderModel({ plan: result.plan, places: this.state.allPlaces });
    const selectedPlaceIds = new Set(
      before.days.flatMap((day) =>
        day.items.flatMap((item) =>
          this.state.selectedItemIds.includes(item.id) && item.placeId ? [item.placeId] : [],
        ),
      ),
    );
    const selectedItemIds = result.plan.days.flatMap((day) =>
      day.items.flatMap((item) =>
        item.placeId && selectedPlaceIds.has(item.placeId) ? [item.id] : [],
      ),
    );
    this.state = {
      ...this.state,
      plan: result.plan,
      form: formFromPlan(result.plan),
      map,
      selectedItemId: result.focusItemId,
      selectedItemIds,
      history: recordPlannerEdit(this.state.history, before, result),
      status: { tone: 'success', message: result.explanation },
    };
    this.render();
    this.scheduleAutoSave();
  }

  private applyHistoryAction(action: 'undo' | 'redo'): void {
    const plan = this.state.plan;
    if (!plan) return;
    const selectedPlaceId = plan.days
      .flatMap((day) => day.items)
      .find((item) => item.id === this.state.selectedItemId)?.placeId;
    const selectedPlaceIds = new Set(
      plan.days.flatMap((day) =>
        day.items.flatMap((item) =>
          this.state.selectedItemIds.includes(item.id) && item.placeId ? [item.placeId] : [],
        ),
      ),
    );
    try {
      const context = this.plannerContext(now());
      const result =
        action === 'undo'
          ? undoPlannerEdit({ plan, history: this.state.history, context })
          : redoPlannerEdit({ plan, history: this.state.history, context });
      const selectedItemId = selectedPlaceId
        ? (result.plan.days
            .flatMap((day) => day.items)
            .find((item) => item.placeId === selectedPlaceId)?.id ?? null)
        : null;
      this.state = {
        ...this.state,
        plan: result.plan,
        form: formFromPlan(result.plan),
        map: buildTripMapRenderModel({ plan: result.plan, places: this.state.allPlaces }),
        selectedItemId,
        selectedItemIds: result.plan.days.flatMap((day) =>
          day.items.flatMap((item) =>
            item.placeId && selectedPlaceIds.has(item.placeId) ? [item.id] : [],
          ),
        ),
        history: result.history,
        status: { tone: 'success', message: result.explanation },
      };
      this.render();
      this.scheduleAutoSave();
    } catch (error) {
      this.setStatus({
        tone: error instanceof PlannerHistoryError ? 'warning' : 'error',
        message: error instanceof Error ? error.message : '操作历史恢复失败。',
      });
    }
  }

  private plannerContext(appliedAt: string): {
    readonly now: string;
    readonly plannerVersion: string;
    readonly dataVersion: string;
    readonly assumptions: typeof DEFAULT_PLANNER_ASSUMPTIONS;
  } {
    return {
      now: appliedAt,
      plannerVersion: PLANNER_VERSION,
      dataVersion: DATA_VERSION,
      assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
    };
  }

  private commandId(prefix: string): string {
    const count = this.state.plan?.editHistory.length ?? 0;
    return `${prefix}-${Date.now().toString(36)}-${count}`;
  }

  private currentToolDayId(): string {
    const plan = this.state.plan;
    if (!plan) throw new Error('当前没有可编辑计划。');
    return this.state.toolDayId ?? plan.days[0]?.id ?? '';
  }

  private formData(selector: string): FormData {
    const form = this.root.querySelector<HTMLFormElement>(selector);
    if (!form) throw new Error(`编辑表单不存在：${selector}`);
    return new FormData(form);
  }

  private runPlannerEdit(action: () => PlannerEditResult): void {
    const before = this.state.plan;
    if (!before) return;
    try {
      this.applyPlannerResult(before, action());
    } catch (error) {
      this.setStatus({
        tone: 'warning',
        message: error instanceof Error ? error.message : '编辑操作失败。',
      });
    }
  }

  private async searchPlaces(): Promise<void> {
    const keyword =
      this.root.querySelector<HTMLInputElement>('[data-field="search-query"]')?.value.trim() ??
      this.state.search.query.trim();
    if (!keyword) {
      this.setStatus({ tone: 'warning', message: '请先输入青岛地点名称。' });
      return;
    }
    const queriedAt = now();
    this.setBusy(true, '正在通过 PlaceSearchProvider 搜索…');
    const result = await this.searchProvider.search(
      PlaceSearchQuerySchema.parse({
        schemaVersion: 1,
        createdAt: queriedAt,
        updatedAt: queriedAt,
        id: `search-${Date.parse(queriedAt).toString(36)}`,
        keyword,
        city: '青岛',
        center: null,
        limit: 8,
      }),
    );
    if (!result.ok) {
      this.state = {
        ...this.state,
        busy: false,
        search: { ...this.state.search, candidates: [], message: result.error.message, provider: null },
        status: { tone: 'error', message: result.error.message },
      };
      this.render();
      return;
    }
    this.state = {
      ...this.state,
      busy: false,
      search: {
        query: keyword,
        candidates: result.data.candidates,
        message: result.data.message,
        provider: result.data.provider,
      },
      status: {
        tone: result.data.degraded ? 'warning' : 'success',
        message: `找到 ${result.data.candidates.length} 个结果。${result.data.message}`,
      },
    };
    this.render();
  }

  private addSearchResult(
    candidateId: string,
    priority: Exclude<PlacePriority, 'exclude'>,
  ): void {
    const plan = this.state.plan;
    const candidate: PlaceSearchCandidate | undefined = this.state.search.candidates.find(
      (entry) => entry.id === candidateId,
    );
    if (!plan || !candidate) return;
    const appliedAt = now();
    const dayId = this.currentToolDayId();
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) return;
    const index = day.items.filter((item) => item.kind === 'place').length;
    if (candidate.provider === 'qingdao-curated-offline') {
      this.runPlannerEdit(() =>
        addExistingPlaceToDay({
          plan,
          places: this.state.allPlaces,
          placeId: candidate.providerPlaceId,
          dayId,
          toPlaceIndex: index,
          priority,
          notes: '通过青岛离线候选搜索加入。',
          commandId: this.commandId('search-add'),
          context: this.plannerContext(appliedAt),
        }),
      );
      return;
    }
    try {
      const customPoi = searchCandidateToCustomPoi(candidate, priority, appliedAt);
      const added = addCustomPoiToDay({
        plan,
        places: this.state.allPlaces,
        customPoi,
        dayId,
        toPlaceIndex: index,
        commandId: this.commandId('amap-add'),
        context: this.plannerContext(appliedAt),
      });
      this.state = {
        ...this.state,
        allPlaces: [
          ...this.state.allPlaces.filter((place) => place.id !== added.place.id),
          added.place,
        ],
      };
      this.applyPlannerResult(plan, added.result);
    } catch (error) {
      this.setStatus({ tone: 'warning', message: error instanceof Error ? error.message : '加入搜索地点失败。' });
    }
  }

  private createCustomPoi(): void {
    const plan = this.state.plan;
    if (!plan) return;
    try {
      const appliedAt = now();
      const customPoi = customPoiFromForm(this.formData('[data-custom-poi-form]'), appliedAt);
      const dayId = this.currentToolDayId();
      const day = plan.days.find((entry) => entry.id === dayId);
      if (!day) throw new Error('找不到目标日期。');
      const added = customPoi.participatesInPlanning && customPoi.priority !== 'exclude'
        ? addCustomPoiToDay({
            plan,
            places: this.state.allPlaces,
            customPoi,
            dayId,
            toPlaceIndex: day.items.filter((item) => item.kind === 'place').length,
            commandId: this.commandId('custom-add'),
            context: this.plannerContext(appliedAt),
          })
        : addCustomPoiCandidate({
            plan,
            customPoi,
            commandId: this.commandId('custom-candidate'),
            context: this.plannerContext(appliedAt),
          });
      this.state = {
        ...this.state,
        allPlaces: [
          ...this.state.allPlaces.filter((place) => place.id !== added.place.id),
          added.place,
        ],
      };
      this.applyPlannerResult(plan, added.result);
    } catch (error) {
      this.setStatus({ tone: 'warning', message: error instanceof Error ? error.message : '自定义地点创建失败。' });
    }
  }

  private applyModule(moduleId: string): void {
    const plan = this.state.plan;
    const module = PHASE3_ITINERARY_MODULES.find((entry) => entry.id === moduleId);
    if (!plan || !module) return;
    const appliedAt = now();
    this.runPlannerEdit(() =>
      addItineraryModuleToDay({
        plan,
        places: this.state.allPlaces,
        moduleId: module.id,
        moduleName: module.name,
        placeIds: module.placeIds,
        dayId: this.currentToolDayId(),
        commandId: this.commandId('module-add'),
        context: this.plannerContext(appliedAt),
      }),
    );
  }

  private selectAllItems(): void {
    this.state = {
      ...this.state,
      selectedItemIds:
        this.state.plan?.days.flatMap((day) =>
          day.items.filter((item) => item.kind === 'place').map((item) => item.id),
        ) ?? [],
    };
    this.render();
  }

  private setBatchLocked(locked: boolean): void {
    const plan = this.state.plan;
    if (!plan) return;
    const appliedAt = now();
    this.runPlannerEdit(() =>
      setItemsLocked({
        plan,
        itemIds: this.state.selectedItemIds,
        locked,
        commandId: this.commandId(locked ? 'batch-lock' : 'batch-unlock'),
        context: this.plannerContext(appliedAt),
      }),
    );
  }

  private batchMove(): void {
    const plan = this.state.plan;
    if (!plan) return;
    const appliedAt = now();
    this.runPlannerEdit(() =>
      moveItemsToDay({
        plan,
        places: this.state.allPlaces,
        itemIds: this.state.selectedItemIds,
        toDayId: this.currentToolDayId(),
        commandId: this.commandId('batch-move'),
        context: this.plannerContext(appliedAt),
      }),
    );
  }

  private setBatchPriority(): void {
    const plan = this.state.plan;
    if (!plan) return;
    try {
      const form = this.formData('[data-batch-priority-form]');
      const priority = PlacePrioritySchema.exclude(['exclude']).parse(form.get('priority'));
      const appliedAt = now();
      this.runPlannerEdit(() =>
        setItemsPriority({
          plan,
          itemIds: this.state.selectedItemIds,
          priority,
          commandId: this.commandId('batch-priority'),
          context: this.plannerContext(appliedAt),
        }),
      );
    } catch (error) {
      this.setStatus({
        tone: 'warning',
        message: error instanceof Error ? error.message : '批量优先级设置失败。',
      });
    }
  }

  private batchRemove(mode: 'disabled' | 'deleted'): void {
    const plan = this.state.plan;
    if (!plan) return;
    const appliedAt = now();
    this.runPlannerEdit(() =>
      removeItems({
        plan,
        places: this.state.allPlaces,
        itemIds: this.state.selectedItemIds,
        mode,
        commandId: this.commandId(mode === 'deleted' ? 'batch-delete' : 'batch-disable'),
        context: this.plannerContext(appliedAt),
      }),
    );
  }

  private restoreRemoved(removedId: string): void {
    const plan = this.state.plan;
    if (!plan || !removedId) return;
    const appliedAt = now();
    this.runPlannerEdit(() =>
      restoreRemovedItems({
        plan,
        places: this.state.allPlaces,
        removedItemIds: [removedId],
        commandId: this.commandId('restore'),
        context: this.plannerContext(appliedAt),
      }),
    );
  }

  private applyMarkerStyle(): void {
    const plan = this.state.plan;
    if (!plan) return;
    try {
      const appliedAt = now();
      const style = markerStyleFromForm(this.formData('[data-marker-style-form]'), appliedAt);
      this.runPlannerEdit(() =>
        setItemsMarkerStyle({
          plan,
          itemIds: this.state.selectedItemIds,
          style,
          commandId: this.commandId('marker-style'),
          context: this.plannerContext(appliedAt),
        }),
      );
    } catch (error) {
      this.setStatus({ tone: 'warning', message: error instanceof Error ? error.message : 'Logo 设置失败。' });
    }
  }

  private applyNumbering(): void {
    const plan = this.state.plan;
    if (!plan) return;
    try {
      const appliedAt = now();
      const settings = numberingFromForm(
        this.formData('[data-numbering-form]'),
        appliedAt,
        plan.markerNumbering,
      );
      this.runPlannerEdit(() =>
        setMarkerNumbering({
          plan,
          settings,
          commandId: this.commandId('numbering'),
          context: this.plannerContext(appliedAt),
        }),
      );
    } catch (error) {
      this.setStatus({ tone: 'warning', message: error instanceof Error ? error.message : '编号设置失败。' });
    }
  }

  private applyRouteStyle(): void {
    const plan = this.state.plan;
    if (!plan) return;
    try {
      const appliedAt = now();
      const style = routeStyleFromForm(this.formData('[data-route-style-form]'), appliedAt);
      const selected = new Set(this.state.selectedItemIds);
      const adjacent = plan.days.flatMap((day) => {
        const daySelected = day.items.some((item) => selected.has(item.id));
        if (style.scope === 'day' && daySelected) return day.routeSegments;
        return day.routeSegments.filter(
          (segment) => selected.has(segment.fromItemId) || selected.has(segment.toItemId),
        );
      });
      const segments = adjacent.length
        ? adjacent
        : plan.days.flatMap((day) => day.routeSegments);
      this.runPlannerEdit(() =>
        setRouteStyleForSegments({
          plan,
          segmentIds: segments.map((segment) => segment.id),
          style,
          commandId: this.commandId('route-style'),
          context: this.plannerContext(appliedAt),
        }),
      );
    } catch (error) {
      this.setStatus({ tone: 'warning', message: error instanceof Error ? error.message : '路线样式设置失败。' });
    }
  }

  private analyzeAccommodation(): void {
    const plan = this.state.plan;
    if (!plan) return;
    const appliedAt = now();
    this.runPlannerEdit(() =>
      analyzeAccommodationAreas({
        plan,
        places: this.state.allPlaces,
        candidates: accommodationCandidates(this.state.allPlaces, appliedAt),
        commandId: this.commandId('accommodation'),
        context: this.plannerContext(appliedAt),
      }),
    );
  }

  private selectItem(itemId: string | null, scroll: boolean): void {
    if (!itemId) return;
    this.state = { ...this.state, selectedItemId: itemId };
    this.render();
    if (scroll) {
      requestAnimationFrame(() => {
        this.root
          .querySelector<HTMLElement>(`[data-plan-item="${CSS.escape(itemId)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  private async saveCurrent(showStatus: boolean): Promise<boolean> {
    const plan = this.state.plan;
    if (!plan) return false;
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    if (this.state.busy) return false;
    this.setBusy(true, '正在校验并写入 IndexedDB…');
    const persistedHistory = persistPlannerHistory(plan.id, this.state.history, now());
    const result = await this.storage.saveWorkspace(plan, persistedHistory, {
      expectedUpdatedAt: this.state.persistedUpdatedAt,
    });
    if (!result.ok) {
      this.state = {
        ...this.state,
        busy: false,
        status: { tone: 'error', message: result.message },
      };
      this.render();
      return false;
    }
    this.state = {
      ...this.state,
      busy: false,
      persistedUpdatedAt: result.value.plan.updatedAt,
      status: showStatus
        ? { tone: 'success', message: '计划已通过 Schema 校验并保存到 IndexedDB。' }
        : this.state.status,
    };
    this.render();
    await this.refreshCollection(true);
    return true;
  }

  private async loadLatest(): Promise<void> {
    this.setBusy(true, '正在从 IndexedDB 载入计划…');
    const result = await this.storage.loadCollection();
    if (!result.ok) {
      this.state = { ...this.state, busy: false, status: { tone: 'error', message: result.message } };
      this.render();
      return;
    }
    const plan =
      result.value.plans.find((candidate) => candidate.id === result.value.activePlanId) ??
      result.value.plans.filter((candidate) => !result.value.deletedPlanIds.includes(candidate.id)).at(-1);
    if (!plan) {
      this.state = {
        ...this.state,
        busy: false,
        status: { tone: 'warning', message: 'IndexedDB 中还没有已保存计划。' },
      };
      this.render();
      return;
    }
    await this.loadPlan(plan.id, '已从 IndexedDB 载入最近计划。');
  }

  private scheduleAutoSave(): void {
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      if (!this.state.busy) void this.saveCurrent(false);
    }, 320);
  }

  private async refreshCollection(render = true): Promise<void> {
    const result = await this.storage.loadCollection();
    if (!result.ok) return;
    this.state = { ...this.state, collection: result.value };
    if (render) this.render();
  }

  private placesForPlan(plan: TripPlan): AppState['allPlaces'] {
    const customPlaces = plan.customPois.map((customPoi) => customPoiToPlace(customPoi));
    return [
      ...this.state.allPlaces.filter(
        (place) => !customPlaces.some((customPlace) => customPlace.id === place.id),
      ),
      ...customPlaces,
    ];
  }

  private async loadPlan(planId: string, message = '计划已载入。'): Promise<void> {
    if (!planId) return;
    this.setBusy(true, '正在载入计划及可执行历史…');
    const [planResult, historyResult] = await Promise.all([
      this.storage.getPlan(planId),
      this.storage.getPlanHistory(planId),
    ]);
    if (!planResult.ok || !historyResult.ok) {
      this.state = {
        ...this.state,
        busy: false,
        status: {
          tone: 'error',
          message: !planResult.ok ? planResult.message : historyResult.ok ? '载入失败。' : historyResult.message,
        },
      };
      this.render();
      return;
    }
    const plan = planResult.value;
    const allPlaces = this.placesForPlan(plan);
    await this.storage.setActivePlan(plan.id);
    this.state = {
      ...this.state,
      busy: false,
      allPlaces,
      plan,
      form: formFromPlan(plan),
      map: buildTripMapRenderModel({ plan, places: allPlaces }),
      selectedItemId:
        plan.days.flatMap((day) => day.items).find((item) => item.kind === 'place')?.id ?? null,
      selectedItemIds: [],
      history: createPlannerHistoryState(historyResult.value),
      toolDayId: plan.days[0]?.id ?? null,
      persistedUpdatedAt: plan.updatedAt,
      status: { tone: 'success', message },
    };
    await this.refreshCollection(false);
    this.render();
  }

  private async duplicatePlan(): Promise<void> {
    const plan = this.state.plan;
    if (!plan || !(await this.saveCurrent(false))) return;
    const operationAt = now();
    const id = `${plan.id}-copy-${Date.parse(operationAt).toString(36)}`.slice(0, 160);
    const result = await this.storage.duplicatePlan(plan.id, id, `${plan.name}（副本）`);
    if (!result.ok) {
      this.setStatus({ tone: 'error', message: result.message });
      return;
    }
    await this.loadPlan(result.value.id, '已复制为独立计划；后续编辑不会影响原计划。');
  }

  private async renamePlan(): Promise<void> {
    const plan = this.state.plan;
    if (!plan) return;
    const name = window.prompt('输入新的计划名称', plan.name)?.trim();
    if (!name || name === plan.name) return;
    const result = await this.storage.renamePlan(plan.id, name);
    if (!result.ok) {
      this.setStatus({ tone: 'error', message: result.message });
      return;
    }
    await this.loadPlan(plan.id, `计划已重命名为“${name}”。`);
  }

  private async snapshotPlan(): Promise<void> {
    const plan = this.state.plan;
    if (!plan || !(await this.saveCurrent(false))) return;
    const label = window.prompt('快照名称', `快照 ${new Date().toLocaleString('zh-CN')}`)?.trim();
    if (!label) return;
    const result = await this.storage.createSnapshot(plan.id, label);
    if (!result.ok) this.setStatus({ tone: 'error', message: result.message });
    else {
      await this.refreshCollection(false);
      this.setStatus({ tone: 'success', message: `已保存不可变快照“${label}”。` });
    }
  }

  private async archivePlan(): Promise<void> {
    const plan = this.state.plan;
    if (!plan || !(await this.saveCurrent(false))) return;
    const result = await this.storage.archivePlan(plan.id);
    if (!result.ok) this.setStatus({ tone: 'error', message: result.message });
    else {
      await this.refreshCollection(false);
      this.setStatus({ tone: 'success', message: '当前计划已归档，数据仍可恢复。' });
    }
  }

  private async unarchivePlan(planId: string): Promise<void> {
    const result = await this.storage.restorePlan(planId);
    if (!result.ok) this.setStatus({ tone: 'error', message: result.message });
    else {
      await this.refreshCollection(false);
      this.setStatus({ tone: 'success', message: '计划已从归档恢复。' });
    }
  }

  private async deletePlan(): Promise<void> {
    const plan = this.state.plan;
    if (!plan || !window.confirm(`确定删除“${plan.name}”吗？计划会进入可恢复回收区。`)) return;
    const result = await this.storage.softDeletePlan(plan.id);
    if (!result.ok) {
      this.setStatus({ tone: 'error', message: result.message });
      return;
    }
    await this.refreshCollection(false);
    const next = this.state.collection?.plans.find(
      (candidate) =>
        candidate.id !== plan.id && !this.state.collection?.deletedPlanIds.includes(candidate.id),
    );
    if (next) await this.loadPlan(next.id, '当前计划已移入回收区，已打开另一计划。');
    else this.generate(true);
  }

  private async recoverPlan(planId: string): Promise<void> {
    const result = await this.storage.recoverPlan(planId);
    if (!result.ok) {
      this.setStatus({ tone: 'error', message: result.message });
      return;
    }
    await this.loadPlan(planId, '已恢复删除的计划。');
  }

  private async restoreSnapshot(snapshotId: string): Promise<void> {
    if (!window.confirm('恢复快照会替换当前计划内容，但快照本身仍会保留。继续吗？')) return;
    const result = await this.storage.restoreSnapshot(snapshotId);
    if (!result.ok) {
      this.setStatus({ tone: 'error', message: result.message });
      return;
    }
    await this.loadPlan(result.value.id, '快照已恢复；Undo/Redo 栈已按版本边界重置。');
  }

  private async sharePlan(): Promise<void> {
    const plan = this.state.plan;
    if (!plan) return;
    const summary = [
      plan.name,
      `${plan.days.length} 天 · ${plan.placeIds.length} 个地点`,
      ...plan.days.map(
        (day, index) =>
          `D${index + 1} ${day.date}：${day.items.filter((item) => item.kind === 'place').map((item) => item.customTitle).join(' → ')}`,
      ),
      '路线时间含明确估算边界，请在出行前复核动态信息。',
    ].join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: plan.name, text: summary });
        this.setStatus({ tone: 'success', message: '计划摘要已调用系统分享。' });
      } else {
        await navigator.clipboard.writeText(summary);
        this.setStatus({ tone: 'success', message: '当前浏览器不支持系统分享，摘要已复制。' });
      }
    } catch (error) {
      this.setStatus({ tone: 'warning', message: error instanceof Error ? error.message : '分享被取消。' });
    }
  }

  private async exportPlan(): Promise<void> {
    if (!(await this.saveCurrent(false))) return;
    const result = await this.storage.exportBundle();
    if (!result.ok) {
      this.setStatus({ tone: 'error', message: result.message });
      return;
    }
    const blob = new Blob([JSON.stringify(result.value, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'qingdao-phase3-plan.json';
    anchor.click();
    URL.revokeObjectURL(url);
    this.setStatus({ tone: 'success', message: '已导出带 SHA-256 校验和的计划文件。' });
  }

  private async importFile(file: File | null): Promise<void> {
    if (!file) return;
    const currentPlan = this.state.plan;
    this.setBusy(true, '正在隔离校验导入文件…');
    try {
      const unknownBundle = JSON.parse(await file.text()) as unknown;
      const preview = await this.storage.previewImport(unknownBundle);
      if (!preview.ok || !preview.value.valid) {
        const detail = preview.ok
          ? (preview.value.issues[0]?.message ?? '文件不符合导入 Schema。')
          : preview.message;
        this.state = {
          ...this.state,
          plan: currentPlan,
          busy: false,
          status: { tone: 'error', message: `导入被拒绝：${detail}；当前计划保持不变。` },
        };
        this.render();
        return;
      }
      const imported = await this.storage.importBundle(unknownBundle);
      if (!imported.ok) {
        this.state = {
          ...this.state,
          plan: currentPlan,
          busy: false,
          status: { tone: 'error', message: imported.message },
        };
        this.render();
        return;
      }
      const plan =
        imported.value.plans.find((candidate) => candidate.id === imported.value.activePlanId) ??
        imported.value.plans.at(-1);
      if (!plan) throw new Error('导入包中没有旅行计划。');
      await this.loadPlan(plan.id, '导入校验通过，计划、快照与可执行历史已原子替换并重新载入。');
    } catch (error) {
      this.state = {
        ...this.state,
        plan: currentPlan,
        busy: false,
        status: {
          tone: 'error',
          message: `导入失败：${error instanceof Error ? error.message : '无法读取文件'}；当前计划保持不变。`,
        },
      };
      this.render();
    }
  }

  private setBusy(busy: boolean, message: string): void {
    this.state = { ...this.state, busy, status: { tone: 'info', message } };
    this.render();
  }

  private setStatus(status: AppStatus): void {
    this.state = { ...this.state, status };
    this.render();
  }

  private render(): void {
    this.root.innerHTML = renderApp(this.state);
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root');
new QingdaoPlannerApp(root);
