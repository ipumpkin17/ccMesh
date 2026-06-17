# 需要修复内容批次（端口/单例/图标/弹窗/URL跳转/模型点亮）

## Goal
按 `docs/task-plan/需要修复内容.txt` 的 9 个修复点，修复仪表盘/端点/统计/配置相关缺陷，并新增应用单例与桌面快捷唤起能力。

## Requirements
1. 代理端口正确读取设置端口值（验证 + 回归测试）。
2. 设置端口生效检查（验证）。
3. 新建配置时正确读取端口（验证）。
4. 应用单例：重复启动/点击桌面快捷唤起已有窗口，覆盖 Windows/macOS/Linux。
5. 确认 `src-tauri/icons/icon.icns` 是否生效（验证 + 核对清单）。
6. 历史记录弹窗大数字溢出 → 调整弹层宽度避免裁切。
7. 小窗下弹窗显示不全 → 支持弹窗内滚动。
8. 端点卡片 API URL 可点击在浏览器打开（简单可行则实现，否则说明）。
9. 模型清单点亮态：点亮=对外公布、灰=保留不公布、全不点亮=全部公布（兼容旧数据），可选值，做好回显。

## Acceptance Criteria
- [ ] 端口往返回归测试通过；停机/启动端口与设置一致。
- [ ] 二次启动应用不新开实例，已有窗口被唤起置顶聚焦。
- [ ] 历史记录弹窗大数字不裁切、操作列完整可见。
- [ ] 小窗下端点表单等弹窗可滚动、按钮可达。
- [ ] 端点卡片点击 API URL 调起系统浏览器打开该地址。
- [ ] 端点点亮子集持久化并回显；`/v1/models` 与前端展示按点亮集过滤；空集=全量。
- [ ] `cargo test` / `tsc` / `vitest` 全绿。

## Definition of Done
代码实现 + 必要单测 + 回归命令通过；无法无头验证项（icon.icns、单例 GUI、浏览器唤起）显式声明并给本地核对清单；progress.csv 更新；按模块 scoped 提交。

## User Stories
- 作为用户，我希望改了端口后仪表盘/配置都用新端口，以便代理地址一致不混乱。
- 作为用户，我希望重复点击图标只唤起已开窗口，以便不产生多实例端口冲突。
- 作为用户，我希望历史弹窗大数字不被裁、小窗弹窗能滚动，以便完整查看与操作。
- 作为用户，我希望点端点卡片的 URL 直接打开浏览器，以便快速访问。
- 作为用户，我希望对模型清单点亮选择对外公布项、其余保留，以便精准控制公布模型且兼容旧配置。

## Implementation Decisions
- 单例用 `tauri-plugin-single-instance` v2，注册在 builder 最前，回调 show+unminimize+set_focus 主窗口。
- 模型点亮态用端点新增可选 `active_models` 子集（空=全量），DB 迁移 v9；`advertised_models` 统一过滤，前后端一致。
- 弹窗滚动在通用 `DialogContent` 加 `max-h` + 纵向滚动；历史弹窗单独加宽与列不换行。
- API URL 跳转复用已集成的 `@tauri-apps/plugin-opener`。
- 端口项（1/2/3）代码已正确，按"验证 + 加固回归测试"处理，不做行为变更。

## Testing Decisions
- 后端：`endpoint_repo` active_models 往返、迁移 v9 列、`advertised_models` 点亮过滤、端口往返单测。
- 前端：`advertisedModels` 点亮过滤单测；toolConfig 端口已有测试。
- 无头不可验证：icon.icns 渲染、单例多进程唤起、浏览器打开 → 本地核对清单。

## Out of Scope
- `启动行为需求.txt`（自启动/静默启动/自动运行）不在本批，后续单列。

## Technical Notes
- `advertised_models` 同时影响 `/v1/models` 与路由匹配，点亮过滤会让灰色模型既不公布也不可路由（符合预期）。
