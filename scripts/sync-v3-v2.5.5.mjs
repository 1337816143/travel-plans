import fs from 'node:fs';

const patches={
  'apps/web/index.html':[
    ['青岛旅游规划 v3 完整版预览：完整保留 v2.5.4 攻略、真实地图与旅行工具，并新增可编辑的自定义规划器。','青岛旅游规划 v3 完整版预览：保留 v2.5.4 不可变回滚基线，完整攻略入口同步当前 v2.5.5 雨天备用版，并保留可编辑的自定义规划器。'],
    ['<meta name="qingdao-stable-version" content="2.5.4" />','<meta name="qingdao-stable-version" content="2.5.4" />\n    <meta name="qingdao-current-guide-version" content="2.5.5" />'],
    ['稳定版 v2.5.4 仍可从仓库根地址独立使用。','当前完整攻略 v2.5.5 从根地址运行；v2.5.4 历史版本仍保留为回滚基线。']
  ],
  'apps/web/src/view.ts':[
    ['独立打开 v2.5.4','独立打开当前攻略'],
    ['v2.5.4 完整产品基线','v2.5.5 当前完整攻略'],
    ['下方直接运行冻结的 v2.5.4 完整页面，不是内容摘录或静态截图。真实 Leaflet／高德地图、8 天攻略、预约、住宿、美食、天气、路线和旅行工具全部保留。','下方直接运行当前根攻略 v2.5.5，不是内容摘录或静态截图。它完整继承冻结的 v2.5.4，并新增雨天避坑、9处海水浴场官方时段与实时封海核验说明；真实 Leaflet／高德地图、8天攻略、预约、住宿、美食、天气、路线和旅行工具继续保留。'],
    ['v2.5.4 完整攻略与真实地图','当前完整攻略与真实地图'],
    ['精确加载冻结版 v2.5.4','加载当前 v2.5.5 · v2.5.4 可回滚'],
    ['青岛旅行规划 v2.5.4 完整攻略与真实地图','青岛旅行规划 v2.5.5 完整攻略与真实地图'],
    ['这里保留 v2.5.4 的原始交互和本机数据；如需全屏地图，可在新标签页独立打开。','这里运行当前 v2.5.5 完整攻略并保留原有交互和本机数据；v2.5.4 历史快照仍可独立回滚。'],
    ['全屏打开稳定版 v2.5.4','全屏打开当前攻略 v2.5.5'],
    ['完整 v2.5.4 基线保持不变 · 新功能独立分层 · 数据版本 legacy-v2.5.4-review-required','v2.5.4 回滚基线保持不变 · 当前完整攻略 v2.5.5 仅做加法 · 自定义规划继续独立分层']
  ],
  'README.md':[
    ['- 正式版本：v2.5.4','- 当前完整攻略：v2.5.5（基于冻结 v2.5.4 的加法发布）'],
    ['- v2.5.4 固定快照：`src/v2.5.4.html`、`versions/2026-07-31-v2.5.4.html`','- v2.5.4 固定回滚快照：`src/v2.5.4.html`、`versions/2026-07-31-v2.5.4.html`\n- v2.5.5 当前快照：`src/v2.5.5.html`、`versions/2026-08-08-v2.5.5.html`'],
    ['v2.5.4 仍是正式产品，包含固定 8 日舒适行程、完整攻略内容、Leaflet／OpenStreetMap、高德地图与路线服务、旅行工具、本地状态、离线缓存和多设备适配。不要直接在生成后的 `index.html`、`src/v2.5.4.html` 或压缩 payload 中开发新功能。','v2.5.5 是当前完整攻略入口：严格从冻结 v2.5.4 派生，只新增雨天备用、浴场状态核验与本次补充收藏；v2.5.4 本体仍是不可变回滚基线。不要直接修改生成后的 `index.html`、`src/v2.5.5.html`、冻结的 `src/v2.5.4.html` 或压缩 payload。'],
    ['默认“完整攻略”工作区直接运行冻结的根入口，由其加载经哈希核对的 v2.5.4 payload，并保留 v1.0.15 fallback','默认“完整攻略”工作区直接运行当前根入口，由其优先加载 v2.5.5，并可回退到冻结 v2.5.4 和 v1.0.15']
  ]
};

for(const [file,replacements] of Object.entries(patches)){
  let text=fs.readFileSync(file,'utf8');
  for(const [from,to] of replacements){
    if(text.includes(to))continue;
    if(!text.includes(from))throw new Error(`${file}: sync token missing: ${from}`);
    text=text.replace(from,to);
  }
  fs.writeFileSync(file,text);
  console.log(`synced ${file}`);
}
