# GitHub Pages 自动发布状态

GitHub Pages 已于 2026-07-26 启用，发布源为 **GitHub Actions**。

- 当前公开地址：`https://1337816143.github.io/travel-plans/`
- 工作流：`Build and deploy Qingdao travel map`
- 发布分支：`main`
- 当前正式版本：`v1.0.1`

## 自动化规则

1. `main` 分支中的 `index.html`、`versions/**`、`payload/**` 或 Pages 工作流发生变化时，优先由 `push` 事件立即触发部署。
2. 对于可能不触发 Actions 的连接器／GitHub App 提交，工作流每 15 分钟执行一次一致性检查。
3. 定时检查只有在仓库首页与线上首页内容不一致时才重新部署；内容一致时直接结束，不重复发布。
4. 每次部署都会核验页面标题、版本元数据、MarkerCluster 依赖，以及根目录首页与对应历史版本是否逐字节一致。

`Run workflow` 保留为故障排查时的应急入口，日常更新不需要手动运行。
