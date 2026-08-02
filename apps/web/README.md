# Qingdao v3 sidecar Web

Phase 4 候选内容治理与完整编辑闭环的旁路 Web 应用。它使用共享 Schema、Planner、Provider ports 与地图 RenderModel，提供：

- 1–3 天输入，以及必去／想去／可选／不去选择；
- 确定性日程生成、午休插入和风险说明；
- 日程与 SDK 无关地图预览联动；
- 同日／跨日拖动和无障碍按钮重排，并只重算受影响日期；
- 运行时高德搜索与 49 点离线降级、自定义地点和日程模块；
- 批量移动、优先级、锁定、停用、删除与恢复；
- Logo、五种独立编号模式和不影响路线计算的 RouteStyle；
- 基于显式正向／逆向 Command 的持久化撤销与重做；
- IndexedDB 多计划、快照、归档、软删除、原子保存和导入导出；
- 住宿区域初筛、打印与分享。

它不会注册 Service Worker、修改仓库根 `index.html`、替换 GitHub Pages 或删除 Legacy v2.5.4。当前地图只展示 SDK 无关 RenderModel，不提供真实底图或真实道路路线；住宿结果也只做明确标注的直线距离初筛。高德 JS SDK 只能由部署环境注入，v3 不复制 Legacy 前端密钥。
