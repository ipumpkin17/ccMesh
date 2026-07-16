# 根因

1. 本地配置导出结构缺少 `model_mappings`，导入时映射回落为空数组。
2. WebDAV 合并只处理 `endpoints` 主表，未同步 `endpoint_credentials`。
3. 部分导入/恢复路径没有发出 `endpoints-changed`，前端仍显示旧状态。
