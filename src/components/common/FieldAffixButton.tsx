import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * 输入框右侧内嵌操作（显示密钥、下拉箭头等）。
 * 父级需 `relative`，输入本身保留 `pr-8` / `pr-9`。
 */
export function FieldAffixButton({ className, type = 'button', ...props }: ComponentProps<'button'>) {
  return (
    <button type={type} className={cn('text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-2.5 transition-colors', className)} {...props} />
  )
}
