import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * 静音提示 / 说明触发器（Info 图标旁等），默认 mute → secondary。
 */
export function HintButton({ className, type = 'button', ...props }: ComponentProps<'button'>) {
  return <button type={type} className={cn('text-ink-mute hover:text-ink-secondary inline-flex transition-colors', className)} {...props} />
}
