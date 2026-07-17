import type { ReactNode } from 'react'

import logoUrl from '@/assets/logo.png'
import { cn } from '@/lib/utils'

export function Logo({ iconOnly = false, extra, imageClassName, nameClassName }: { iconOnly?: boolean; extra?: ReactNode; imageClassName?: string; nameClassName?: string }) {
  return (
    <div className="flex items-center gap-2">
      <img src={logoUrl} alt="ccMesh" className={cn('size-7 shrink-0 rounded-md', imageClassName)} />
      {!iconOnly && (
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className={cn('text-base leading-tight font-semibold tracking-tight whitespace-nowrap', nameClassName)}>ccMesh</span>
          {extra}
        </div>
      )}
    </div>
  )
}
