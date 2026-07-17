import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { emptyClass, pageTitleClass, bodySecondaryClass } from '@/lib/typography'

export function Placeholder({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitleClass}>{title}</h1>
        {description && <p className={bodySecondaryClass}>{description}</p>}
      </div>
      {children ?? (
        <Card>
          <CardContent className={cn('flex h-64 items-center justify-center pt-6', emptyClass)}>建设中</CardContent>
        </Card>
      )}
    </div>
  )
}
