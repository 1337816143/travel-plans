# GitHub Pages 分支发布

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- 公开地址：`https://1337816143.github.io/travel-plans/`
- 当前正式版本：`v1.0.10`

每轮任务只创建一个完整提交并一次性推送。

- `index.html`：当前网页入口，直接加载并解压 v1.0.10 完整页面载荷。
- `assets/v1.0.10/`：v1.0.10 完整页面的 gzip/base64 分片，不再依赖多版本字符串补丁链。
- `versions/`：历史版本入口。
- `wechat-mini-program/`：微信小程序工程包。
