# @qingdao/map-core

SDK 无关的 Marker、编号和 Polyline RenderModel。当前实现从 `TripPlan` 构建经过运行时校验的地图输入，并保证：

- 编号来自日程顺序，Logo 只引用独立的占位图标 ID；
- 拖动重算后，地图编号和路线段与日程同步；
- 坐标系不匹配或点位缺失时显式失败；
- 降级路线始终携带 Provider、估算状态、置信度和用户可见警告。

地图 SDK 只能在平台适配层消费此模型，不能进入共享核心。
