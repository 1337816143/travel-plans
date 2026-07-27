# GitHub Pages 分支发布

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- 公开地址：`https://1337816143.github.io/travel-plans/`
- 当前正式版本：`v1.0.15`
- 稳定回退版本：`v1.0.14`

主入口优先加载 v1.0.15，载荷失败时回退 v1.0.14。

## v1.0.15
- 已在高德底图时，再次调用高德服务不会重建标注或重新适配视野。
- 实时路况开关保存并恢复当前中心与缩放级别。
- 地图助手关闭时不主动发起详细道路态势请求，减少 API 配额消耗。
