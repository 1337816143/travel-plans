# @qingdao/content

承载经过运行时 Schema 校验的青岛内容候选、Legacy 只读迁移、服务点候选、分类、季节信息、动态新鲜度、研究批次、更新任务、可编辑模块／预设和发布／回滚门禁。候选目录不得把历史快照或运行时查询入口升级成已审核事实。

当前 `QINGDAO_CONTENT_CATALOG` 是 `review-required` 候选包，不是正式发布包。`createContentRelease` 会拒绝未人工审批或仍有冲突的目录。实时天气、路况、班次、库存与当日价格不进入固定内容。

主要入口：

- `catalog.ts`：唯一青岛候选目录和按 ID 查询；
- `classification.ts`：49 个既有点位的 facet 分类与缺口计算；
- `batch-workflow.ts`：内容批次状态机；
- `freshness.ts`：动态观察和来源新鲜度；
- `updates.ts`：只产生待审结果的更新任务契约；
- `release.ts`：人工审批后的发布 manifest 与回滚。
