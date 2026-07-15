/** @type {import('changelogithub').ChangelogOptions} */
export default {
  // 扩展版沿用上游基线，Release 保持草稿，确认说明和安装包后再手动发布。
  draft: true,
  prerelease: false,
  contributors: false,
  emoji: false,
  capitalize: false,
  group: true,
  titles: {
    breakingChanges: "破坏性变更",
  },
  types: {
    feat: { title: "新增" },
    fix: { title: "修复" },
    perf: { title: "性能优化" },
    refactor: { title: "重构" },
    docs: { title: "文档" },
    build: { title: "构建" },
    ci: { title: "持续集成" },
    chore: { title: "维护" },
    revert: { title: "回退" },
    style: { title: "样式" },
    test: { title: "测试" },
  },
};
