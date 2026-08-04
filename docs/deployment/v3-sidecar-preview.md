# v3 独立预览发布与回滚

## 发布边界

- 正式入口保持 `https://1337816143.github.io/travel-plans/`，内容必须继续是 v2.5.4。
- v3 只发布到 `https://1337816143.github.io/travel-plans/v3/`。
- v3 是“完整攻略＋自定义规划”预览：完整攻略精确运行冻结版 v2.5.4；候选编辑内容仍为 `review-required`。
- 自定义规划器必须提供真实 Leaflet 底图；“无真实底图”的示意实现不得通过发布门禁。
- v3 自身不注册新的 Service Worker；“完整攻略”嵌入冻结根入口，并继续使用原有根 `service-worker.js`、v2.5.4 离线缓存及 v1.0.15 fallback。
- 根 `index.html` 不增加跳转或 v3 入口，v3 故障不会阻断正式页面。

## 不可变基线

- v2.5.4 基线提交：`95ecff2595c02cf550bada9ab5c318ee97768699`。
- 专用回滚分支：`archive/v2.5.4-stable`，必须指向上述提交。
- `npm run check:freeze:v2.5.4` 对正式入口、Service Worker、canonical `src-v2/`、v2.5.4／v1.0.15 载荷、版本页面、构建脚本和测试进行聚合 SHA-256 校验。
- `npm run check:parity:v3` 核对完整 v2.5.4 HTML 哈希、49 点／8 天／预约／酒店／来源／愿望内容计数、原版关键功能入口、v3 双工作区和 Planner 真实底图。
- `npm run validate:pages:v3` 同时检查 v3 相对资源、完整攻略嵌入入口、真实地图标识、稳定版返回链接、候选内容标识和禁止由 v3 注册 Service Worker。

## 发布过程

1. 运行 `npm ci`。
2. 运行 `npm run validate:v3`，确定性生成并检查 `v3/`。
3. 运行 `npm run validate:v2`、`npm run inspect:v2` 和双端 Playwright。
4. 确认 PR 相对基线在全部 v2 冻结路径上零差异。
5. GitHub Actions 全绿后使用 merge commit 合并；不 squash、不 rebase、不 force-push。
6. 验证线上根路径仍为 v2.5.4，`/v3/` 默认显示完整攻略，Planner 显示真实瓦片地图，release manifest 与提交一致。

## 回滚

v3 没有替换根页面，因此一般故障只需停止访问 `/v3/`，v2.5.4 始终可用。需要撤销发布时：

1. 对上线 merge commit 创建普通 revert commit；不得重写 `main` 历史。
2. 等待 GitHub Pages 重新发布。
3. 验证 `/v3/` 不再提供预览，根路径仍为 v2.5.4。
4. 极端情况下，以 `archive/v2.5.4-stable` 为事实源创建恢复 PR，并重复 v2 全部门禁；不得直接 force-update `main`。

只要 v2 冻结校验、专用回滚分支或双路径测试任一失败，就不得合并或上线。
