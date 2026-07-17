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
export const pageTitleClass = 'text-lg font-semibold leading-7 text-foreground'

export const sectionTitleClass = 'text-base font-semibold leading-6 text-foreground'

export const panelTitleClass = 'text-sm font-semibold leading-5 text-foreground'

export const bodyClass = 'text-sm leading-5 text-foreground'

export const bodySecondaryClass = 'text-sm leading-5 text-muted-foreground'

export const emptyClass = 'text-sm leading-5 text-muted-foreground'

export const sectionDescClass = 'text-xs leading-5 text-muted-foreground'

export const metaClass = 'text-xs leading-4 text-muted-foreground'

export const tableHeadClass = 'text-xs font-medium leading-4 text-muted-foreground'

/** 模型名、路径、密钥等 mono 元信息 */
export const monoMetaClass = 'font-mono text-xs text-muted-foreground'

/** 更密的次要信息（迁移列表 URL / 掩码密钥） */
export const denseMetaClass = 'text-xs text-muted-foreground'
