# GitHub Pages 分支发布

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- 公开地址：`https://1337816143.github.io/travel-plans/`
- 当前正式版本：`v1.0.12`
- 稳定回退版本：`v1.0.10`

`index.html` 会优先加载 v1.0.12，完整性校验失败时自动回退 v1.0.10。

## 高德接口

- Web JS API Key、安全密钥和 Web API Key 已按用户要求写入前端代码。
- 功能包括高德底图、OSM异常自动切换、天气、输入提示、关键词与周边搜索、定位与坐标转换、逆地理编码、路径规划、交通态势、实时路况图层和静态地图。
- 仓库为公开仓库，凭证可被访问者读取；应在高德控制台设置可用域名、额度告警并监控异常调用。
