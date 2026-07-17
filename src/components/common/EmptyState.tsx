import type { ReactNode } from 'react'

import { emptyClass } from '@/lib/typography'
import { cn } from '@/lib/utils'

type Align = 'start' | 'center'

/**
 * 列表 / 面板空态与加载占位文案。
 * 业务不要再拼 `px-2 py-4 text-center ${emptyClass}`。
 */
export function EmptyState({
  children,
  className,
  align = 'start',
  padded = false,
}: {
  children: ReactNode
  className?: string
  align?: Align
  /** 列表内常用垂直留白 */
  padded?: boolean
}) {
  return <p className={cn(emptyClass, align === 'center' && 'text-center', padded && 'px-2 py-4', className)}>{children}</p>
}
