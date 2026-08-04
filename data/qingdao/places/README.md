# Qingdao places

每个正式点位文件必须通过 `PlaceSchema`。`signal-hill-west-gate.v1.json` 是首个经过人工补足地址、分区和推荐时长的纵向样本。

`imports/legacy-v2.5.4-runtime-points.v1.json` 是从 canonical v2 模块确定性提取的只读迁移快照：39 个主点位加 10 个必吃必买地图点，共 49 个运行时点位。CI 会重新执行 v2 模块并逐字检查快照是否漂移。

全量快照及其迁移结果一律为 `review-required`：缺失地址、分区和推荐时长保持 `null` / `unknown`，动态观测保持空数组，不能直接进入正式 v3 内容包，也不能据此宣称已完成联网复核。
