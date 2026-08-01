# @qingdao/providers

路线、搜索、地理编码、天气、路况、班次等 Provider ports 与契约测试。当前最小切片只落地 `RouteProviderPort`；实现必须返回来源、查询时间、有效期、估算标志和失败类型。

失败结果使用严格 Schema，不能附带伪造的距离、时长或折线。坐标系必须显式声明，路线折线必须与起终点一致。新 v3 代码不得复制 Legacy 明文密钥。
