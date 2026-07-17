import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type IconButtonSize = 'xs' | 'sm' | 'default' | 'lg'

const SIZE_MAP: Record<IconButtonSize, NonNullable<ComponentProps<typeof Button>['size']>> = {
  xs: 'icon-xs',
  sm: 'icon-sm',
  default: 'icon',
  lg: 'icon-lg',
}

/**
 * 图标按钮：只暴露语义 size，禁止业务用 className 改高度/padding。
 * 需要 Tooltip 时由外层包裹。
 */
export function IconButton({
  size = 'default',
  variant = 'ghost',
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'size'> & {
  size?: IconButtonSize
}) {
  return <Button size={SIZE_MAP[size]} variant={variant} className={cn(className)} {...props} />
}
