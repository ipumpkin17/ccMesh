import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function TabularText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono tracking-tight tabular-nums', className)}>{children}</span>
}
