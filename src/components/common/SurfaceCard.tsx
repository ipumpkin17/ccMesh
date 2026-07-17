import type { ElementType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export {
  emptyClass,
  metaClass,
  monoMetaClass,
  denseMetaClass,
  pageTitleClass,
  panelTitleClass,
  sectionDescClass,
  sectionTitleClass,
  bodyClass,
  bodySecondaryClass,
  tableHeadClass,
} from '@/lib/typography'

type SurfacePadding = 'none' | 'md' | 'lg'

const PADDING: Record<SurfacePadding, string> = {
  none: '',
  md: 'p-4',
  lg: 'p-6',
}

interface SurfaceCardProps {
  children: ReactNode
  className?: string
  /** lg=p-6（设置/同步卡片），md=p-4（列表/工作区面板），none=自管内边距。 */
  padding?: SurfacePadding
  as?: ElementType
}

/**
 * 统一表面卡片：surface-card + edge-subtle + rounded-lg。
 * 设置、关于、同步、端点侧栏等业务块共用，避免 border-edge / 无底色 / p-5 混用。
 */
export function SurfaceCard({ children, className, padding = 'lg', as: Comp = 'section' }: SurfaceCardProps) {
  return <Comp className={cn('border-edge-subtle bg-surface-card rounded-lg border', PADDING[padding], className)}>{children}</Comp>
}
