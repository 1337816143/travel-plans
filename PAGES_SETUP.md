# GitHub Pages 分支发布

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- 公开地址：`https://1337816143.github.io/travel-plans/`
- 当前正式版本：`v1.0.7`

每轮任务只创建一个完整提交并一次性推送。

- `index.html`：当前网页入口；加载 v1.0.6 基础载荷并应用 v1.0.7 校验补丁。
- `assets/v1.0.6/`：复用的基础页面载荷。
- `assets/v1.0.7/`：v1.0.7 的 gzip/base64 补丁分片。
- `versions/`：历史版本入口。
- `wechat-mini-program/`：微信小程序工程包的文本分片、还原脚本与说明。
