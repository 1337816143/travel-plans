import { buildTripMapRenderModel } from '@qingdao/map-core';
import {
  DEFAULT_PLANNER_ASSUMPTIONS,
  PlannerEditError,
  deterministicCommandId,
  generateTripPlan,
  moveItemWithinDay,
} from '@qingdao/planner';
import { ImportExportBundleSchema, PlacePrioritySchema } from '@qingdao/schema';
import type { TripPlan } from '@qingdao/schema';

import { DEMO_PLACE_OPTIONS, loadQingdaoPlaces } from './data.js';
import { IndexedDbPlanStorage } from './indexeddb-plan-storage.js';
import { buildTripRequest } from './request.js';
import './styles.css';
import type { AppState, AppStatus } from './types.js';
import { renderApp } from './view.js';

const PLANNER_VERSION = '0.2.0-phase2';
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
  private readonly storage = new IndexedDbPlanStorage({
    now,
    appVersion: PLANNER_VERSION,
    dataVersion: DATA_VERSION,
  });

  constructor(private readonly root: HTMLElement) {
    this.state = {
      allPlaces: loadQingdaoPlaces(),
      form: {
        startDate: '2026-08-10',
        totalDays: 2,
        priorities: initialPriorities(),
      },
      plan: null,
      map: null,
      selectedItemId: null,
      status: { tone: 'info', message: '正在准备青岛点位与 Planner…' },
      persistedUpdatedAt: null,
      busy: false,
    };
    this.bindEvents();
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
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
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
      if (target instanceof Element && target.closest('[data-place-index]')) event.preventDefault();
    });

    this.root.addEventListener('drop', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const destination = target.closest<HTMLElement>('[data-place-index]');
      if (!destination || !this.draggingItemId) return;
      event.preventDefault();
      const targetIndex = Number(destination.dataset.placeIndex);
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

  private generate(): void {
    const active = Object.values(this.state.form.priorities).filter(
      (priority) => priority !== 'exclude',
    ).length;
    if (active === 0) {
      this.setStatus({ tone: 'error', message: '至少保留一个地点，才能生成青岛日程。' });
      return;
    }
    try {
      const runAt = now();
      const request = buildTripRequest(this.state.form, runAt);
      const plan = generateTripPlan({
        places: this.state.allPlaces,
        request,
        context: {
          now: runAt,
          plannerVersion: PLANNER_VERSION,
          dataVersion: DATA_VERSION,
          assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
        },
      });
      const map = buildTripMapRenderModel({ plan, places: this.state.allPlaces });
      this.state = {
        ...this.state,
        plan,
        map,
        selectedItemId: map.markers[0]?.itemId ?? null,
        status: {
          tone: 'success',
          message: `已生成 ${plan.days.length} 天计划；午休、排除项和 ${plan.conflicts.length} 条估算边界均已保留。`,
        },
      };
      this.render();
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

  private moveItem(itemId: string, targetIndex: number, targetDayId: string | null): void {
    const plan = this.state.plan;
    if (!plan) return;
    const day = plan.days.find((candidate) => candidate.items.some((item) => item.id === itemId));
    if (!day || targetDayId !== day.id) {
      this.setStatus({ tone: 'warning', message: 'Phase 2 当前只开放同日移动；跨日移动将在 Phase 3 接入。' });
      return;
    }
    const count = day.items.filter((item) => item.kind === 'place').length;
    if (targetIndex < 0 || targetIndex >= count) return;
    try {
      const appliedAt = now();
      const result = moveItemWithinDay({
        plan,
        places: [...this.state.allPlaces],
        dayId: day.id,
        itemId,
        toPlaceIndex: targetIndex,
        commandId: deterministicCommandId(plan, itemId, targetIndex),
        context: {
          now: appliedAt,
          plannerVersion: PLANNER_VERSION,
          dataVersion: DATA_VERSION,
          assumptions: DEFAULT_PLANNER_ASSUMPTIONS,
        },
      });
      const map = buildTripMapRenderModel({ plan: result.plan, places: this.state.allPlaces });
      this.state = {
        ...this.state,
        plan: result.plan,
        map,
        selectedItemId: itemId,
        status: { tone: 'success', message: result.explanation },
      };
      this.render();
    } catch (error) {
      this.setStatus({
        tone: error instanceof PlannerEditError ? 'warning' : 'error',
        message: error instanceof Error ? error.message : '日程移动失败。',
      });
    }
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
    this.setBusy(true, '正在校验并写入 IndexedDB…');
    const result = await this.storage.savePlan(plan, {
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
      persistedUpdatedAt: result.value.updatedAt,
      status: showStatus
        ? { tone: 'success', message: '计划已通过 Schema 校验并保存到 IndexedDB。' }
        : this.state.status,
    };
    this.render();
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
    const plan = result.value.plans.at(-1);
    if (!plan) {
      this.state = {
        ...this.state,
        busy: false,
        status: { tone: 'warning', message: 'IndexedDB 中还没有已保存计划。' },
      };
      this.render();
      return;
    }
    this.state = {
      ...this.state,
      busy: false,
      plan,
      form: formFromPlan(plan),
      map: buildTripMapRenderModel({ plan, places: this.state.allPlaces }),
      selectedItemId: plan.days.flatMap((day) => day.items).find((item) => item.kind === 'place')?.id ?? null,
      persistedUpdatedAt: plan.updatedAt,
      status: { tone: 'success', message: '已从 IndexedDB 载入最近计划。' },
    };
    this.render();
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
    anchor.download = 'qingdao-phase2-plan.json';
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
      const bundle = ImportExportBundleSchema.parse(unknownBundle);
      const imported = await this.storage.importBundle(bundle);
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
      const plan = imported.value.plans.at(-1);
      if (!plan) throw new Error('导入包中没有旅行计划。');
      this.state = {
        ...this.state,
        busy: false,
        plan,
        form: formFromPlan(plan),
        map: buildTripMapRenderModel({ plan, places: this.state.allPlaces }),
        selectedItemId: plan.days.flatMap((day) => day.items).find((item) => item.kind === 'place')?.id ?? null,
        persistedUpdatedAt: plan.updatedAt,
        status: { tone: 'success', message: '导入校验通过，计划已原子替换并重新载入。' },
      };
      this.render();
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
