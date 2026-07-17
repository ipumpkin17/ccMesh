import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const WIDTH = {
  xs: 'w-28',
  sm: 'w-32',
  md: 'w-36',
  lg: 'w-56',
  full: 'w-full',
} as const

export type ControlWidth = keyof typeof WIDTH

/**
 * 控件外壳：统一宽度，业务层不要给 SelectTrigger/Input 写 w-* class。
 * 子控件通过 [&>*]:w-full 撑满外壳。
 */
export function Control({ children, width = 'sm', className }: { children: ReactNode; width?: ControlWidth; className?: string }) {
  return <div className={cn('shrink-0 [&>*]:w-full', WIDTH[width], className)}>{children}</div>
}

/** 多个控件横向排列的统一间距。 */
export function Controls({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-1.5', className)}>{children}</div>
}
