import type { TripDay, TripItem } from '@qingdao/schema';

import { DEMO_PLACE_OPTIONS } from './data.js';
import { escapeHtml, formatDate, formatTime, minuteLabel } from './format.js';
import { renderMap } from './map-view.js';
import { renderPhase3Tools } from './phase3-tools-view.js';
import type { AppState } from './types.js';

const PRIORITY_LABELS = {
  must: '一定要去',
  want: '想去',
  optional: '可选',
  exclude: '不去',
} as const;

function selectedCount(state: AppState): number {
  return (
    state.plan?.placeIds.length ??
    Object.values(state.form.priorities).filter((priority) => priority !== 'exclude').length
  );
}

function renderPlacePicker(state: AppState): string {
  return DEMO_PLACE_OPTIONS.map((option) => {
    const place = state.allPlaces.find((candidate) => candidate.id === option.id);
    const priority = state.form.priorities[option.id] ?? option.defaultPriority;
    const excluded = priority === 'exclude';
    return `
      <article class="place-choice accent-${option.accent}${excluded ? ' is-excluded' : ''}" data-place-choice="${option.id}">
        <span class="place-choice-accent" aria-hidden="true"></span>
        <div class="place-choice-copy">
          <span class="place-eyebrow">${escapeHtml(option.eyebrow)}</span>
          <strong>${escapeHtml(option.shortName)}</strong>
          <p>${escapeHtml(option.summary)}</p>
          <span class="data-state">${place?.reviewStatus === 'approved' ? '已审核点位' : 'Legacy · 待审核'}</span>
        </div>
        <label class="priority-control">
          <span class="sr-only">${escapeHtml(option.shortName)}优先级</span>
          <select data-priority-place="${option.id}" aria-label="${escapeHtml(option.shortName)}优先级">
            ${Object.entries(PRIORITY_LABELS)
              .map(
                ([value, label]) =>
                  `<option value="${value}"${value === priority ? ' selected' : ''}>${label}</option>`,
              )
              .join('')}
          </select>
        </label>
      </article>`;
  }).join('');
}

function priorityForItem(state: AppState, item: TripItem): string {
  if (item.placeId === null) return '约束项';
  const priority = state.form.priorities[item.placeId] ?? 'want';
  return PRIORITY_LABELS[priority];
}

function routeBefore(day: TripDay, item: TripItem): string {
  const route = day.routeSegments.find((segment) => segment.toItemId === item.id);
  if (!route) return '';
  return `
    <div class="route-before" data-testid="route-segment">
      <span class="route-dash" aria-hidden="true"></span>
      <span>步行降级估算 · ${(route.distanceMeters / 1000).toFixed(1)} km · ${minuteLabel(route.durationMinutes)}</span>
      <span class="estimate-chip">低置信度</span>
    </div>`;
}

function renderRestItem(item: TripItem): string {
  return `
    <article class="timeline-item rest-item" data-plan-item="${escapeHtml(item.id)}">
      <div class="time-rail">
        <time>${formatTime(item.startAt)}</time>
        <span class="time-dot rest-dot"></span>
        <small>${formatTime(item.endAt)}</small>
      </div>
      <div class="item-card rest-card">
        <span class="rest-line"></span>
        <div>
          <span class="item-kicker">TripRequest 约束</span>
          <h4>${escapeHtml(item.customTitle)}</h4>
          <p>${escapeHtml(item.notes)}</p>
        </div>
        <span class="duration-chip">${minuteLabel(item.durationMinutes)}</span>
      </div>
    </article>`;
}

function renderPlaceItem(
  state: AppState,
  day: TripDay,
  item: TripItem,
  placeIndex: number,
  totalPlaces: number,
  dayIndex: number,
  totalDays: number,
): string {
  const selected = state.selectedItemId === item.id;
  const batchSelected = state.selectedItemIds.includes(item.id);
  const place = state.allPlaces.find((candidate) => candidate.id === item.placeId);
  return `
    ${routeBefore(day, item)}
    <article class="timeline-item place-item${selected ? ' is-selected' : ''}"
      data-plan-item="${escapeHtml(item.id)}"
      data-day-id="${escapeHtml(day.id)}"
      data-place-index="${placeIndex}"
      draggable="${String(!item.locked)}">
      <div class="time-rail">
        <time>${formatTime(item.startAt)}</time>
        <span class="time-dot"></span>
        <small>${formatTime(item.endAt)}</small>
      </div>
      <div class="item-card place-card">
        <label class="batch-selector"><input type="checkbox" data-batch-item="${escapeHtml(item.id)}"${batchSelected ? ' checked' : ''} /><span class="sr-only">选择 ${escapeHtml(item.customTitle)}</span></label>
        <button class="item-main" type="button" data-action="select-item" data-item-id="${escapeHtml(item.id)}">
          <span class="map-sequence${item.mapNumber ? '' : ' is-hidden'}" aria-label="${item.mapNumber ? `地图编号 ${escapeHtml(item.mapNumber)}` : '地图编号已隐藏'}">${escapeHtml(item.mapNumber || '—')}</span>
          <span class="item-copy">
            <span class="item-kicker">${escapeHtml(priorityForItem(state, item))} · ${escapeHtml(place?.category ?? 'custom')}</span>
            <strong>${escapeHtml(item.customTitle)}</strong>
            <span>${escapeHtml(item.detail.slice(0, 62))}${item.detail.length > 62 ? '…' : ''}</span>
            <span class="item-meta">${minuteLabel(item.durationMinutes)} · ${item.estimateStatus === 'estimated' ? '停留时长估算' : '审核时长'}</span>
          </span>
        </button>
        <span class="reorder-controls" aria-label="调整顺序和日期">
          <button type="button" data-action="move-up" data-item-id="${escapeHtml(item.id)}" ${placeIndex === 0 || item.locked ? 'disabled' : ''}>上移</button>
          <button type="button" data-action="move-down" data-item-id="${escapeHtml(item.id)}" ${placeIndex === totalPlaces - 1 || item.locked ? 'disabled' : ''}>下移</button>
          <button type="button" data-action="move-day-previous" data-item-id="${escapeHtml(item.id)}" ${dayIndex === 0 || item.locked ? 'disabled' : ''}>前一天</button>
          <button type="button" data-action="move-day-next" data-item-id="${escapeHtml(item.id)}" ${dayIndex === totalDays - 1 || item.locked ? 'disabled' : ''}>后一天</button>
        </span>
        <span class="drag-handle" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
    </article>`;
}

function renderDay(state: AppState, day: TripDay, index: number): string {
  const places = day.items.filter((item) => item.kind === 'place');
  let placeIndex = 0;
  const items = day.items
    .map((item) => {
      if (item.kind === 'rest') return renderRestItem(item);
      if (item.kind !== 'place') return '';
      const html = renderPlaceItem(
        state,
        day,
        item,
        placeIndex,
        places.length,
        index,
        state.plan?.days.length ?? 0,
      );
      placeIndex += 1;
      return html;
    })
    .join('');
  return `
    <section class="day-column" data-day="${escapeHtml(day.id)}">
      <header class="day-header">
        <span class="day-index">D${index + 1}</span>
        <div>
          <span>${formatDate(day.date)}</span>
          <h3>${escapeHtml(day.title.replace(/^第 \d+ 天 · /, ''))}</h3>
        </div>
        <span class="day-count">${places.length} 个地点</span>
      </header>
      <div class="day-timeline">
        ${items || '<p class="empty-day">这一天留白，可继续加入地点。</p>'}
        <div class="day-drop-zone" data-day-drop-index="${places.length}" data-day-id="${escapeHtml(day.id)}">
          拖到这里，追加到第 ${index + 1} 天
        </div>
      </div>
    </section>`;
}

function renderSchedule(state: AppState): string {
  if (!state.plan) {
    return '<div class="schedule-empty"><span>02</span><h3>等待生成</h3><p>选好天数和地点后，Planner 会在这里给出可解释时间轴。</p></div>';
  }
  return `<div class="schedule-days" data-testid="schedule-days">${state.plan.days
    .map((day, index) => renderDay(state, day, index))
    .join('')}</div>`;
}

function renderWarnings(state: AppState): string {
  if (!state.plan) return '';
  const providerWarnings = state.plan.conflicts.filter(
    (conflict) => conflict.kind === 'provider-failure',
  ).length;
  const riskCount = state.plan.risks.length;
  return `
    <div class="integrity-strip">
      <span class="integrity-icon" aria-hidden="true"></span>
      <div>
        <strong>估算边界已开启</strong>
        <p>${providerWarnings} 段路线等待真实 Provider；${riskCount} 项数据质量风险。没有把直线距离冒充真实道路结果。</p>
      </div>
      <button type="button" data-action="show-warnings">查看说明</button>
    </div>`;
}

function renderStatus(state: AppState): string {
  return `<div class="app-status tone-${state.status.tone}" role="status" data-testid="app-status"><span></span>${escapeHtml(state.status.message)}</div>`;
}

export function renderApp(state: AppState): string {
  const count = selectedCount(state);
  const routeCount =
    state.plan?.days.reduce((total, day) => total + day.routeSegments.length, 0) ?? 0;
  const warningCount = state.plan?.conflicts.length ?? 0;
  const undoCount = state.history.past.length;
  const redoCount = state.history.future.length;
  const saved = state.plan !== null && state.plan.updatedAt === state.persistedUpdatedAt;
  return `
    <header class="site-header">
      <a class="brand" href="#top" aria-label="青岛自由行 Lab 首页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
        <span><strong>青岛自由行</strong><small>QINGDAO TRIP LAB</small></span>
      </a>
      <nav aria-label="版本与入口">
        <span class="phase-badge">Phase 4 · 候选内容编辑</span>
        <a href="../../index.html">打开 Legacy v2.5.4</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="hero-copy">
          <span class="hero-eyebrow"><i></i> 只为青岛设计</span>
          <h1>把想去的海岸，<br /><em>排成属于你的几天。</em></h1>
          <p>从 49 个现有运行时点位里挑选，用确定性 Planner 生成可拖动、可保存、可解释的青岛日程。</p>
        </div>
        <div class="hero-stats" aria-label="规划概览">
          <div><strong>49</strong><span>Legacy 点位<br />完整保留</span></div>
          <div><strong>${count}</strong><span>本次选择<br />含可选项</span></div>
          <div><strong>${state.form.totalDays}</strong><span>旅行天数<br />可随时重算</span></div>
        </div>
        <div class="hero-wave" aria-hidden="true"><i></i><i></i><i></i></div>
      </section>

      <section class="planner-shell" id="planner-workspace">
        <aside class="builder-panel">
          <div class="panel-heading">
            <span class="section-number">01</span>
            <div><span class="overline">BUILD YOUR ROUTE</span><h2>先定边界，再选心愿</h2></div>
          </div>
          <div class="trip-fields">
            <label><span>出发日期</span><input type="date" data-field="start-date" value="${escapeHtml(state.form.startDate)}" /></label>
            <label><span>旅行天数</span><select data-field="total-days">
              ${[1, 2, 3]
                .map(
                  (days) =>
                    `<option value="${days}"${days === state.form.totalDays ? ' selected' : ''}>${days} 天</option>`,
                )
                .join('')}
            </select></label>
          </div>
          <div class="constraint-note"><span></span><p>舒适节奏 · 08:30–20:30 · 自动保留 90 分钟午餐与午休</p></div>
          <div class="picker-heading"><h3>挑选地点</h3><span>${count} / ${DEMO_PLACE_OPTIONS.length} 已加入</span></div>
          <div class="place-picker">${renderPlacePicker(state)}</div>
          <button class="generate-button" type="button" data-action="generate" ${state.busy ? 'disabled' : ''}>
            <span>重新生成我的日程</span><i aria-hidden="true">→</i>
          </button>
          <p class="side-note">这里保留 8 个快捷选择；完整 49 点可在下方搜索加入。所有 Legacy 内容继续标记审核状态。</p>
        </aside>

        <div class="result-panel">
          <div class="result-toolbar">
            <div class="panel-heading compact">
              <span class="section-number">02</span>
              <div><span class="overline">YOUR QINGDAO DAYS</span><h2>${escapeHtml(state.plan?.name ?? '生成你的时间轴')}</h2></div>
            </div>
            <div class="plan-actions" aria-label="计划文件操作">
              <button type="button" data-action="undo" ${undoCount === 0 ? 'disabled' : ''}>撤销${undoCount > 0 ? ` ${undoCount}` : ''}</button>
              <button type="button" data-action="redo" ${redoCount === 0 ? 'disabled' : ''}>重做${redoCount > 0 ? ` ${redoCount}` : ''}</button>
              <button type="button" data-action="save">保存</button>
              <button type="button" data-action="load">载入</button>
              <button type="button" data-action="export">导出 JSON</button>
              <button type="button" data-action="import">导入</button>
              <button type="button" data-action="share">分享摘要</button>
              <button type="button" data-action="print">打印</button>
              <input class="sr-only" type="file" accept="application/json,.json" data-import-file />
            </div>
          </div>
          ${renderStatus(state)}
          <div class="plan-metrics">
            <span><strong>${count}</strong> 地点</span>
            <span><strong>${routeCount}</strong> 交通段</span>
            <span><strong>${warningCount}</strong> 显式告警</span>
            <span class="sync-state${saved ? ' is-saved' : ''}"><i></i>${saved ? '已存入 IndexedDB' : '有未保存修改'}</span>
          </div>
          ${renderWarnings(state)}
          <div class="workspace-grid">
            <div class="schedule-panel">
              <div class="subpanel-heading">
                <div><span>可拖动时间轴</span><h3>日程与约束</h3></div>
                <p>支持同日／跨日拖动及无障碍按钮；只重算受影响日期，并可撤销或重做。</p>
              </div>
              ${renderSchedule(state)}
            </div>
            <aside class="map-panel">
              <div class="subpanel-heading map-heading">
                <div><span>SDK-INDEPENDENT</span><h3>地图 RenderModel</h3></div>
                <span class="map-mode">无真实底图</span>
              </div>
              ${renderMap(state.map, state.selectedItemId)}
              <div class="map-boundary">
                <strong>这一阶段展示什么？</strong>
                <p>验证点位、独立 Logo、动态编号和路线样式同步。正式高德／Leaflet 底图仍由 Legacy 提供；v3 搜索只在运行时 SDK 可用时调用高德。</p>
              </div>
            </aside>
          </div>
        </div>
      </section>
      ${renderPhase3Tools(state)}
    </main>

    <footer>
      <div><span class="brand-mark small" aria-hidden="true"><i></i><i></i></span><strong>青岛旅游规划 v3 · Phase 4 候选内容旁路编辑器</strong></div>
      <p>Canonical v2.5.4 保持不变 · Pages 未切换 · 数据版本 legacy-v2.5.4-review-required</p>
    </footer>`;
}
