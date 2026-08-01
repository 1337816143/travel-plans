# v2.5.4 → v3 差距与风险报告

本报告只分析青岛旅游规划。v2.5.4 的现有功能继续保留；差距是 v3 替换门禁，不是删除清单。

## 总体判断

v2.5.4 已从早期单文件逐步拆出数据、地图、服务、状态和 UI 模块，但运行时仍以 Legacy 全局变量和 DOM 协作为中心。它适合继续作为稳定产品与迁移样本，不适合作为自由规划器、多个计划、共享小程序核心的直接宿主。正确路径是旁路建立纯 TypeScript 领域核心，再按功能矩阵逐项迁移。

## 分领域差距

| 领域           | 当前事实                                                                                            | 关键差距                                                                                                               | 本 PR 边界                                                            | 进入下一阶段的证据                                                      |
| -------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 数据           | 39 主要点＋10 愿望地图点，JS 常量经构建校验                                                         | 缺运行时 Schema；稳定、季节、动态、实时混在同类字段；缺 `observedAt`／TTL／审核批次                                    | 建立 Place、SourceRef、DynamicObservation Schema，并迁入 1 个现有点位 | 全量迁移脚本、错误路径、来源审核和计数对账                              |
| 状态           | 有 `TravelStore`、selectors、VersionedStorage 兼容桥                                                | 检出约 79 个 `window.*` 标识；地图实例、DOM 与业务状态仍耦合；固定 `SCHEDULES` 是事实中心                              | 新包禁止 DOM／SDK／全局变量；只通过参数与返回值                       | Command／Event／Selector 不变量和依赖边界测试                           |
| 地图           | Leaflet 与高德双 adapter、多底图、cluster、路线、联动成熟                                           | adapter 仍读取全局地图实例和 Legacy 函数；Marker Logo／编号无独立领域模型；无小程序 adapter 合约                       | 建立 MarkerStyle／RouteStyle／RouteSegment 契约占位                   | 100／300／500 点 PoC、动态编号、拖动后增量 RenderModel                  |
| Provider       | 有高德 search／around／route／weather／traffic／geo，Open-Meteo 风险数据，统一 success/failure 外形 | Web key 与 security code 明文在 Legacy；结果无统一运行时 Schema、TTL、置信度和可持久化策略；JSONP 增加攻击面           | 不移除 Legacy 凭据，不在 v3 扩大使用；建立 ProviderResult Schema      | 服务端／网关方案 ADR、契约测试、超时／失败／过期测试                    |
| 存储           | 多数小状态用 LocalStorage envelope；GPX 轨迹优先 IndexedDB；支持 JSON 导入导出                      | 没有多计划数据库；Schema 版本不统一；导入是逐键写入、非事务；损坏数据没有隔离／只读预览；LocalStorage 容量有限         | 建立 StorageEnvelope／ImportBundle Schema 与接口边界                  | IndexedDB adapter、原子事务、迁移、损坏隔离和恢复测试                   |
| 构建           | `src-v2/` 可复现生成 v2 页面；已有数据、架构、payload、E2E 门禁                                     | 审计前无 lockfile；v2 build workflow 有 `contents: write` 且会提交生成物；部分旧 workflow 固定分支；内部版本字符串漂移 | 保持 v2 链不变；v3 使用 lockfile和只读验证 workflow                   | `npm ci`、干净工作区检查、secrets 扫描、bundle budget                   |
| Service Worker | v2.5.4 cache 与 v1.0.15 回退明确；有更新提示和手动离线准备                                          | network-first 会异步写缓存且不检查响应类型；激活会删除所有其他 `travel-plans-*` cache；v3 若共用前缀会互相清理         | v3 不注册或修改 SW                                                    | 独立 cache namespace、升级／降级／离线 E2E                              |
| 小程序         | 仓库保存 v1.0.7 原生微信小程序 ZIP 文本分片；有腾讯地图、固定点位／路线／搜索／预约状态             | 版本落后 v2.5.4；只有一个页面；无共享 TS 包、Planner、Schema、迁移、自动化测试；AppID 是 `touristappid`                | 新建 `apps/mini-program` PoC 边界，不选择跨端框架                     | 地图、Marker、cluster、polyline、选点、排序、存储、分包、分享和性能 PoC |

## 数据与内容边界

1. `POINTS.status`、`time`、酒店评分／价格文案和预约说明没有统一新鲜度元数据。迁移时只能标为 imported 或 review-required，不能自动声称当前有效。
2. 社交平台来源目前以摘要和链接存在，但没有 `promotionalRisk`、独立证据数、冲突标志和审核记录。正式内容批次必须补齐，疑似推广不能单独升级为推荐。
3. 地址、坐标与长期攻略可进入稳定数据；天气、路况、班次、房态和排队只能由运行时 Provider 返回。
4. 当前点位同时保存 WGS84 页面坐标和高德核验说明。v3 必须让坐标系成为显式字段，并对 WGS84／GCJ-02 转换做属性测试。

## 状态与存储清单

Legacy 状态至少覆盖：预约进度、预设顺序、底图与面板偏好、地图视图、天气快照、提醒、愿望清单、站点状态、交通段修正、风险缓存、费用、操作历史、可用性复核、工具折叠状态、愿望地图模式、GPX 轨迹和离线 cache。现有前缀包括 `qingdao-v107-*`、`travel-plans-*`、`trip-*`。

这些状态是迁移输入，不是 v3 数据库设计。v3 计划主体应使用 IndexedDB／小程序 storage adapter；LocalStorage 只保留小偏好和 Legacy 桥。导入失败不得删除原计划，`replace=true` 的 Legacy API 不能直接复用为 v3 默认行为。

## 风险登记

| ID   | 风险                                               | 级别 | 证据                                                                | 控制与回滚                                                               |
| ---- | -------------------------------------------------- | ---- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| R-01 | 高德 JS key、security code、Web key 在前端明文     | 高   | `src-v2/core/app-state.js`                                          | Legacy 暂留以免线上中断；限制配额／域名；v3 不复制，后续比较网关方案     |
| R-02 | 全局变量与 DOM／地图实例耦合导致增量规划不可测试   | 高   | `app-state.js`、`legacy-app.js`、79 个 `window.*` 标识              | v3 import boundary 测试；不从 domain 引入 SDK／DOM；失败时不接入正式入口 |
| R-03 | 验证 workflow 与发布／提交职责混合                 | 高   | `.github/workflows/build-v2.yml` 有 `contents: write` 和 `git push` | 作为 Legacy 例外登记；v3 validation 只读，发布另建 workflow              |
| R-04 | Service Worker cache 前缀可能清理未来 v3 cache     | 中高 | `service-worker.js` activate handler                                | v3 使用独立 namespace；切换前做升级／回退 E2E；本 PR 不注册 v3 SW        |
| R-05 | 导入非事务且 Schema 版本分散，损坏数据可能部分写入 | 高   | `versioned-storage.js`、`local-data-manager.js`                     | 新 adapter 先校验、隔离、事务写；保留导入前快照                          |
| R-06 | 小程序 v1.0.7 与 Web v2.5.4 功能和数据漂移         | 高   | `wechat-mini-program/source-v1.0.7.zip.b64.*`                       | 不以旧 ZIP 作为共享核心；PoC 后采用平台 UI＋共享包                       |
| R-07 | 动态事实缺观测时间或过期策略                       | 高   | 点位 status／酒店和预约文案                                         | DynamicObservation Schema；过期后显示待复核，不继续当真                  |
| R-08 | v2 payload／fallback 链复杂，误改入口会破坏回退    | 高   | `index.html`、`versions/`、payload validators                       | v3 不触碰正式入口；保持 v2.5.4→v1.0.15 验证                              |
| R-09 | 社交来源可能含推广或错误门店匹配                   | 中高 | recommendations／wishlist platform sources                          | 内容批次记录 promotional risk、冲突、独立证据和人工审核                  |
| R-10 | 审计前无 lockfile，依赖解析不可完全复现            | 中   | 根目录无 `package-lock.json`                                        | 本 PR 生成并提交 lockfile，CI 采用 `npm ci`                              |
| R-11 | WGS84／GCJ-02 转换与路线 Provider 坐标输入可能错配 | 高   | coordinate service、AMap adapters                                   | 坐标系显式化；金样与属性测试；Provider request 记录坐标系                |
| R-12 | 尚无独立 Planner，固定日程不能满足自由规划与解释   | 高   | `SCHEDULES` 是固定数组                                              | Phase 2 前先完成确定性 Planner 输入／输出和不变量，不让 LLM决定事实      |
| R-13 | `APP_VERSION='2.0.0'` 与正式 v2.5.4 身份不一致     | 中   | `src-v2/core/app-state.js`                                          | 单独 Legacy 修复 PR＋全量 E2E；Phase 0 只修 README，不改业务行为         |

## 小程序 PoC 必测清单

在选择 Taro、uni-app 或原生方案前，必须实测：高德／平台地图加载、自定义 Marker、Logo 与编号分层、Marker 聚合、路线折线、方向表达、地图点击选点、100／300／500 点性能、日程触摸排序或等价操作、本地存储与迁移、离线数据、分包、分享以及导入共享 TypeScript 包。框架不能支持时应保留平台专属 UI 和 adapter，不能删减功能。

## Phase 3 后仍未关闭的差距

本 Draft PR 已在旁路完成 Planner 与 Phase 3 编辑器，但不迁移全部青岛攻略数据、不生成正式图标资产、不选定小程序框架、不修改高德凭据、不改 Service Worker、不切换 Pages、不删除 v2.5.4／v1.0.15，也不自动合并。当前路线和住宿时间仍是明确标记的直线降级估算；正式 Provider 网关、完整内容审核批次、Legacy 功能逐项迁移和小程序 PoC 必须继续按 Phase 4–6 门禁推进。
