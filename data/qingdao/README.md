# Qingdao data only

本目录只保存青岛稳定攻略、季节信息、动态观测、点位、日程模块、预设、住宿、美食、购物、预约、来源和研究批次。任何新增数据都必须通过运行时 Schema；未经审核的研究结果不得进入正式发布包。

Phase 4 候选数据位于 `content/phase4-candidate.v1.ts`。该文件通过 `ContentCatalogSchema` 在加载时校验，当前状态固定为 `review-required`；不要手工改成 `approved` 或 `published`，审批必须记录审核人、时间、冲突处理与发布 manifest。

Legacy v2.5.4 内容快照位于 `content/imports/legacy-v2.5.4-content.v1.json`，只能由 `scripts/snapshot-v2-content.mjs` 从四个 canonical Legacy 数据模块生成。`validate:v3` 以只读方式核对 24 项来源、8 项预约、3 家酒店、17 项必去、10 个愿望地图点和 12 项必吃必买，防止新旧目录静默漂移。

服务点位于 `content/service-points-candidate.v1.ts`。固定医院候选使用 WGS84；药店、厕所、停车和充电只保存运行时检索规则，不得为了补齐类别而写入未经核验的固定商户或坐标。
