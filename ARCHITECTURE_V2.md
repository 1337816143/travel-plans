# 青岛旅行计划 v2 架构与稳定版本策略

## 1. v1.0.15 永久保留

- 生产提交：`d7d4266bd14cb8bdb89b8b03ce02720baf999512`
- 固定归档分支：`archive/v1.0.15-stable`
- 独立历史入口：`versions/2026-07-27-v1.0.15.html`
- 独立载荷：`assets/v1.0.15/payload-0.b64` 至 `payload-3.b64`
- 源码快照：`src/v1.0.15.html`

归档分支不接受功能提交。优化分支失败、视觉效果不满意或上线后出现兼容问题时，可以直接从归档分支恢复，或使用固定历史入口调用 v1.0.15。

## 2. v2 与生产版本隔离

- 优化分支：`agent/v2-modular-optimization`
- 草稿 PR：#7
- v2 在 PR 合并前不改变 `main` 和线上 v1.0.15。
- v2 的入口、压缩载荷、Service Worker 和历史页只在优化分支生成。

## 3. 唯一源码入口

v2 构建只读取 `src-v2/`，不再解压上一版本的发布载荷作为开发源码。

```text
src-v2/
├── template.html             页面结构
├── styles/
│   ├── legacy.css            从 v1.0.15 一次性迁移的完整样式
│   └── optimization.css      v2 新样式
├── startup.js                全局错误边界
├── app/
│   └── legacy-app.js         从 v1.0.15 一次性复制的业务基线
├── core/
│   └── runtime.js            请求、缓存、视野、覆盖物和视口基础设施
├── optimization.js           v2 兼容层和深度优化逻辑
├── boot.js                   唯一启动入口
└── service-worker.js         弱网应用壳
```

`legacy-app.js` 是迁移基线，不再由新版本载荷反向生成。后续功能会逐步从该文件移到 `data/`、`map/`、`services/` 和 `ui/`，但每一步均保持可构建、可测试和可回退。

## 4. 已完成的核心改造

### 异步请求竞态

- `RequestCoordinator` 为搜索联想、地点搜索、周边搜索、天气和详细路况建立独立请求序列。
- 新请求会使同类旧请求失效。
- `fetch` 请求使用 `AbortController`。
- 高德回调写入界面前检查请求是否仍为最新。

### 地图视野状态

- `MapViewState` 保存地图引擎、中心、缩放、选中日期、选中点和路况状态。
- OSM/Leaflet 与高德互相切换时传递当前视野，不再默认执行全量 `fitBounds`。
- WGS84 与 GCJ-02 在引擎切换时进行坐标转换。

### 覆盖物生命周期

- `OverlayManager` 使用命名组管理覆盖物。
- v2 已将服务选点覆盖物接入 `serviceSelection` 组。
- 后续逐步接入 `tripMarkers`、`tripRoutes`、`plannedRoute`、`location` 和 `traffic`。

### 性能与配额

- 详细路况按中心、半径和道路等级缓存 30 秒。
- 天气缓存 5 分钟。
- 详细道路列表只在页面可见时周期刷新。
- 天气数据更新仅替换天气节点，不重建完整日程 DOM。
- `visualViewport` 事件使用 `requestAnimationFrame` 合并。

### 可访问性与弱网

- 地图标注增加键盘焦点、角色和可读名称。
- 动态状态接入 `aria-live`。
- Service Worker 缓存应用壳、行程载荷和固定历史入口，不缓存大规模地图瓦片。

## 5. 质量门禁

每次 v2 提交必须通过：

1. 从 `src-v2/` 可重复构建；
2. 生成 HTML 与四段压缩载荷字节一致；
3. 所有内联 JavaScript 与 Service Worker 语法检查；
4. 请求协调器、地图视野状态和覆盖物管理单元检查；
5. v1.0.15 历史载荷和固定入口检查；
6. Pages 最新载荷和回退顺序检查；
7. Playwright 桌面与移动端布局、侧栏和路况开关回归测试。

## 6. 后续拆分顺序

1. 将地点、日程、酒店和预约数据移动到 `src-v2/data/`；
2. 将 Leaflet 与高德实现移动到 `src-v2/map/` 适配器；
3. 将高德 Web API 与 JS API 调用移动到 `src-v2/services/`；
4. 将日程、路线总览、地图助手移动到 `src-v2/ui/`；
5. 将剩余覆盖物接入命名图层；
6. 在全部浏览器测试通过后，再决定是否将 v2 合并到 `main`。
