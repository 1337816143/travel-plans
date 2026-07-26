# GitHub Pages 分支发布

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- 公开地址：`https://1337816143.github.io/travel-plans/`
- 当前正式版本：`v1.0.11`

每轮任务只创建一个完整提交并一次性推送。

- `index.html`：当前网页入口，直接加载并解压 v1.0.11 完整页面载荷。
- `assets/v1.0.11/`：v1.0.11 完整页面的 gzip/base64 完整载荷分片。
- `versions/`：历史版本入口。
- `wechat-mini-program/`：微信小程序工程包，本轮未改动。

## 高德接口

- 高德 Web JS API Key、安全密钥和 Web API Key 已按用户要求直接写入前端代码。
- 仓库为公开仓库，因此凭证可被访问者读取并可能被滥用或消耗额度。
- 建议在高德控制台设置可用域名、额度告警，并在出现异常调用时立即轮换 Key。
