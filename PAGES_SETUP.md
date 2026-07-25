# GitHub Pages 一次性启用说明

站点文件、历史版本和部署工作流均已准备完成。当前阻塞点是：仓库的 GitHub Pages 尚未在仓库设置中启用；Actions 的 `GITHUB_TOKEN` 只有 Pages 写入权限，没有启用 Pages 所需的仓库 Administration 写入权限。

## 只需执行一次

1. 打开本仓库 **Settings → Pages**。
2. 在 **Build and deployment** 中将 **Source** 设为 **GitHub Actions**。
3. 打开 **Actions → Build and deploy Qingdao travel map → Run workflow**，选择 `main` 后运行。

工作流会自动：

- 校验根目录 `index.html` 的 SHA-256：`4efe8b275d4d95a1bc93a64cadc5376f7fd728aea797d3300cd70d8fd97b6977`；
- 核对当前正式版与 `versions/2026-07-25-v1.0.0.html` 完全一致；
- 确认四个历史HTML均存在；
- 上传并部署 Pages；
- 请求公开页面，核对标题、MarkerCluster依赖和页面自检文本；
- 将实际结果写入 `DEPLOYMENT.md`。

启用成功后的预期地址：

`https://1337816143.github.io/travel-plans/`
