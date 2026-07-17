/**
 * 全局字体层级（对齐 DESIGN.md 的 app 场景，不走营销 display 超大号）。
 *
 * - pageTitle: 页面 H1
 * - sectionTitle: 卡片 / 一级区块标题
 * - panelTitle: 卡片内二级面板标题
 * - body / bodySecondary: 正文
 * - empty / muted: 空态、次要说明
 * - sectionDesc / meta: 辅助说明与元信息
 * - tableHead: 表头
 */
export const pageTitleClass = 'text-2xl font-light tracking-tight text-ink-primary'

export const sectionTitleClass = 'text-base font-medium text-ink-primary'

export const panelTitleClass = 'text-sm font-medium text-ink-primary'

export const bodyClass = 'text-sm text-ink-primary'

export const bodySecondaryClass = 'text-sm text-ink-secondary'

export const emptyClass = 'text-sm text-ink-mute'

export const sectionDescClass = 'text-xs leading-relaxed text-ink-mute'

export const metaClass = 'text-xs text-ink-mute'

export const tableHeadClass = 'text-xs font-medium text-ink-secondary'

/** 模型名、路径、密钥等 mono 元信息 */
export const monoMetaClass = 'font-mono text-xs text-ink-secondary'

/** 更密的次要信息（迁移列表 URL / 掩码密钥） */
export const denseMetaClass = 'text-[10px] text-ink-mute'
