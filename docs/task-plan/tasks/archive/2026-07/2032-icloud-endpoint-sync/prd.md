# 端点配置 iCloud 同步

## 问题

用户希望两台 Mac 之间只同步端点配置，不需要同步主题、端口、统计和 WebDAV 凭证。现有 WebDAV 可跨平台，但 macOS 侧缺少零配置入口。

## 决策

- 只同步端点配置，不同步应用设置/统计/WebDAV 凭证
- 使用 iCloud Drive 文件快照，不接 CloudKit，不做实时字段级合并
- 文件路径：`~/Library/Mobile Documents/com~apple~CloudDocs/ccMesh/endpoints.json`
- 开启后本地端点新增/修改/删除自动备份
- 冲突交互对齐 Loon：
  - iCloud 覆盖本地
  - 本地覆盖 iCloud
  - 关闭同步
- 空 iCloud 列表禁止覆盖本地非空端点
- 状态指纹不向前端回传明文密钥

## 验收标准

- 仅 macOS 显示 iCloud 同步区块
- 开启后修改端点会写入 iCloud 文件
- 存在差异时出现冲突弹窗并可三选一
- 覆盖方向会完整保留模型、映射、多密钥与快速队列
