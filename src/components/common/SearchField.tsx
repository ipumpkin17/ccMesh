import type { ComponentProps } from 'react'
import { SearchIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type InputSize = NonNullable<ComponentProps<typeof Input>['size']>

/**
 * 常驻搜索输入：左侧放大镜 + Input。
 * 与 morph 的 SearchBox 不同，适合工具栏 / 筛选行。
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  size = 'sm',
  ...props
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  size?: InputSize
} & Omit<ComponentProps<'input'>, 'size' | 'value' | 'onChange'>) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
      <Input size={size} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn('pr-2 pl-8', inputClassName)} {...props} />
    </div>
  )
}
