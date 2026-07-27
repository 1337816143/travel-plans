# GitHub Pages 分支发布

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- 公开地址：`https://1337816143.github.io/travel-plans/`
- 当前稳定版本：`v1.0.10`
- 当前入口加载器：`v1.0.12-recovery`

每轮任务只创建一个完整提交并一次性推送。

- `index.html`：优先尝试 v1.0.11；若完整性校验失败，自动回退到 v1.0.10。
- `assets/v1.0.10/`：当前经自动校验可完整解码、解压并生成 HTML 的稳定载荷。
- `assets/v1.0.11/`：已确认损坏，保留用于诊断，不作为正式发布载荷。
- `versions/`：历史版本入口。
- `scripts/validate-v1.0.11-payload.mjs`：扫描历史载荷并确认最近可用版本。
- `.github/workflows/validate-pages-payload.yml`：在入口或载荷变更时执行完整性校验和 JavaScript 语法检查。
- `wechat-mini-program/`：微信小程序工程包，本轮未改动。

## 高德接口

v1.0.11 曾加入高德 JS API 与 Web API 功能，但其压缩载荷已损坏，因此当前线上稳定入口暂时使用 v1.0.10。仓库中的公开接口凭证仍可能被访问者读取，建议继续设置可用域名、额度告警并按需轮换 Key。
