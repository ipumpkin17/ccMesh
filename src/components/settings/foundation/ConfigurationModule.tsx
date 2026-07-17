import type { ReactNode } from 'react'

import { sectionDescClass, sectionTitleClass, SurfaceCard } from '@/components/common/SurfaceCard'
import { cn } from '@/lib/utils'

export function ConfigurationModule({
  title,
  description,
  children,
  actions,
  surface = true,
  className,
  contentClassName,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  actions?: ReactNode
  surface?: boolean
  className?: string
  contentClassName?: string
}) {
  const content = <div className={contentClassName}>{children}</div>

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className={sectionTitleClass}>{title}</h2>
          {description ? <div className={sectionDescClass}>{description}</div> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {surface ? (
        <SurfaceCard padding="none" className="overflow-hidden">
          {content}
        </SurfaceCard>
      ) : (
        content
      )}
    </section>
  )
}
