import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** 配置面板的标准内容留白，与操作行的水平基线保持一致。 */
export function ConfigurationPanelContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>
}
