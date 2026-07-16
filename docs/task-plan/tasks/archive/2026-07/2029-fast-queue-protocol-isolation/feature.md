# 快速队列协议隔离实现

## 落点

- `src-tauri/src/modules/proxy/forward.rs`
  - 统一识别 Claude、OpenAI Chat、OpenAI Responses 三类入站协议
  - 按协议筛选兼容端点后，再应用快速队列和独立排序
  - 增加跨协议快速端点隔离回归测试
- `src-tauri/src/modules/storage/endpoint_repo.rs`
  - 删除协议无关的 `list_routable`
  - 仓储层只返回全部启用端点，协议选路由代理层负责

## 协议兼容关系

| 入站协议 | 可用端点 |
|---|---|
| Claude | Claude、OpenAI Chat |
| OpenAI Chat | OpenAI Chat |
| OpenAI Responses | Codex Responses、OpenAI Chat |

## 验证

- `cargo test --manifest-path src-tauri/Cargo.toml modules::proxy::forward::tests:: --lib`
- `cargo test --manifest-path src-tauri/Cargo.toml modules::storage::endpoint_repo::tests:: --lib`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib`
