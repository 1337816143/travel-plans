# Qingdao v3 sidecar Web

Phase 3 编辑闭环的旁路 Web 应用。它使用共享 Schema、Planner 与地图 RenderModel，提供：

- 1–3 天输入，以及必去／想去／可选／不去选择；
- 确定性日程生成、午休插入和风险说明；
- 日程与 SDK 无关地图预览联动；
- 同日／跨日拖动和无障碍按钮重排，并只重算受影响日期；
- 基于显式正向／逆向 Command 的会话级撤销与重做；
- IndexedDB 保存、校验和原子导入导出。

它不会注册 Service Worker、修改仓库根 `index.html`、替换 GitHub Pages 或删除 Legacy v2.5.4。当前地图只展示 RenderModel，不提供真实底图或真实道路路线。计划中的审计历史会保存；为避免伪造已完成能力，页面重载后的可执行 Undo／Redo 栈仍明确留在后续存储迁移切片。
