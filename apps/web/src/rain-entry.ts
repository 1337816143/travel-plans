const CURRENT_GUIDE = 'v2.5.5';
const ROLLBACK_GUIDE = 'v2.5.4';

function replaceText(root: ParentNode, from: string, to: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.includes(from)) node.textContent = node.textContent.replaceAll(from, to);
    node = walker.nextNode();
  }
}

function installRainEntry(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const nav = app.querySelector<HTMLElement>('.workspace-nav');
  if (nav && !nav.querySelector('[data-rain-guide-entry]')) {
    const entry = document.createElement('a');
    entry.href = './rain.html';
    entry.dataset.rainGuideEntry = 'true';
    entry.className = 'rain-guide-nav-entry';
    entry.textContent = '雨天备用';
    entry.setAttribute('aria-label', '打开雨天避坑、备用地点和海水浴场封海专栏');
    const phaseBadge = nav.querySelector('.phase-badge');
    nav.insertBefore(entry, phaseBadge ?? null);
  }

  replaceText(app, '独立打开 v2.5.4', '独立打开 v2.5.5');
  replaceText(app, 'v2.5.4 完整产品基线', 'v2.5.5 当前完整产品');
  replaceText(app, '冻结的 v2.5.4 完整页面', '当前 v2.5.5 完整页面（保留 v2.5.4 冻结回滚）');
  replaceText(app, '精确加载冻结版 v2.5.4', '加载当前 v2.5.5 · v2.5.4 可一键回滚');
  replaceText(app, '完整 v2.5.4 基线保持不变', 'v2.5.4 回滚基线保持不变 · 当前完整攻略 v2.5.5');
  replaceText(app, 'v2.5.4 的攻略、真实地图与旅行工具继续完整保留', 'v2.5.5 的攻略、真实地图、雨天备用与旅行工具继续完整保留');

  const frame = app.querySelector<HTMLIFrameElement>('[data-testid="legacy-v2-frame"]');
  if (frame) frame.title = '青岛旅行规划 v2.5.5 当前完整攻略与真实地图';

  if (!document.getElementById('rain-guide-nav-style')) {
    const style = document.createElement('style');
    style.id = 'rain-guide-nav-style';
    style.textContent = `
      .workspace-nav .rain-guide-nav-entry {
        display:inline-flex;align-items:center;justify-content:center;
        min-height:36px;padding:0 13px;border-radius:999px;
        border:1px solid rgba(99,175,207,.42);background:#eaf6fb;color:#174f68;
        text-decoration:none;font-size:13px;font-weight:800;white-space:nowrap;
      }
      .workspace-nav .rain-guide-nav-entry:hover,
      .workspace-nav .rain-guide-nav-entry:focus-visible {background:#d9f0f8;outline:2px solid #71b7d1;outline-offset:2px}
    `;
    document.head.append(style);
  }
}

let scheduled = false;
function scheduleInstall(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    installRainEntry();
  });
}

const observer = new MutationObserver(scheduleInstall);
const app = document.getElementById('app');
if (app) observer.observe(app, { childList: true, subtree: true });
installRainEntry();

window.addEventListener('hashchange', scheduleInstall);

export const rainGuideVersionBoundary = Object.freeze({
  current: CURRENT_GUIDE,
  rollback: ROLLBACK_GUIDE,
});
