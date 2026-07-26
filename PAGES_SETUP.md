# GitHub Pages 分支发布

本仓库采用 GitHub Pages 的简单分支发布模式，不使用自定义部署工作流，也不进行定时轮询。

## Pages 设置

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- 公开地址：`https://1337816143.github.io/travel-plans/`
- 当前正式版本：`v1.0.5`

## 更新规则

1. 每一轮明确的修改任务，在本地完成全部修改、检查和历史版本归档。
2. 同一轮任务只创建一个完整提交，并一次性推送到 `main`。
3. 不把同一轮需求拆成多次推送，避免 Pages 发布不完整的中间状态。
4. 也不跨多轮对话长期合并；下一轮新需求形成下一次独立的原子提交。
5. 推送到 `main` 后，由 GitHub Pages 自动发布根目录的 `index.html`。

## 仓库约定

- `index.html`：当前线上版本入口。
- `versions/`：正式历史版本入口。
- `assets/v1.0.5/`：v1.0.5 页面载荷。
- `.nojekyll`：禁止 Jekyll 改写静态资源路径。