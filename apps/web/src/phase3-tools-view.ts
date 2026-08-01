import type { AppState } from './types.js';
import { escapeHtml } from './format.js';
import { PHASE3_ITINERARY_MODULES } from './modules.js';

function dayOptions(state: AppState): string {
  return (state.plan?.days ?? [])
    .map(
      (day, index) =>
        `<option value="${escapeHtml(day.id)}"${day.id === state.toolDayId ? ' selected' : ''}>第 ${index + 1} 天 · ${escapeHtml(day.date)}</option>`,
    )
    .join('');
}

function renderSearch(state: AppState): string {
  const activePlaceIds = new Set(
    state.plan?.days.flatMap((day) => day.items.flatMap((item) => (item.placeId ? [item.placeId] : []))) ?? [],
  );
  const results = state.search.candidates.length
    ? state.search.candidates
        .map((candidate) => {
          const existingId =
            candidate.provider === 'qingdao-curated-offline' ? candidate.providerPlaceId : null;
          const alreadyAdded = existingId ? activePlaceIds.has(existingId) : false;
          return `<article class="search-result" data-search-result="${escapeHtml(candidate.id)}">
            <div><strong>${escapeHtml(candidate.name)}</strong><span>${escapeHtml(candidate.address || '地址待核验')}</span></div>
            <small>${candidate.provider === 'amap-js' ? '高德运行时结果' : '49点离线降级'} · ${candidate.requiresReview ? '待核验' : '已审核'}</small>
            <div class="search-result-actions">
              <button type="button" data-action="add-search-result" data-candidate-id="${escapeHtml(candidate.id)}" data-priority="must"${alreadyAdded ? ' disabled' : ''}>设为必去</button>
              <button type="button" data-action="add-search-result" data-candidate-id="${escapeHtml(candidate.id)}" data-priority="want"${alreadyAdded ? ' disabled' : ''}>加入行程</button>
              <button type="button" data-action="add-search-result" data-candidate-id="${escapeHtml(candidate.id)}" data-priority="optional"${alreadyAdded ? ' disabled' : ''}>设为可选</button>
            </div>
          </article>`;
        })
        .join('')
    : '<p class="tool-empty">输入名称搜索。页面注入高德 JS SDK 时优先使用高德；否则明确降级到49个现有青岛点位。</p>';
  return `<section class="phase3-card" data-tool="search">
    <header><span>SEARCH PROVIDER</span><h3>地点搜索并加入行程</h3></header>
    <div class="tool-inline">
      <input type="search" data-field="search-query" value="${escapeHtml(state.search.query)}" placeholder="例如：海底世界、台东、石老人" aria-label="搜索青岛地点" />
      <button type="button" data-action="search-place">搜索</button>
    </div>
    <label class="tool-field"><span>加入日期</span><select data-field="tool-day">${dayOptions(state)}</select></label>
    ${state.search.message ? `<p class="provider-message">${escapeHtml(state.search.message)}</p>` : ''}
    <div class="search-results">${results}</div>
  </section>`;
}

function renderModules(): string {
  return `<section class="phase3-card">
    <header><span>EDITABLE MODULES</span><h3>可组合日程模块</h3></header>
    <div class="module-grid">${PHASE3_ITINERARY_MODULES.map(
      (module) => `<article>
        <strong>${escapeHtml(module.name)}</strong>
        <p>${module.placeIds.length} 个现有点位 · ${Math.round(module.recommendedDurationMinutes / 60)} 小时 · ${module.fitnessIntensity}</p>
        <button type="button" data-action="apply-module" data-module-id="${escapeHtml(module.id)}">加入所选日期</button>
      </article>`,
    ).join('')}</div>
  </section>`;
}

function renderCustomPoi(): string {
  return `<section class="phase3-card">
    <header><span>CUSTOM POI</span><h3>创建自定义青岛地点</h3></header>
    <form class="custom-poi-form" data-custom-poi-form>
      <label><span>名称 *</span><input name="name" required placeholder="我的自定义地点" /></label>
      <label><span>别名</span><input name="alias" /></label>
      <label class="span-2"><span>地址</span><input name="address" placeholder="可留空，但坐标必须填写" /></label>
      <label><span>纬度 *</span><input name="lat" type="number" step="0.000001" value="36.067000" required /></label>
      <label><span>经度 *</span><input name="lng" type="number" step="0.000001" value="120.382000" required /></label>
      <label><span>类别</span><select name="category"><option value="custom">自定义</option><option value="attraction">景点</option><option value="seaside">海滨</option><option value="restaurant">餐厅</option><option value="museum">博物馆</option><option value="shopping">购物</option><option value="hotel">酒店</option></select></label>
      <label><span>Logo</span><select name="iconId"><option value="placeholder-custom">自定义</option><option value="placeholder-seaside">海滨</option><option value="placeholder-mountain">山岳</option><option value="placeholder-museum">博物馆</option><option value="placeholder-restaurant">餐饮</option><option value="placeholder-hotel">住宿</option></select></label>
      <label><span>颜色</span><input name="color" type="color" value="#14a9a3" /></label>
      <label><span>优先级</span><select name="priority"><option value="want">想去</option><option value="must">一定要去</option><option value="optional">可选</option></select></label>
      <label><span>停留分钟</span><input name="durationMinutes" type="number" min="15" max="1440" value="90" /></label>
      <label><span>推荐日期</span><input name="recommendedDate" type="date" /></label>
      <label><span>到达时间</span><input name="arrivalTime" type="time" /></label>
      <label><span>费用估算（元）</span><input name="estimatedCost" type="number" min="0" step="0.01" placeholder="用户输入，可留空" /></label>
      <label class="span-2"><span>开放时间备注</span><input name="openingHours" placeholder="仅记录用户输入，不当作已核验事实" /></label>
      <label class="span-2"><span>备注</span><textarea name="notes" rows="2"></textarea></label>
      <label class="span-2"><span>详细内容</span><textarea name="detail" rows="3"></textarea></label>
      <label class="span-2"><span>预约信息</span><textarea name="reservation" rows="2" placeholder="用户输入，不推断预约规则"></textarea></label>
      <label class="span-2"><span>提醒（每行一条）</span><textarea name="reminders" rows="2"></textarea></label>
      <label class="span-2"><span>来源链接</span><input name="sourceUrl" type="url" placeholder="https://…（可选）" /></label>
      <label class="check-field"><input type="checkbox" name="participatesInPlanning" checked /><span>参与规划</span></label>
      <label class="check-field"><input type="checkbox" name="locked" /><span>创建后锁定</span></label>
      <label class="check-field"><input type="checkbox" name="planB" /><span>作为 Plan B</span></label>
      <button class="tool-primary span-2" type="button" data-action="create-custom-poi">创建并加入所选日期</button>
    </form>
  </section>`;
}

function renderBatch(state: AppState): string {
  const selectedCount = state.selectedItemIds.length;
  return `<section class="phase3-card batch-card">
    <header><span>BATCH COMMANDS</span><h3>批量管理 · 已选 ${selectedCount}</h3></header>
    <div class="batch-actions">
      <button type="button" data-action="select-all-items">全选地点</button>
      <button type="button" data-action="clear-selection">清空选择</button>
      <button type="button" data-action="batch-lock"${selectedCount ? '' : ' disabled'}>锁定</button>
      <button type="button" data-action="batch-unlock"${selectedCount ? '' : ' disabled'}>解锁</button>
      <button type="button" data-action="batch-move"${selectedCount ? '' : ' disabled'}>移至所选日期</button>
      <form class="batch-priority" data-batch-priority-form><select name="priority" aria-label="批量优先级"><option value="must">一定要去</option><option value="want">想去</option><option value="optional">可选</option></select><button type="button" data-action="batch-priority"${selectedCount ? '' : ' disabled'}>设置优先级</button></form>
      <button class="danger" type="button" data-action="batch-disable"${selectedCount ? '' : ' disabled'}>暂时停用</button>
      <button class="danger" type="button" data-action="batch-delete"${selectedCount ? '' : ' disabled'}>删除</button>
    </div>
    <div class="trash-list">
      <strong>回收区 ${state.plan?.removedItems.length ?? 0}</strong>
      ${(state.plan?.removedItems ?? []).map((record) => `<span>${escapeHtml(record.item.customTitle)} · ${record.removalMode === 'deleted' ? '已删除' : '已停用'} <button type="button" data-action="restore-removed" data-removed-id="${escapeHtml(record.id)}">恢复</button></span>`).join('') || '<small>没有被删除或停用的地点。</small>'}
    </div>
  </section>`;
}

function renderStyles(state: AppState): string {
  const selectedItems = (state.plan?.days ?? []).flatMap((day) =>
    day.items.filter((item) => state.selectedItemIds.includes(item.id)),
  );
  const customNumberFields = selectedItems.length
    ? selectedItems
        .map(
          (item) => `<label><span>${escapeHtml(item.customTitle)}</span><input name="customNumber:${escapeHtml(item.id)}" maxlength="20" value="${escapeHtml(state.plan?.markerNumbering.customNumbers[item.id] ?? '')}" placeholder="例如 A1" /></label>`,
        )
        .join('')
    : '<small>先在日程中勾选地点，才能逐项设置自定义编号。</small>';
  return `<section class="phase3-card style-card">
    <header><span>LOGO · NUMBER · ROUTE</span><h3>地图样式系统</h3></header>
    <div class="style-editor-grid">
      <form data-marker-style-form>
        <strong>所选地点 Logo</strong>
        <label><span>图案</span><select name="iconId"><option value="placeholder-seaside">海滨</option><option value="placeholder-mountain">山岳</option><option value="placeholder-museum">博物馆</option><option value="placeholder-restaurant">餐饮</option><option value="placeholder-hotel">住宿</option><option value="placeholder-custom">自定义</option></select></label>
        <label><span>颜色</span><input name="color" type="color" value="#ff765e" /></label>
        <button type="button" data-action="apply-marker-style"${state.selectedItemIds.length ? '' : ' disabled'}>应用 Logo</button>
      </form>
      <form data-numbering-form>
        <strong>独立编号</strong>
        <label><span>方式</span><select name="mode"><option value="per-day">每日从1开始</option><option value="continuous">全程连续</option><option value="day-prefixed">D1-1</option><option value="hidden">隐藏编号</option><option value="custom">逐项自定义</option></select></label>
        <label><span>起始编号</span><input name="startNumber" type="number" min="1" value="${state.plan?.markerNumbering.startNumber ?? 1}" /></label>
        <div class="custom-number-fields"><strong>所选地点编号</strong>${customNumberFields}</div>
        <button type="button" data-action="apply-numbering">同步编号</button>
      </form>
      <form data-route-style-form>
        <strong>路线视觉样式</strong>
        <label><span>颜色</span><input name="color" type="color" value="#14a9a3" /></label>
        <label><span>线型</span><select name="pattern"><option value="solid">实线</option><option value="dashed">虚线</option><option value="dotted">点线</option></select></label>
        <label><span>粗细</span><input name="width" type="number" min="1" max="12" value="4" /></label>
        <label><span>透明度</span><input name="opacity" type="number" min="0" max="1" step="0.05" value="0.85" /></label>
        <label class="check-field"><input type="checkbox" name="arrowsVisible" checked /><span>方向箭头</span></label>
        <label><span>箭头方向</span><select name="arrowDirection"><option value="forward">正向</option><option value="reverse">反向</option><option value="both">双向</option></select></label>
        <label><span>箭头大小</span><input name="arrowSize" type="number" min="1" max="64" value="7" /></label>
        <label><span>箭头间距</span><input name="arrowSpacing" type="number" min="1" max="1000" value="64" /></label>
        <label><span>图层顺序</span><input name="zIndex" type="number" value="2" /></label>
        <label><span>范围</span><select name="scope"><option value="segment">所选相邻路段</option><option value="day">所选地点所在整日</option></select></label>
        <label class="check-field"><input type="checkbox" name="visible" checked /><span>显示路线</span></label>
        <button type="button" data-action="apply-route-style">应用到所选地点相邻路线</button>
      </form>
    </div>
  </section>`;
}

function renderAccommodation(state: AppState): string {
  const analysis = state.plan?.accommodationAnalysis;
  const content = analysis
    ? `<div class="accommodation-results">${[...analysis.scores]
        .sort((left, right) => left.rank - right.rank)
        .map((score) => {
          const area = analysis.candidates.find((candidate) => candidate.id === score.areaId);
          return `<article class="${score.rank === 1 ? 'is-top-match' : ''}"><span>#${score.rank}</span><strong>${escapeHtml(area?.name ?? score.areaId)}</strong><small>加权直线距离 ${(score.weightedStraightLineMeters / 1000).toFixed(1)} km</small><p>${escapeHtml(area?.description ?? '')}</p></article>`;
        })
        .join('')}<p class="provider-message">${escapeHtml(analysis.warnings.join(' '))}</p></div>`
    : '<p class="tool-empty">基于当前已排地点比较老城、五四广场和东海岸住宿区域；不会伪造酒店价格、评分或库存。</p>';
  return `<section class="phase3-card">
    <header><span>ACCOMMODATION</span><h3>住宿区域分析</h3></header>
    <button type="button" data-action="analyze-accommodation">重新分析当前日程</button>
    ${content}
  </section>`;
}

function renderPlanManager(state: AppState): string {
  const collection = state.collection;
  if (!collection) {
    return `<section class="phase3-card"><header><span>PLAN LIBRARY</span><h3>多计划与快照</h3></header><p class="tool-empty">正在读取 IndexedDB…</p></section>`;
  }
  const activePlans = collection.plans.filter(
    (plan) => !collection.deletedPlanIds.includes(plan.id),
  );
  const deletedPlans = collection.plans.filter((plan) => collection.deletedPlanIds.includes(plan.id));
  return `<section class="phase3-card plan-library">
    <header><span>PLAN LIBRARY</span><h3>多计划、版本与恢复</h3></header>
    <div class="library-actions"><button type="button" data-action="new-plan">新建计划</button><button type="button" data-action="duplicate-plan">复制当前</button><button type="button" data-action="rename-plan">重命名</button><button type="button" data-action="snapshot-plan">保存快照</button><button type="button" data-action="archive-plan">归档</button><button class="danger" type="button" data-action="delete-plan">删除当前</button></div>
    <div class="plan-list">${activePlans.map((plan) => `<article class="${plan.id === state.plan?.id ? 'is-active' : ''}"><div><strong>${escapeHtml(plan.name)}</strong><small>${escapeHtml(plan.id)}${collection.archivedPlanIds.includes(plan.id) ? ' · 已归档' : ''}</small></div><button type="button" data-action="load-plan" data-plan-id="${escapeHtml(plan.id)}">打开</button>${collection.archivedPlanIds.includes(plan.id) ? `<button type="button" data-action="unarchive-plan" data-plan-id="${escapeHtml(plan.id)}">恢复归档</button>` : ''}</article>`).join('') || '<p class="tool-empty">还没有已保存计划。</p>'}</div>
    ${collection.snapshots.length ? `<div class="snapshot-list"><strong>快照</strong>${collection.snapshots.map((snapshot) => `<span>${escapeHtml(snapshot.label)}<button type="button" data-action="restore-snapshot" data-snapshot-id="${escapeHtml(snapshot.id)}">恢复</button></span>`).join('')}</div>` : ''}
    ${deletedPlans.length ? `<div class="deleted-plans"><strong>已删除计划</strong>${deletedPlans.map((plan) => `<span>${escapeHtml(plan.name)}<button type="button" data-action="recover-plan" data-plan-id="${escapeHtml(plan.id)}">恢复</button></span>`).join('')}</div>` : ''}
  </section>`;
}

export function renderPhase3Tools(state: AppState): string {
  if (!state.plan) return '';
  return `<section class="phase3-tools" aria-label="Phase 3 完整编辑工具">
    <div class="phase3-heading"><span class="section-number">03</span><div><span class="overline">FULL EDITOR</span><h2>搜索、组合、批量与多计划</h2><p>所有操作转换为显式 Command；锁定、恢复、Undo/Redo 与 IndexedDB 版本化历史保持一致。</p></div></div>
    <div class="phase3-grid">
      ${renderSearch(state)}
      ${renderModules()}
      ${renderCustomPoi()}
      ${renderBatch(state)}
      ${renderStyles(state)}
      ${renderAccommodation(state)}
      ${renderPlanManager(state)}
    </div>
  </section>`;
}
