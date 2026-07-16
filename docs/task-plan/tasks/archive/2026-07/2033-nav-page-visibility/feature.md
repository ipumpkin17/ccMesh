# 实现

## 状态

- `layout.ts` 增加 `hiddenNavIds` / `setNavPageVisible`
- persist 到 `layout-prefs`
- `normalizeHidden` 保证至少一页可见

## UI

- `NavVisibilityCard` 设置卡片
- `SideNav` / `TopNav` 使用 `getVisibleNavItems`
- `AppLayout` 兜底：当前业务页被隐藏时切换

## 验证

- `pnpm exec tsc --noEmit`
