# 发版操作手册

ccMesh 发版的日常操作：打 tag、重新触发构建、正式发布、紧急撤回。

> 前置条件：已在 GitHub Secrets 配好 `TAURI_SIGNING_PRIVATE_KEY`（见 [`tauri-updater-signing.md`](./tauri-updater-signing.md)）。

---

## 一、正常发版流程

```bash
# 在 master 且工作区干净时运行；按提示输入 0.2.1-8
pnpm release
```

脚本会同步版本文件、刷新 `Cargo.lock`、校验工作区与 tag、创建提交和带注释的 tag，并原子推送 `master` 与 tag。

CI 完成后到 GitHub → Releases → 找到 Draft → 点 **Publish release** 正式发布。

### 发布后 checklist

- [ ] Release 页面 Assets 里有 msi / dmg / deb / latest.json
- [ ] 已点 **Publish release**（Draft 状态下 updater 检测不到更新）
- [ ] 访问 `https://github.com/ipumpkin17/ccMesh/releases/latest/download/latest.json` 能打开
- [ ] 已安装客户端能检测到更新并下载

---

## 二、构建失败处理

适用场景：CI 构建失败（如依赖下载超时、签名配置错误）。

```bash
# 同一提交的瞬时构建问题：在 GitHub Actions 页面直接 Re-run failed jobs
# 代码或配置需要修复：发布一个新版本，不移动已经推送的 tag
pnpm release
```

推完 tag 后 GitHub Actions 自动触发新的构建。不要删除、移动或复用已经推送的版本 tag。

如果三平台构建已成功，但发布草稿步骤失败（例如产物汇总、Release notes、latest.json 生成失败），不要本地手动创建 Release。到 GitHub Actions 对 `release.yml` 点 **Run workflow**，选择 `master` 分支，并填写 `release_tag`（例如 `v0.2.1-8`）。workflow 会重新构建该 tag、自动生成变更日志、生成 `latest.json` 并创建 Draft Release。

## 三、正式发布（Draft → Published）

Draft 只有仓库协作者可见，普通用户和 updater 都检测不到。

1. GitHub → **Releases** → 找到对应版本的 Draft
2. 点右上角 **Edit**（铅笔图标）
3. 检查 Assets 文件是否齐全
4. 填写 Release 标题和说明（可选）
5. 点底部绿色按钮 **Publish release**

> **不要勾选 Pre-release**。Pre-release 是标记"非正式版"的标签，和 Draft/Published 是独立的概念。

---

## 四、撤回已发布版本

如果已发布的版本有严重问题：

### 方案 A：删除 Release（推荐用于紧急情况）

```bash
# 1. GitHub 上删除该 Release（Assets 和 latest.json 一并删除）
# 2. updater 检测不到 latest.json，不会提示更新
# 3. 修复后重新走正常发版流程
```

### 方案 B：标记为 Pre-release

GitHub Release 页面 → Edit → 勾选 **Pre-release** → Update release。

Pre-release 会被 updater 忽略（`latest.json` 只指向非 pre-release 的最新版）。

---

## 五、手动验证构建（不发版）

在 GitHub Actions 页面对 `ci.yml` 点 **Run workflow**，选择 master 分支手动触发。

手动触发不会创建 Release，只验证三平台能否构建。适合：

- 验证签名配置是否正确
- 升级依赖后确认编译通过
- 调试 CI 问题

---

## 六、版本号规范

ccMesh 使用 [语义化版本](https://semver.org/lang/zh-cn/)：

```
v主版本.次版本.修订号
v0.1.0 → v0.1.1 → v0.2.0 → v1.0.0
```

| 变动类型   | 版本变化  | 示例            |
| ---------- | --------- | --------------- |
| Bug 修复   | 修订号 +1 | v0.1.0 → v0.1.1 |
| 新功能     | 次版本 +1 | v0.1.1 → v0.2.0 |
| 破坏性变更 | 主版本 +1 | v0.2.0 → v1.0.0 |

这些文件的版本号由 `pnpm release` 自动同步：

- `src-tauri/tauri.conf.json` → `version`
- `package.json` → `version`
- `src-tauri/Cargo.toml` → `version`
