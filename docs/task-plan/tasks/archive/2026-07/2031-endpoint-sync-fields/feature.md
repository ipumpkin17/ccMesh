# 端点同步字段完整性实现

## 数据契约

- `EndpointExport` 增加：
  - `modelMappings`
  - `fast`
  - `fastSortOrder`
- 继续导出 `models` / `activeModels` / `credentials`

## 后端

- `modules/backup.rs`
  - 导出/导入写入映射与快速队列字段
  - 提供 `build_endpoints_only` / `replace_endpoints` 供后续端点专用同步复用
- `modules/webdav/sync.rs`
  - overwrite/keep 两种策略同步 `endpoint_credentials`
- `commands/backup.rs` / `commands/webdav.rs`
  - 导入与恢复后 `emit(endpoints-changed)`
- `commands/endpoint.rs`
  - create/delete/clone 补齐变更事件

## 验证

- `cargo test --manifest-path src-tauri/Cargo.toml mappings`
- 关键回归：`merge_preserves_models_mappings_and_credentials`
- 重点回归：`model_mappings_roundtrip_via_import`
