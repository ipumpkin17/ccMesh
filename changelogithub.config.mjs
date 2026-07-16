/** @type {import('changelogithub').ChangelogOptions} */
export default {
  // 发布说明写回 tauri-action 创建的 Release；workflow 用 --output，避免再开第二份草稿。
  draft: false,
  prerelease: false,
  contributors: false,
  emoji: false,
  capitalize: false,
  group: true,
  titles: {
    breakingChanges: '破坏性变更',
  },
  types: {
    feat: { title: '新增' },
    fix: { title: '修复' },
    perf: { title: '性能优化' },
    refactor: { title: '重构' },
    docs: { title: '文档' },
    build: { title: '构建' },
    ci: { title: '持续集成' },
    // 不声明 chore/style/test，避免 release 升版、格式化、测试类提交进入变更记录。
    revert: { title: '回退' },
  },
}
