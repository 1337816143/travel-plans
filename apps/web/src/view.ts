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

function renderHeader(state: AppState): string {
  return `<header class="site-header">
    <a class="brand" href="#workspace-content" aria-label="青岛自由行 Lab 首页">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
      <span><strong>青岛自由行</strong><small>QINGDAO TRIP LAB</small></span>
    </a>
    <nav class="workspace-nav" aria-label="完整攻略与自定义规划">
      <button type="button" data-action="switch-workspace" data-workspace="guide" aria-pressed="${String(state.workspace === 'guide')}" class="${state.workspace === 'guide' ? 'is-active' : ''}">完整攻略</button>
      <button type="button" data-action="switch-workspace" data-workspace="planner" aria-pressed="${String(state.workspace === 'planner')}" class="${state.workspace === 'planner' ? 'is-active' : ''}">自定义规划</button>
      <span class="phase-badge">v3 · 完整版预览</span>
      <a href="../index.html" target="_blank" rel="noopener" data-stable-entry>独立打开 v2.5.4</a>
    </nav>
  </header>`;
}

function renderFooter(): string {
  return `<footer>
    <div><span class="brand-mark small" aria-hidden="true"><i></i><i></i></span><strong>青岛旅游规划 v3 · 完整攻略＋自定义规划</strong></div>
    <p>完整 v2.5.4 基线保持不变 · 新功能独立分层 · 数据版本 legacy-v2.5.4-review-required</p>
  </footer>`;
}

function renderGuideWorkspace(state: AppState): string {
  return `${renderHeader(state)}
    <main id="workspace-content" class="guide-workspace" data-testid="legacy-full-guide" tabindex="-1">
      <section class="guide-intro">
        <div>
          <span class="hero-eyebrow"><i></i> v2.5.4 完整产品基线</span>
          <h1>原有攻略一项不少，<br /><em>自定义能力只做加法。</em></h1>
          <p>下方直接运行冻结的 v2.5.4 完整页面，不是内容摘录或静态截图。真实 Leaflet／高德地图、8 天攻略、预约、住宿、美食、天气、路线和旅行工具全部保留。</p>
        </div>
        <div class="guide-metrics" aria-label="v2.5.4 完整数据对账">
          <span><strong>49</strong>运行时地图点</span>
          <span><strong>8</strong>天固定日程</span>
          <span><strong>8</strong>项预约</span>
          <span><strong>24</strong>项来源</span>
        </div>
      </section>
      <section class="legacy-frame-card" aria-label="v2.5.4 完整攻略与真实地图">
        <header>
          <div><span>UNCHANGED BASELINE</span><h2>完整攻略与真实地图</h2></div>
          <div class="legacy-status"><i></i> 精确加载冻结版 v2.5.4</div>
        </header>
        <iframe
          class="legacy-frame"
          data-testid="legacy-v2-frame"
          src="../index.html?embedded=v3"
          title="青岛旅行规划 v2.5.4 完整攻略与真实地图"
          loading="eager"
          allow="geolocation; clipboard-write"
        ></iframe>
        <div class="legacy-frame-actions">
          <p>这里保留 v2.5.4 的原始交互和本机数据；如需全屏地图，可在新标签页独立打开。</p>
          <a href="../index.html" target="_blank" rel="noopener">全屏打开稳定版 v2.5.4</a>
          <button type="button" data-action="switch-workspace" data-workspace="planner">进入新增的自定义规划器</button>
        </div>
      </section>
      <section class="parity-proof" aria-labelledby="parity-title">
        <div><span>PARITY GUARANTEE</span><h2 id="parity-title">完整保留范围</h2></div>
        <ul>
          <li>真实 Leaflet 多底图与高德地图助手</li>
          <li>39 个主要点位＋10 个必吃必买地图点</li>
          <li>逐日攻略、住宿、预约、点位与美食检索</li>
          <li>天气、路况、路线、日历、预算与旅行工具</li>
          <li>离线缓存、v1.0.15 回退和本机状态</li>
        </ul>
      </section>
    </main>
    ${renderFooter()}`;
}

export function renderApp(state: AppState): string {
  if (state.workspace === 'guide') return renderGuideWorkspace(state);
  const count = selectedCount(state);
  const routeCount =
    state.plan?.days.reduce((total, day) => total + day.routeSegments.length, 0) ?? 0;
  const warningCount = state.plan?.conflicts.length ?? 0;
  const undoCount = state.history.past.length;
  const redoCount = state.history.future.length;
  const saved = state.plan !== null && state.plan.updatedAt === state.persistedUpdatedAt;
  return `
    ${renderHeader(state)}

    <main id="workspace-content" tabindex="-1">
      <section class="hero">
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="hero-copy">
          <span class="hero-eyebrow"><i></i> 只为青岛设计</span>
          <h1>在完整攻略之上，<br /><em>排成属于你的几天。</em></h1>
          <p>v2.5.4 的攻略、真实地图与旅行工具继续完整保留；这里从 49 个现有点位出发，新增可拖动、可保存、可解释的自定义日程。</p>
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
            <label><span>旅行天数</span><div class="days-input-wrap"><input type="number" min="1" step="1" inputmode="numeric" data-field="total-days" value="${escapeHtml(String(state.form.totalDays))}" aria-describedby="total-days-hint" /><small id="total-days-hint">正整数，不设产品上限</small></div></label>
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
                <div><span>LEAFLET · WGS84</span><h3>真实交互地图</h3></div>
                <span class="map-mode is-live">真实底图</span>
              </div>
              ${renderMap(state.map, state.allPlaces.length)}
              <div class="map-boundary">
                <strong>地图与路线边界</strong>
                <p>底图、缩放、拖动、定位和点位都是真实地图交互；可切换当前日程／全部 49 点，并从地图直接加入地点。当前自定义路线仍明确显示为低置信度直线降级，接入真实道路 Provider 前不会冒充步行或驾车路线。完整高德路线、天气与路况继续保留在“完整攻略”。</p>
              </div>
            </aside>
          </div>
        </div>
      </section>
      ${renderPhase3Tools(state)}
    </main>

    ${renderFooter()}`;
}
