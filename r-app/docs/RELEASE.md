# 构建与发布（ccNexus）

> 阶段 11（P11-3）交付物。本文件说明本地/CI 出包流程、更新构件签名与注意事项。
> 应用元信息（productName=ccNexus、identifier=com.ccnexus.desktop、窗口 1200×800/最小 940×600/居中/无边框）、
> 图标（`src-tauri/icons/`）、CSP 与 capabilities 收敛已在 P11-1/P11-2 落地。

## 前置工具

- Rust stable + Cargo（已验证 1.96）
- Node + pnpm（npmmirror registry）
- Windows 打包工具链：WebView2 Runtime、NSIS（`.exe`）/ WiX Toolset v3（`.msi`）
- 跨平台：macOS 需 Xcode CLT；Linux 需 `libwebkit2gtk`、`libappindicator` 等

## 构建命令

```bash
# 前端类型检查 + 构建（已由 beforeBuildCommand 自动触发）
pnpm -C r-app build

# 产出安装包（Windows: nsis + msi；产物在 src-tauri/target/release/bundle/）
pnpm -C r-app tauri build
```

产物位置：`r-app/src-tauri/target/release/bundle/{nsis,msi}/`，主程序 `…/release/ccNexus.exe`。

## 自动更新构件与签名（待分发渠道确定后启用）

`tauri.conf.json` 已设 `bundle.createUpdaterArtifacts: true`，`plugins.updater.{endpoints,pubkey}` 暂留空。
正式发布更新时：

```bash
# 1. 生成签名密钥对（一次）
pnpm -C r-app tauri signer generate -w ~/.tauri/ccnexus.key

# 2. 将公钥填入 tauri.conf.json -> plugins.updater.pubkey
#    将更新服务器地址填入 plugins.updater.endpoints（如 GitHub Releases / 自托管 JSON）

# 3. 构建时提供私钥（否则 createUpdaterArtifacts 会因缺少签名密钥而失败）
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/ccnexus.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<密码>" \
pnpm -C r-app tauri build
```

> 注：在未配置签名密钥的环境中如仅需普通安装包，可临时将 `createUpdaterArtifacts` 置为 `false`。

## 状态

- 配置层（元信息/图标/CSP/capabilities/更新构件开关）已就绪，`cargo check` + `pnpm build` + `pnpm test` 全绿。
- 实际安装包产出与更新构件签名需在具备打包工具链（NSIS/WiX）与签名密钥的构建机 / CI 上执行（参考旧版 `.github/workflows/build.yml`）。
- `endpoints` / `pubkey` 待分发渠道确定后填入。
