import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const WIDTH: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-28',
  sm: 'w-32',
  md: 'w-36',
  lg: 'w-56',
}

/** 为 Select、Input 等控件提供统一宽度，不在业务层写宽度 class。 */
export function SettingsControl({ children, width }: { children: ReactNode; width: keyof typeof WIDTH }) {
  return <div className={cn('shrink-0 [&>*]:w-full', WIDTH[width])}>{children}</div>
}

/** 行内的多个设置控件使用统一间距。 */
export function SettingsControls({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>
}

/** 长文本设置控件，输入框优先占满右侧空间，末尾保留单个辅助操作。 */
export function SettingsTextField({
  value,
  placeholder,
  onValueChange,
  onCommit,
  actionLabel,
  onAction,
  actionPending = false,
}: {
  value: string
  placeholder: string
  onValueChange: (value: string) => void
  onCommit: () => void
  actionLabel: string
  onAction: () => void
  actionPending?: boolean
}) {
  return (
    <div className="border-input bg-surface-raised flex h-9 min-w-0 overflow-hidden rounded-sm border">
      <Input
        className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent font-mono text-[11px] md:text-xs"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          if (event.target.value) onValueChange(event.target.value)
        }}
        onBlur={onCommit}
      />
      <Button
        size="sm"
        variant="outline"
        className="border-input bg-surface-card hover:bg-surface-hover h-full rounded-none border-0 border-l px-4 shadow-none"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onAction}
        disabled={actionPending}
      >
        {actionPending ? '读取中…' : actionLabel}
      </Button>
    </div>
  )
}
