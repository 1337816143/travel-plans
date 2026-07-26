# GitHub Pages 分支发布

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- 公开地址：`https://1337816143.github.io/travel-plans/`
- 当前正式版本：`v1.0.8`

每轮任务只创建一个完整提交并一次性推送。

- `index.html`：当前网页入口；加载 v1.0.6 基础载荷，并应用按 JavaScript UTF-16 位置生成的 v1.0.8 修复补丁。
- `assets/v1.0.6/`：复用的完整基础页面载荷。
- `assets/v1.0.8/`：已校正字符位置单位的 gzip/base64 补丁分片。
- `versions/`：历史版本入口。
- `wechat-mini-program/`：微信小程序工程包。
