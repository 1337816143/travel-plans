# ADR-0001：以旁路 Monorepo 建设青岛 v3 共享核心

- 状态：Accepted
- 日期：2026-08-01
- 决策范围：`1337816143/travel-plans` 的青岛旅游规划
- 不在范围：Global-travel-plans、其他城市／国家、正式 Pages 切换、Web 或小程序 UI 框架定案

## 背景

v2.5.4 已具备完整固定 8 日攻略、双地图引擎、Provider 服务、旅行工具和离线能力，但仍以固定 `SCHEDULES`、全局变量、DOM 和地图实例协作为主。直接在生成 HTML 或 Legacy 模块中继续加入自由规划、拖拽、多计划和小程序同步，会让 Planner 无法独立验证，也会增加正式版本回归风险。

## 决策

保留 v2.5.4 为不可变迁移基线，在同一仓库旁路建立 npm workspaces。v3 的 Schema、领域、Planner、内容、Provider 契约、存储契约、地图 RenderModel 和测试模型由 Web 与小程序共享；UI、地图 SDK、文件、导航、分享和平台存储通过 adapter 隔离。

```text
apps/
  web/                  Web UI 与 Web 地图／存储 adapters
  mini-program/         小程序 UI 与平台 adapters；PoC 前不锁框架
  content-admin/        人工研究、审核、发布和回滚入口

packages/
  schema/               Zod 运行时事实源、类型和迁移
  domain/               纯领域模型与命令语义
  content/              青岛内容包与研究批次
  planner/              确定性规划与增量重算
  map-core/             SDK 无关 RenderModel 与编号规则
  providers/            路线、天气、搜索等 ports／契约
  storage/              多计划、快照和迁移 ports
  design-tokens/        跨端视觉 token
  icon-system/          Logo manifest；编号与 Logo 分离
  shared-ui-model/      双端共享 selector／view model
  testing/              fixtures、契约和属性测试工具

data/qingdao/            只包含青岛的版本化内容与观测
legacy/v2.5.4/           迁移边界、证据和回退说明
```

## 依赖规则

1. `schema` 不依赖其他业务包；所有公开输入先通过运行时校验，再推导 TypeScript 类型。
2. `domain` 和 `planner` 只接收数据、ports 和显式参数，不读取 `window`、DOM、地图实例、LocalStorage、IndexedDB 或 `wx`。
3. `map-core` 输出 SDK 无关的 Marker／Polyline RenderModel；Web 和小程序 adapter 再翻译为 Leaflet、高德或平台地图对象。
4. Provider 返回带来源、查询时间、有效期、估算标志和置信度的结果。直线距离只允许用于聚类或明确降级，不能标为真实路线。
5. `apps/*` 可以依赖共享包；共享包不得反向依赖 app。平台实现不得进入 Planner。
6. v3 不读取生成后的 `index.html`、`src/v2.5.4.html` 或 payload。Legacy 导入只能读取 canonical `src-v2/data/` 或明确的迁移快照。
7. 所有新内容限定在青岛行政区和与青岛旅行直接相关的交通／海上线路；接口中的可扩展 ID 不构成全球目的地体系。

## Schema 与迁移

- 使用 Zod 作为运行时事实源，从 Schema 推导类型。
- 主要实体带 `schemaVersion`、`createdAt`、`updatedAt`。
- 迁移函数必须接收显式时间上下文，不在纯迁移内调用 `Date.now()`，保证同一输入产生同一输出。
- 解析错误必须暴露字段路径；不支持的未来版本立即失败，不能静默降级。
- 向后兼容只保证已登记版本；导入先校验和预览，再在事务中写入。失败内容隔离，原计划不删除。

## 内容分层

| 层       | 示例                               | 发布方式                                                   |
| -------- | ---------------------------------- | ---------------------------------------------------------- |
| 稳定攻略 | 名称、坐标、历史特色、长期交通关系 | 审核后的版本化数据包                                       |
| 季节信息 | 浴场季、花期、节庆、日出体验       | 带适用月份或日期范围                                       |
| 动态观测 | 开放时间、票价、预约、门店状态     | SourceRef、observedAt、expiresAt、confidence、reviewStatus |
| 实时信息 | 天气、路况、库存、当日班次         | 仅运行时 Provider，不写成长期事实                          |

内容研究以 batch 为发布单元，状态从 draft／researching 到 approved／published；未经人工审核的数据不能自动进入正式攻略。社交来源必须记录推广风险、独立证据和冲突，不能声称完全识别商家小号。

## Planner 边界

Planner 是纯、确定性、可解释模块。它按输入校验、优先级、地理聚类、真实路线、开放／预约、日期时段、交通、餐休、住宿、体力、天气、Plan B 和不变量验证的顺序执行。相同输入、数据版本、Provider snapshot 和 seed 必须产生相同输出。

LLM 可以帮助整理待审核内容或解释已经计算出的结果，但不能决定真实路线时间、开放时间、票价、库存，也不能把 Provider 失败填成看似真实的数据。

## 地图、Logo 与路线样式

Marker 的语义、Logo、状态和编号分别建模。编号由计划顺序生成，不能永久画进图片。RouteSegment 保存路线计算事实，RouteStyle 只保存颜色、粗细、透明度、线型、箭头和图层等视觉属性；修改样式不能触发或改变 Planner 计算。

正式图标资源晚于 manifest 和接口建设。图标生成不得阻塞架构；进入 manifest 前需要透明背景、小尺寸检查、风格审核、来源／提示词／版本记录和人工选择。

## Web 与小程序

暂不选择跨端 UI 框架。先用 PoC 验证地图、Marker、聚合、polyline、方向、点击选点、100／300／500 点性能、排序、存储迁移、离线、分包、分享和共享 TypeScript 包。如果框架能力不足，采用平台专属 UI＋地图 adapter，不能删字段或降低 Planner 能力。

## 构建、CI 与发布

- 根 workspace 使用 lockfile 和 `npm ci`。
- v3 门禁包含格式、ESLint 零警告、strict TypeScript、Schema／迁移／属性测试和工作区干净检查。
- validation workflow 只有 `contents: read`，不得 commit 或 push；发布 workflow 后续单独设计。
- v3 在功能一致性门禁前不接入根 `index.html` 或 v2 Service Worker，也不切换 Pages。
- 每个阶段保留 v2.5.4 与 v1.0.15 回退；出现问题可 revert v3 提交，不需要重建 Legacy payload。

## 后果

正面结果是：正式 v2 风险被隔离，Planner 可独立测试，Web 与小程序共享业务语义，数据迁移和动态信息边界可审计。代价是：短期存在两套入口，功能迁移需要矩阵和适配器，v3 在达到门禁前不会快速替代现网页面。

## 未选择方案

- 直接重写 v2.5.4：回归面过大，无法保持稳定回退。
- 继续向生成 HTML／payload 添加功能：破坏 canonical source 和可测试性。
- 先锁定跨端框架：尚未验证地图和拖动能力，可能迫使功能缩水。
- 复制 Web Planner 到小程序：会产生语义漂移和两套迁移。
- 让 LLM 直接排真实日程：缺少确定性、事实来源和可重复验证。

## 复审触发条件

Phase 2 最小闭环完成、小程序地图 PoC 完成、需要引入服务端密钥网关或准备切换正式入口时，分别新建 ADR 复审。本 ADR 不授权任何 Pages 切换或发布。
