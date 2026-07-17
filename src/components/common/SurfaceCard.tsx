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

export function SurfaceCard({ children, className, padding = 'lg', as: Comp = 'section' }: SurfaceCardProps) {
  return <Comp className={cn('bg-card text-card-foreground rounded-xl border', PADDING[padding], className)}>{children}</Comp>
}
