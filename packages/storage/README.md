# @qingdao/storage

多计划、快照、导入导出、IndexedDB 和小程序 storage adapters 的端口。导入必须先校验、可预览、可迁移并在失败时保留原数据。

`InMemoryPlanStorage` 是 Phase 1 的平台无关参考实现，用于固定端口语义和运行契约测试；它不是 IndexedDB 或小程序持久化实现。时间和 checksum 由调用方注入，测试结果可复现。
