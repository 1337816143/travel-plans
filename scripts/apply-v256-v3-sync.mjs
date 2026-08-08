import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve(import.meta.dirname,'..');
function patch(file,transform){const target=path.join(ROOT,file),source=fs.readFileSync(target,'utf8'),next=transform(source);if(next===source)throw new Error(`No change applied to ${file}`);fs.writeFileSync(target,next)}
function replaceRequired(source,from,to,label){if(!source.includes(from))throw new Error(`Missing ${label||from}`);return source.replace(from,to)}

patch('apps/web/src/view.ts',source=>{
  const oldRoute=`function routeBefore(day: TripDay, item: TripItem): string {\n  const route = day.routeSegments.find((segment) => segment.toItemId === item.id);\n  if (!route) return '';\n  return \`\n    <div class="route-before" data-testid="route-segment">\n      <span class="route-dash" aria-hidden="true"></span>\n      <span>步行降级估算 · \${(route.distanceMeters / 1000).toFixed(1)} km · \${minuteLabel(route.durationMinutes)}</span>\n      <span class="estimate-chip">低置信度</span>\n    </div>\`;\n}`;
  const newRoute=`function routeBefore(day: TripDay, item: TripItem): string {\n  const route = day.routeSegments.find((segment) => segment.toItemId === item.id);\n  if (!route) return '';\n  if (route.estimated || route.provider === 'straight-line-fallback') {\n    return \`\n      <div class="route-before" data-testid="route-segment">\n        <span class="route-dash" aria-hidden="true"></span>\n        <span>真实道路路线未接入当前自定义侧栏，不展示直线里程／耗时</span>\n        <span class="estimate-chip">等待高德 Provider</span>\n      </div>\`;\n  }\n  return \`\n    <div class="route-before" data-testid="route-segment">\n      <span class="route-dash" aria-hidden="true"></span>\n      <span>\${route.mode} · \${(route.distanceMeters / 1000).toFixed(1)} km · \${minuteLabel(route.durationMinutes)}</span>\n      <span class="estimate-chip">真实 Provider</span>\n    </div>\`;\n}`;
  source=replaceRequired(source,oldRoute,newRoute,'routeBefore fallback block');
  source=source.replace('独立打开 v2.5.4','独立打开 v2.5.6');
  source=source.replace('完整 v2.5.4 基线保持不变 · 新功能独立分层 · 数据版本 legacy-v2.5.4-review-required','当前完整攻略 v2.5.6 · 冻结回滚基线 v2.5.4 保持不变 · 数据版本 legacy-v2.5.4-review-required');
  source=source.replace('v2.5.4 完整产品基线','v2.5.6 当前完整攻略');
  source=source.replace('下方直接运行冻结的 v2.5.4 完整页面，不是内容摘录或静态截图。','下方直接运行当前 v2.5.6 完整页面，不是内容摘录或静态截图；冻结 v2.5.4 仍作为独立回退。');
  source=source.replace('aria-label="v2.5.4 完整数据对账"','aria-label="v2.5.6 完整数据对账"');
  source=source.replace('aria-label="v2.5.4 完整攻略与真实地图"','aria-label="v2.5.6 完整攻略与真实地图"');
  source=source.replace('精确加载冻结版 v2.5.4','当前线上 v2.5.6 · v2.5.4 可回退');
  source=source.replace('title="青岛旅行规划 v2.5.4 完整攻略与真实地图"','title="青岛旅行规划 v2.5.6 完整攻略与真实地图"');
  source=source.replace('这里保留 v2.5.4 的原始交互和本机数据；如需全屏地图，可在新标签页独立打开。','这里运行当前 v2.5.6 的完整交互和本机数据；如需全屏地图，可在新标签页独立打开。');
  source=source.replace('全屏打开稳定版 v2.5.4','全屏打开当前 v2.5.6');
  source=source.replace('v2.5.4 的攻略、真实地图与旅行工具继续完整保留；','v2.5.6 的攻略、真实地图与旅行工具继续完整保留；');
  source=source.replace('当前自定义路线仍明确显示为低置信度直线降级，接入真实道路 Provider 前不会冒充步行或驾车路线。完整高德路线、天气与路况继续保留在“完整攻略”。','当前自定义侧栏未取得真实道路 Provider 时不再显示直线里程／耗时；完整攻略 v2.5.6 已使用高德实际路线、逐小时天气与移动端路线交互。');
  return source;
});

patch('apps/web/index.html',source=>source.replaceAll('v2.5.5','v2.5.6').replaceAll('2.5.5','2.5.6'));
patch('apps/web/rain.html',source=>{
  source=source.replaceAll('根站 v2.5.5','根站 v2.5.6');
  const marker="        document.getElementById('rain-page').innerHTML=`";
  if(!source.includes(marker))throw new Error('rain render marker missing');
  const endPattern=/document\.getElementById\('rain-page'\)\.innerHTML=`[\s\S]*?`;\n/;
  const match=source.match(endPattern);if(!match)throw new Error('rain render assignment missing');
  const appendix=`\n        const official=data.officialOperations||{};\n        if((official.beaches||[]).length||(official.scenicAndIndoor||[]).length){\n          const section=document.createElement('section');section.dataset.section='official-status';\n          const beachCards=(official.beaches||[]).map((x)=>\`<article class="card"><h3>\${esc(x.name)}</h3><div class="pills"><span class="pill good">官方开放季／服务时段已公布</span><span class="pill warn">现场旗语当天核实</span></div><p>\${esc(x.tripWindowHours||'')}</p><p><b>电话：</b>\${esc(x.phone||'')}</p></article>\`).join('');\n          const scenicCards=(official.scenicAndIndoor||[]).map((x)=>\`<article class="card"><h3>\${esc(x.name)}</h3><div class="pills"><span class="pill good">\${esc(x.officialPublishedState||'官方状态已核验')}</span></div><p>\${esc(x.hours||'')}</p><p>\${esc(x.note||x.address||'临时调整以官方当天公告为准')}</p>\${x.source?\`<div class="actions">\${link(x.source,'官方来源')}</div>\`:''}</article>\`).join('');\n          section.innerHTML=\`<div class="section-head"><div><span class="eyebrow">OFFICIAL STATUS · \${esc(official.checkedAt||'')}</span><h2>浴场／景区官方开关状态</h2></div><span>官方营业制度与开放季可以核验；现场红旗、广播、恶劣天气和临时关闭公告仍具有更高优先级。</span></div><h3>9处海水浴场</h3><div class="grid">\${beachCards}</div><h3 style="margin-top:22px">主要景区与室内场馆</h3><div class="grid">\${scenicCards}</div>\`;\n          document.getElementById('rain-page').appendChild(section);\n        }\n`;
  source=source.replace(match[0],match[0]+appendix);
  return source;
});
patch('apps/web/src/rain-entry.ts',source=>source.replace("CURRENT_GUIDE = 'v2.5.5'","CURRENT_GUIDE = 'v2.5.6'"));

patch('scripts/package-v3-pages.mjs',source=>{
  source=replaceRequired(source,"const rainOps = JSON.parse(\n  fs.readFileSync(path.join(repositoryRoot, 'data/qingdao/rain/current-ops-2026-08-08.json'), 'utf8'),\n);","const rainOps = JSON.parse(\n  fs.readFileSync(path.join(repositoryRoot, 'data/qingdao/rain/current-ops-2026-08-08.json'), 'utf8'),\n);\nconst officialOperations = JSON.parse(\n  fs.readFileSync(path.join(repositoryRoot, 'data/qingdao/ops/current-status-2026-08-09.json'), 'utf8'),\n);",'rain ops load');
  source=replaceRequired(source,'  sourceNotes: rainSources,','  sourceNotes: rainSources,\n  officialOperations,','rain guide merge');
  source=source.replace("currentGuideVersion: 'v2.5.5'","currentGuideVersion: 'v2.5.6'");
  source=source.replace("workspaces: ['complete-v2.5.5-guide', 'rain-contingency', 'custom-planner']","workspaces: ['complete-v2.5.6-guide', 'rain-contingency', 'custom-planner']");
  source=source.replace("source: 'data/qingdao/rain/rain-guide.v1.json + current-ops-2026-08-08.json'","source: 'rain-guide.v1.json + current-ops-2026-08-08.json + current-status-2026-08-09.json'");
  return source;
});

patch('scripts/validate-v3-pages.mjs',source=>{
  source=source.replaceAll("currentGuideVersion: 'v2.5.5'","currentGuideVersion: 'v2.5.6'");
  source=source.replaceAll('content="2.5.5"','content="2.5.6"');
  source=source.replaceAll("'根站 v2.5.5'","'根站 v2.5.6'");
  source=source.replace("<meta name=\"travel-map-version\" content=\"2.5.5\">","<meta name=\"travel-map-version\" content=\"2.5.6\">");
  source=source.replace("candidates=['2.5.5','2.5.4','1.0.15']","candidates=['2.5.6','2.5.5','2.5.4','1.0.15']");
  source=source.replaceAll('v2.5.5 root','v2.5.6 root');
  source=source.replaceAll('serves v2.5.5','serves v2.5.6');
  const check="if (rainGuide.beachStatus?.beaches?.length !== 9) {";
  if(!source.includes(check))throw new Error('v3 rain guide check missing');
  source=source.replace(check,"if (rainGuide.officialOperations?.beaches?.length !== 9) {\n  throw new Error('v3 rain guide must include the current official operation snapshot for nine beaches.');\n}\nif (!rainGuide.officialOperations?.scenicAndIndoor?.some((item) => item.id === 'laoshan')) {\n  throw new Error('v3 rain guide lost the current official scenic-area status snapshot.');\n}\n"+check);
  return source;
});

patch('scripts/check-v3-v2-parity.mjs',source=>source.replace("CURRENT_GUIDE = 'v2.5.5'","CURRENT_GUIDE = 'v2.5.6'").replace('v2.5.4 rollback → v2.5.5/v3 parity passed','v2.5.4 rollback → v2.5.6/v3 parity passed'));
patch('tests-v3/phase2-web.spec.js',source=>source.replaceAll('v2.5.5','v2.5.6').replace("candidates=['2.5.6','2.5.4','1.0.15']","candidates=['2.5.6','2.5.5','2.5.4','1.0.15']"));
patch('tests-v3/rain-contingency.spec.ts',source=>source.replace("toContainText('v2.5.5')","toContainText('v2.5.6')").replace("await expect(page.locator('.live-rule')).toContainText('未发现2026-08-08针对九处浴场的统一当日临时关闭公告');","await expect(page.locator('[data-section=\"official-status\"]')).toContainText('浴场／景区官方开关状态');\n  await expect(page.locator('[data-section=\"official-status\"]')).toContainText('崂山风景区');"));
console.log('Applied v2.5.6 → v3 current-guide synchronization.');
