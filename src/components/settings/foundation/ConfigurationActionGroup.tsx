import type { ReactNode } from 'react'

import { SurfaceCard } from '@/components/common/SurfaceCard'

/**
 * 设置操作行的统一容器：只管理边框，行内边距始终由 ConfigurationActionRow 提供。
 */
export function ConfigurationActionGroup({ children }: { children: ReactNode }) {
  return (
    <SurfaceCard padding="none" className="overflow-hidden">
      {children}
    </SurfaceCard>
  )
}
