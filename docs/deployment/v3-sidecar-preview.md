# v3 独立预览发布与回滚

## 发布边界

- 正式入口保持 `https://1337816143.github.io/travel-plans/`，内容必须继续是 v2.5.4。
- v3 只发布到 `https://1337816143.github.io/travel-plans/v3/`。
- v3 是 `review-required` 候选编辑器预览，不是正式攻略替换。
- v3 不注册 Service Worker；根 `service-worker.js`、v2.5.4 离线缓存及 v1.0.15 fallback 不变。
- 根 `index.html` 不增加跳转或 v3 入口，v3 故障不会阻断正式页面。

## 不可变基线

- v2.5.4 基线提交：`95ecff2595c02cf550bada9ab5c318ee97768699`。
- 专用回滚分支：`archive/v2.5.4-stable`，必须指向上述提交。
- `npm run check:freeze:v2.5.4` 对正式入口、Service Worker、canonical `src-v2/`、v2.5.4／v1.0.15 载荷、版本页面、构建脚本和测试进行聚合 SHA-256 校验。
- `npm run validate:pages:v3` 同时检查 v3 相对资源、稳定版返回链接、候选内容标识和禁止注册 Service Worker。

## 发布过程

1. 运行 `npm ci`。
2. 运行 `npm run validate:v3`，确定性生成并检查 `v3/`。
3. 运行 `npm run validate:v2`、`npm run inspect:v2` 和双端 Playwright。
4. 确认 PR 相对基线在全部 v2 冻结路径上零差异。
5. GitHub Actions 全绿后使用 merge commit 合并；不 squash、不 rebase、不 force-push。
6. 验证线上根路径仍为 v2.5.4，`/v3/` 返回 200 且 release manifest 与提交一致。

## 回滚

v3 没有替换根页面，因此一般故障只需停止访问 `/v3/`，v2.5.4 始终可用。需要撤销发布时：

1. 对上线 merge commit 创建普通 revert commit；不得重写 `main` 历史。
2. 等待 GitHub Pages 重新发布。
3. 验证 `/v3/` 不再提供预览，根路径仍为 v2.5.4。
4. 极端情况下，以 `archive/v2.5.4-stable` 为事实源创建恢复 PR，并重复 v2 全部门禁；不得直接 force-update `main`。

只要 v2 冻结校验、专用回滚分支或双路径测试任一失败，就不得合并或上线。
