# 稳定端点 ID 实现

## 存储与配置

- 数据库 v14 增加 `endpoints.uid`、唯一索引并为旧端点生成 UUID
- 数据库 v15 重建 `daily_stats`，增加 `daily_stats.endpoint_id` 和 `request_logs.endpoint_id`
- 每个迁移脚本与 `schema_version` 在同一事务中原子提交
- 配置导出写入 `id`；旧 v1 配置缺失 ID 时生成 UUID
- 配置导入拒绝非法/重复 ID；同名跨设备端点保留本地 UUID
- WebDAV 临时备份先迁移到当前结构，端点和新统计按本地 UUID 映射合并

## 运行期

- 协议轮换器保存 UUID，不保存名称或数组下标
- 熔断器、在途请求取消和当前端点状态以 UUID 为键
- `ProxyStatus` 同时返回 `currentEndpointId` 和展示名称 `currentEndpoint`
- 端点健康信息返回 `endpointId`

## 统计与前端

- 请求事件、请求日志、日聚合和端点周期统计携带 `endpointId`
- 聚合冲突键为 `(endpoint_id, date, device_id)`，改名时更新名称快照
- 查询过滤、历史删除、表格 key、实时高亮和健康态匹配全部使用 UUID

## 验证

- `cargo test --manifest-path src-tauri/Cargo.toml --lib`
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest run`
