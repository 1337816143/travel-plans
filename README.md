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

## v3 旁路建设

v3 采用旁路架构，目标是让 Web 和小程序共享青岛领域模型、运行时 Schema、Planner 契约和版本迁移，同时保持 v2 构建链独立可回退。当前 v3 只是 Phase 1 基础骨架，尚未替换正式入口，也不代表自定义 Planner 已完成。

- Web／小程序入口占位：`apps/`
- 共享包：`packages/`
- 版本化青岛数据：`data/qingdao/`
- v2.5.4 迁移边界：`legacy/v2.5.4/`
- 审计与保留矩阵：`docs/audit/`
- 架构决策：`docs/architecture/adr/`

## 验证

```bash
npm ci
npm run validate:v2
npm run inspect:v2
npm run validate:v3
npm run test:e2e
```

`validate:v3` 是只读门禁；它不得修改手写源码或提交生成文件。Playwright 需要预先安装 Chromium 和 WebKit。

## 信息边界

固定地址、长期交通关系和攻略说明可以作为版本化内容发布；天气、路况、班次、票价、房价、库存、营业状态等动态或实时信息必须保留来源与观测时间，并在运行时重新核验。前端不得伪造实时值，也不得把公开密钥继续扩散到新的 v3 服务。
