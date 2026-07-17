import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const inputVariants = cva(
  // 表单控件统一走 shadcn primitive，业务层不要覆盖视觉细节。
  'border-input selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
  {
    variants: {
      size: {
        default: 'h-9 text-base md:text-sm',
        sm: 'h-8 text-sm',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

function Input({ className, type, size = 'default', ...props }: Omit<React.ComponentProps<'input'>, 'size'> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        inputVariants({ size }),
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Input, inputVariants }
