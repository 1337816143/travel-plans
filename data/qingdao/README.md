# Qingdao data only

本目录只保存青岛稳定攻略、季节信息、动态观测、点位、日程模块、预设、住宿、美食、购物、预约、来源和研究批次。任何新增数据都必须通过运行时 Schema；未经审核的研究结果不得进入正式发布包。

Phase 4 候选数据位于 `content/phase4-candidate.v1.ts`。该文件通过 `ContentCatalogSchema` 在加载时校验，当前状态固定为 `review-required`；不要手工改成 `approved` 或 `published`，审批必须记录审核人、时间、冲突处理与发布 manifest。
