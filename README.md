# 青岛旅游规划（Qingdao Travel Plans）

本仓库只服务于青岛旅游攻略与行程规划，不是全球旅游平台。

## 当前正式版本

- 正式版本：v2.5.4
- 正式入口：`index.html`
- 线上页面：https://1337816143.github.io/travel-plans/
- 可编辑事实源：`src-v2/`
- v2.5.4 固定快照：`src/v2.5.4.html`、`versions/2026-07-31-v2.5.4.html`
- 稳定回退：v1.0.15（`versions/2026-07-27-v1.0.15.html`）
- 基线提交：`95ecff2595c02cf550bada9ab5c318ee97768699`

v2.5.4 仍是正式产品，包含固定 8 日舒适行程、完整攻略内容、Leaflet／OpenStreetMap、高德地图与路线服务、旅行工具、本地状态、离线缓存和多设备适配。不要直接在生成后的 `index.html`、`src/v2.5.4.html` 或压缩 payload 中开发新功能。

## v3 完整攻略＋自定义规划

v3 采用分层架构，让未来 Web 和小程序共享青岛领域模型、运行时 Schema、Planner 契约和版本迁移，同时保持 v2 构建链独立可回退。`/v3/` 不是删减版页面：默认“完整攻略”工作区直接运行冻结的根入口，由其加载经哈希核对的 v2.5.4 payload，并保留 v1.0.15 fallback；49 个运行时点位、8 天日程、真实 Leaflet／高德地图、预约、住宿、美食、天气、路线、旅行工具、本机状态与离线回退均可直接使用。“自定义规划”工作区在此基础上增加 Planner，并在编辑器内使用真实 Leaflet 多底图，不再使用无底图示意图。

Phase 4 候选内容闭环仍包括 49 个现有点位分类、17 个日程模块、17 套可编辑预设、来源／推广风险、季节信息、更新任务、人工审核状态机以及发布／回滚门禁。v2.5.4 的 24 项来源、8 项预约、3 家候选酒店、17 项必去、10 个愿望地图点和 12 项必吃必买已通过只读快照逐项迁入候选目录；另有 3 个医院锚点和药店／厕所／停车／充电 4 类运行时服务候选。候选内容仍为 `review-required`，不能视为人工审核完成。自定义规划器中的路线和住宿距离仍明确标为直线降级；完整高德路线、天气和路况由“完整攻略”继续提供，直至新的 Provider 达到替换门禁。

- Web／小程序入口占位：`apps/`
- 共享包：`packages/`
- 版本化青岛数据：`data/qingdao/`
- v2.5.4 迁移边界：`legacy/v2.5.4/`
- 审计与保留矩阵：`docs/audit/`
- 架构决策：`docs/architecture/adr/`
- Phase 4 内容差距：`docs/audit/phase4-content-gap-report.md`
- v3 独立预览与回滚：`docs/deployment/v3-sidecar-preview.md`

## 验证

```bash
npm ci
npm run validate:v2
npm run inspect:v2
npm run validate:v3
npm run test:e2e
npm run test:e2e:v3
```

`validate:v3` 是只读门禁；它不得修改手写源码或提交生成文件。Playwright 需要预先安装 Chromium 和 WebKit。

## 信息边界

固定地址、长期交通关系和攻略说明可以作为版本化内容发布；天气、路况、班次、票价、房价、库存、营业状态等动态或实时信息必须保留来源与观测时间，并在运行时重新核验。前端不得伪造实时值，也不得把公开密钥继续扩散到新的 v3 服务。
