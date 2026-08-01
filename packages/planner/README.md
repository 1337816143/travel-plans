# @qingdao/planner

Phase 2 的确定性 Planner 与同日增量重算：

- 校验 `TripRequest` 与青岛 `Place` 数据；
- 按地理位置确定性分日、插入午休、生成时间轴；
- 保留必去、想去、可选和排除语义；
- 同日移动后只重算受影响日期，并保留锁定项；
- Provider 未接入时只输出低置信度直线降级估算和明确冲突。

本包不得依赖 DOM、地图 SDK、平台存储或 LLM 事实判断。真实路线 Provider 接入后将替换降级段，但不会改变 Planner 的可解释输出契约。
