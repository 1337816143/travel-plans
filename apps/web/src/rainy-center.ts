import './rainy-center.css';

import {
  BEACH_STATUS,
  FOOD_GUARDRAILS,
  NEW_TRIP_ITEMS,
  RAIN_AVOIDS,
  RAIN_CHECKED_AT,
  RAIN_DECISION_RULES,
  RAIN_RECOMMENDATIONS,
  RAIN_SOURCES,
  type RainPlace,
} from './rainy-data.js';

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);
}

function sourceLinks(ids: readonly string[]): string {
  return ids
    .map((id) => RAIN_SOURCES.find((source) => source.id === id))
    .filter((source) => source !== undefined)
    .map((source) => {
      const label = esc(source.label);
      if (!source.url) return `<span class="rain-source-chip is-user">${label}</span>`;
      return `<a class="rain-source-chip" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .join('');
}

function placeCard(place: RainPlace): string {
  const tone = place.suitability === 'avoid' ? 'avoid' : place.suitability === 'conditional' ? 'conditional' : 'recommended';
  const label = place.suitability === 'avoid' ? '避坑/取消' : place.suitability === 'conditional' ? '条件可去' : '优先备选';
  return `<article class="rain-place-card tone-${tone}">
    <div class="rain-place-head"><span>${esc(place.category)}</span><b>${label}</b></div>
    <h4>${esc(place.name)}</h4>
    <p>${esc(place.recommendation)}</p>
    <div class="rain-gate"><strong>天气门槛</strong>${esc(place.weatherGate)}</div>
    <div class="rain-verification">${esc(place.verification)}</div>
    <div class="rain-source-row">${sourceLinks(place.sourceIds)}</div>
  </article>`;
}

function renderCenter(): string {
  return `<button id="rainyCenterToggle" class="rainy-center-toggle" type="button" aria-controls="rainyCenterPanel" aria-expanded="false">
      <span aria-hidden="true">☔</span><strong>雨天专栏</strong><small>封海 · Plan B · 避坑</small>
    </button>
    <aside id="rainyCenterPanel" class="rainy-center-panel" aria-label="青岛雨天避坑和备用方案" hidden>
      <header class="rainy-center-head">
        <div><span>QINGDAO RAIN PLAN · 2026.08</span><h2>雨天避坑＋备用方案</h2><p>行程不变，但每天都准备可即时替换的方案。官方关闭和气象预警永远高于社交平台攻略。</p></div>
        <button id="rainyCenterClose" type="button" aria-label="关闭雨天专栏">×</button>
      </header>
      <div class="rain-freshness"><b>最近核验：</b>${RAIN_CHECKED_AT} · <strong>“未发现封海公告”不等于“确认开放”</strong>，到场当天仍需电话/官方渠道复核。</div>
      <nav class="rainy-center-nav" aria-label="雨天专栏目录">
        <a href="#rain-new-items">新增计划</a><a href="#rain-decision">天气决策</a><a href="#rain-recommend">雨天可去</a><a href="#rain-avoid">避坑</a><a href="#rain-beaches">浴场封海</a><a href="#rain-food">餐饮避坑</a>
      </nav>
      <div class="rainy-center-scroll">
        <section id="rain-new-items" class="rain-section">
          <div class="rain-section-title"><span>01</span><div><small>ADDED TO PLAN</small><h3>这次新增到计划的地点与体验</h3></div></div>
          <div class="rain-new-grid">${NEW_TRIP_ITEMS.map((item) => `<article><span>${esc(item.status)}</span><h4>${esc(item.name)}</h4><p>${esc(item.detail)}</p><div class="rain-source-row">${sourceLinks(item.sourceIds)}</div></article>`).join('')}</div>
        </section>
        <section id="rain-decision" class="rain-section">
          <div class="rain-section-title"><span>02</span><div><small>WEATHER GATE</small><h3>别按“下雨/不下雨”二分，按风险等级切换</h3></div></div>
          <div class="rain-decision-grid">${RAIN_DECISION_RULES.map((rule) => `<article class="rain-level level-${rule.level}"><b>${rule.level}级</b><strong>${esc(rule.condition)}</strong><p>${esc(rule.action)}</p></article>`).join('')}</div>
        </section>
        <section id="rain-recommend" class="rain-section">
          <div class="rain-section-title"><span>03</span><div><small>PLAN B</small><h3>雨天可去：按稳定性排序，不照搬短视频</h3></div></div>
          <div class="rain-place-grid">${RAIN_RECOMMENDATIONS.map(placeCard).join('')}</div>
        </section>
        <section id="rain-avoid" class="rain-section">
          <div class="rain-section-title"><span>04</span><div><small>NO-GO / LOW VALUE</small><h3>雨天避坑与强制取消条件</h3></div></div>
          <div class="rain-place-grid">${RAIN_AVOIDS.map(placeCard).join('')}</div>
        </section>
        <section id="rain-beaches" class="rain-section">
          <div class="rain-section-title"><span>05</span><div><small>BEACH STATUS</small><h3>9处海水浴场 · 开放季、服务时间与封海核验</h3></div></div>
          <p class="rain-section-note">以下“服务时间”来自2026年青岛市官方公示；临时封海属于动态安全信息。当前网页检索没有发现 8 月 8 日针对这9处浴场的临时封海公告，但这不能替代当天旗语、广播、官方新媒体和电话确认。</p>
          <div class="rain-beach-table-wrap"><table class="rain-beach-table"><thead><tr><th>浴场</th><th>开放季</th><th>本次行程服务时段</th><th>即时封海状态</th><th>咨询电话</th></tr></thead><tbody>${BEACH_STATUS.map((beach) => `<tr><td><strong>${esc(beach.name)}</strong><small>${esc(beach.rule)}</small></td><td>${esc(beach.season)}</td><td>${esc(beach.serviceHours)}</td><td><span class="rain-status-unknown">需当日复核</span><small>${esc(beach.liveStatus)}</small></td><td><a href="tel:${esc(beach.phone.replace(/-/g, ''))}">${esc(beach.phone)}</a></td></tr>`).join('')}</tbody></table></div>
          <div class="rain-source-row">${sourceLinks(['official-beaches-2026', 'official-weather-emergency'])}</div>
        </section>
        <section id="rain-food" class="rain-section">
          <div class="rain-section-title"><span>06</span><div><small>FOOD GUARDRAILS</small><h3>餐饮与海上项目避坑</h3></div></div>
          <ul class="rain-food-list">${FOOD_GUARDRAILS.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
          <div class="rain-source-row">${sourceLinks(['user-ben-clam', 'user-food-avoid'])}</div>
        </section>
        <section class="rain-section rain-source-section">
          <div class="rain-section-title"><span>07</span><div><small>EVIDENCE</small><h3>资料分层</h3></div></div>
          <div class="rain-evidence-notice"><b>官方</b>用于开放、营业、安全、服务时间；<b>你提供的内容/截图</b>用于体验偏好和避坑；<b>短视频/小红书</b>无法交叉核验的门店、价格、菜品不写成已确认事实。</div>
          <div class="rain-source-list">${RAIN_SOURCES.map((source) => `<article><span>${esc(source.evidence)}</span><strong>${esc(source.label)}</strong><p>${esc(source.note)}</p>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">查看来源</a>` : ''}</article>`).join('')}</div>
        </section>
      </div>
    </aside>`;
}

function mountRainCenter(): void {
  if (document.getElementById('rainyCenterToggle')) return;
  const host = document.createElement('div');
  host.id = 'rainyCenterHost';
  host.innerHTML = renderCenter();
  document.body.append(host);

  const toggle = document.getElementById('rainyCenterToggle');
  const panel = document.getElementById('rainyCenterPanel');
  const close = document.getElementById('rainyCenterClose');
  if (!(toggle instanceof HTMLButtonElement) || !(panel instanceof HTMLElement) || !(close instanceof HTMLButtonElement)) return;

  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('rainy-center-open', open);
    if (open) panel.querySelector<HTMLElement>('a,button')?.focus({ preventScroll: true });
    else toggle.focus({ preventScroll: true });
  };

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  panel.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLAnchorElement) || !target.hash) return;
    const section = panel.querySelector<HTMLElement>(target.hash);
    if (section) {
      event.preventDefault();
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountRainCenter, { once: true });
else mountRainCenter();
