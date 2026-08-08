import rainGuide from '../../../data/qingdao/rain/rain-guide.v1.json' with { type: 'json' };

import './rainy-center.css';

type RainAddition = (typeof rainGuide.tripAdditions)[number];
type ScreenshotAvoid = (typeof rainGuide.uploadedScreenshotGuide.avoidOrLowValue)[number];
type ScreenshotRecommend = (typeof rainGuide.uploadedScreenshotGuide.recommendedWithConditions)[number];
type IndoorBackup = (typeof rainGuide.additionalIndoorBackups)[number];

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Readonly<Record<string, string>> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function externalLink(value: unknown, label: string): string {
  const url = safeExternalUrl(value);
  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    : '';
}

function additionCard(item: RainAddition): string {
  const sourceUrl = 'sourceUrl' in item ? item.sourceUrl : null;
  const mapUrl = 'mapUrl' in item ? item.mapUrl : null;
  const location = 'address' in item && item.address ? `<p><b>位置：</b>${escapeHtml(item.address)}</p>` : '';
  const transport =
    'transport' in item && item.transport ? `<p><b>交通：</b>${escapeHtml(item.transport)}</p>` : '';
  const hours = 'hours' in item && item.hours ? `<p><b>时间：</b>${escapeHtml(item.hours)}</p>` : '';
  const weather = 'weatherFit' in item && Array.isArray(item.weatherFit) ? item.weatherFit : [];
  const avoid = 'avoidWhen' in item && Array.isArray(item.avoidWhen) ? item.avoidWhen : [];
  return `<article class="rain-center-card rain-addition-card">
    <div class="rain-card-heading">
      <span>${escapeHtml(item.kind)}</span>
      <strong>${escapeHtml(item.verification.includes('unverified') ? '信息待核' : '已核验 / 用户明确愿望')}</strong>
    </div>
    <h4>${escapeHtml(item.name)}</h4>
    ${location}${transport}${hours}
    <p><b>放进计划：</b>${escapeHtml(item.planUse)}</p>
    <p>${escapeHtml(item.note)}</p>
    <div class="rain-weather-tags">
      ${weather.map((text) => `<span class="is-good">${escapeHtml(text)}</span>`).join('')}
      ${avoid.map((text) => `<span class="is-bad">避：${escapeHtml(text)}</span>`).join('')}
    </div>
    <div class="rain-card-actions">${externalLink(mapUrl, '地图检索')}${externalLink(sourceUrl, '原始参考')}</div>
  </article>`;
}

function avoidCard(item: ScreenshotAvoid): string {
  return `<article class="rain-center-card is-avoid">
    <div class="rain-card-heading"><span>雨天低优先 / 避坑</span><strong>${escapeHtml(item.safety)}</strong></div>
    <h4>${escapeHtml(item.name)}</h4>
    <p>${escapeHtml(item.reason)}</p>
  </article>`;
}

function recommendationCard(item: ScreenshotRecommend): string {
  return `<article class="rain-center-card ${item.tier === 'indoor' ? 'is-indoor' : 'is-conditional'}">
    <div class="rain-card-heading"><span>${item.tier === 'indoor' ? '室内优先' : '有条件可去'}</span><strong>${escapeHtml(item.tier)}</strong></div>
    <h4>${escapeHtml(item.name)}</h4>
    <p>${escapeHtml(item.condition)}</p>
  </article>`;
}

function indoorCard(item: IndoorBackup): string {
  return `<article class="rain-center-card is-indoor">
    <div class="rain-card-heading"><span>补充纯室内</span><strong>${escapeHtml(item.verification)}</strong></div>
    <h4>${escapeHtml(item.name)}</h4>
    <p>${escapeHtml(item.why)}</p>
    ${'hours' in item && item.hours ? `<p><b>开放：</b>${escapeHtml(item.hours)}</p>` : ''}
    <div class="rain-card-actions">${externalLink(item.sourceUrl, '官方/核验来源')}</div>
  </article>`;
}

function beachRows(): string {
  return rainGuide.beachStatus.beaches
    .map(
      (beach) => `<tr>
        <td><strong>${escapeHtml(beach.name)}</strong><small>${escapeHtml(beach.season)}</small></td>
        <td>${escapeHtml(beach.hoursAug09to15)}</td>
        <td>${escapeHtml(beach.hoursAug16)}</td>
        <td><span class="rain-live-state">${escapeHtml(beach.liveState)}</span><small>${escapeHtml(beach.liveMethod)}</small></td>
        <td><a href="tel:${escapeHtml(beach.phone.replace(/-/g, ''))}">${escapeHtml(beach.phone)}</a></td>
      </tr>`,
    )
    .join('');
}

function sourceRows(): string {
  return rainGuide.sourceNotes
    .map((source) => {
      const label = escapeHtml(source.label);
      const url = 'url' in source ? safeExternalUrl(source.url) : null;
      return `<li>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label}<small>${escapeHtml(source.tier)}</small></li>`;
    })
    .join('');
}

function renderCenter(): string {
  const checkedAt = rainGuide.beachStatus.checkedAt.replace('T', ' ').replace('+08:00', '');
  return `<button class="rain-center-trigger" id="rainCenterTrigger" type="button" aria-expanded="false" aria-controls="rainCenterPanel">
    <span aria-hidden="true">☔</span><strong>雨天专栏</strong><small>封海 · Plan B · 避坑</small>
  </button>
  <aside class="rain-center-panel" id="rainCenterPanel" aria-label="青岛雨天避坑和备用方案" hidden>
    <header class="rain-center-header">
      <div><span>QINGDAO RAIN PLAN · ${escapeHtml(rainGuide.version)}</span><h2>${escapeHtml(rainGuide.title)}</h2><p>${escapeHtml(rainGuide.principle)}</p></div>
      <button id="rainCenterClose" type="button" aria-label="关闭雨天专栏">×</button>
    </header>
    <div class="rain-center-snapshot">
      <strong>当前天气策略：</strong>${escapeHtml(rainGuide.forecastSnapshot.summary)}
      <small>${escapeHtml(rainGuide.forecastSnapshot.typhoonNote)}</small>
    </div>
    <nav class="rain-center-nav" aria-label="雨天专栏分类">
      <button class="is-active" type="button" data-rain-pane-button="additions">新增计划</button>
      <button type="button" data-rain-pane-button="recommended">雨天可去</button>
      <button type="button" data-rain-pane-button="avoid">避坑</button>
      <button type="button" data-rain-pane-button="beaches">浴场封海</button>
      <button type="button" data-rain-pane-button="sources">资料边界</button>
    </nav>
    <div class="rain-center-scroll">
      <section class="rain-center-pane" data-rain-pane="additions">
        <div class="rain-section-heading"><span>01</span><div><small>ADDED TO PLAN</small><h3>新增地点与体验</h3></div></div>
        <div class="rain-center-grid">${rainGuide.tripAdditions.map(additionCard).join('')}</div>
      </section>
      <section class="rain-center-pane" data-rain-pane="recommended" hidden>
        <div class="rain-section-heading"><span>02</span><div><small>RAINY PLAN B</small><h3>雨天可去：按条件，不照搬短视频</h3></div></div>
        <div class="rain-level-grid">${rainGuide.rainLevels.map((item) => `<article><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.strategy)}</p></article>`).join('')}</div>
        <div class="rain-center-grid">${rainGuide.uploadedScreenshotGuide.recommendedWithConditions.map(recommendationCard).join('')}${rainGuide.additionalIndoorBackups.map(indoorCard).join('')}</div>
      </section>
      <section class="rain-center-pane" data-rain-pane="avoid" hidden>
        <div class="rain-section-heading"><span>03</span><div><small>NO-GO / LOW VALUE</small><h3>雨天避坑与安全覆盖规则</h3></div></div>
        <div class="rain-upload-note">${escapeHtml(rainGuide.uploadedScreenshotGuide.source)}</div>
        <div class="rain-center-grid">${rainGuide.uploadedScreenshotGuide.avoidOrLowValue.map(avoidCard).join('')}</div>
      </section>
      <section class="rain-center-pane" data-rain-pane="beaches" hidden>
        <div class="rain-section-heading"><span>04</span><div><small>BEACH LIVE CHECK</small><h3>9处海水浴场 · 服务时段与实时封海核验</h3></div></div>
        <div class="rain-beach-warning"><strong>最近核验 ${escapeHtml(checkedAt)}</strong><p>${escapeHtml(rainGuide.beachStatus.publicWebFinding)}</p><p><b>实时查询：</b>${escapeHtml(rainGuide.beachStatus.liveCheckRule)}</p></div>
        <div class="rain-beach-table-wrap"><table class="rain-beach-table"><thead><tr><th>浴场</th><th>8/9–8/15</th><th>8/16</th><th>当日封海</th><th>电话</th></tr></thead><tbody>${beachRows()}</tbody></table></div>
        <div class="rain-live-examples"><strong>为什么必须当天再查：</strong><ul>${rainGuide.beachStatus.examplesWhyLiveCheckMatters.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>${externalLink(rainGuide.beachStatus.officialScheduleSource, '查看2026官方浴场开放时间')}</div>
      </section>
      <section class="rain-center-pane" data-rain-pane="sources" hidden>
        <div class="rain-section-heading"><span>05</span><div><small>EVIDENCE</small><h3>资料分层与信息边界</h3></div></div>
        <div class="rain-source-policy"><b>官方来源</b>决定开放、安全与营业；<b>用户上传截图/短链</b>用于体验偏好和避坑。短链读不到的门店地址、菜单、价格不补写成“已确认事实”。</div>
        <ul class="rain-source-list">${sourceRows()}</ul>
      </section>
    </div>
  </aside>`;
}

function setPane(name: string): void {
  document.querySelectorAll<HTMLElement>('[data-rain-pane]').forEach((pane) => {
    pane.hidden = pane.dataset.rainPane !== name;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-rain-pane-button]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.rainPaneButton === name);
  });
}

function mountRainCenter(): void {
  if (document.getElementById('rainCenterTrigger')) return;
  const host = document.createElement('div');
  host.id = 'rainCenterHost';
  host.innerHTML = renderCenter();
  document.body.append(host);

  const trigger = document.getElementById('rainCenterTrigger');
  const panel = document.getElementById('rainCenterPanel');
  const close = document.getElementById('rainCenterClose');
  if (!(trigger instanceof HTMLButtonElement) || !(panel instanceof HTMLElement) || !(close instanceof HTMLButtonElement)) return;

  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('rain-center-is-open', open);
    if (open) panel.querySelector<HTMLElement>('button, a')?.focus({ preventScroll: true });
    else trigger.focus({ preventScroll: true });
  };

  trigger.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  panel.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-rain-pane-button]');
    if (button?.dataset.rainPaneButton) setPane(button.dataset.rainPaneButton);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountRainCenter, { once: true });
} else {
  mountRainCenter();
}
