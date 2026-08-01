# @qingdao/testing

共享 fixtures、Schema 金样、Planner 属性测试、Provider／Storage 契约测试与功能一致性矩阵工具。

Phase 1 提供 `verifyRouteProviderContract` 和 `verifyRejectedImportIsAtomic`。后续真实高德／网关 Provider、IndexedDB 与小程序存储 adapter 必须复用这些契约，而不是仅让参考 fake 通过。
