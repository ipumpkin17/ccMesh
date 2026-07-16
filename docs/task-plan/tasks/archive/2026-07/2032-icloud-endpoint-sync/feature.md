# iCloud 端点同步实现

## 后端

- `models/icloud.rs`：端点快照与状态 DTO
- `modules/icloud.rs`：
  - 读写 iCloud Drive 文件
  - 内容指纹比较
  - 自动备份 / 推送 / 拉取
  - 空列表覆盖保护
- `commands/icloud.rs`：状态、开关、推送、拉取、自动备份命令
- 复用 `build_endpoints_only` / `replace_endpoints`

## 前端

- 同步页 `ICloudSync`：开关 + 冲突弹窗
- `useICloudEndpointSync`：端点变更 debounce 自动备份，启动/运行中检测差异
- 仅 `IS_MAC` 启用

## 验证

- `cargo test --manifest-path src-tauri/Cargo.toml icloud::`
- `pnpm check:front`
- 本地 `pnpm tauri build` 安装验证
