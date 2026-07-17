import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Control, Controls, type ControlWidth } from '@/components/ui/control'
import { Input } from '@/components/ui/input'

/** 设置行控件宽度外壳（委托通用 Control，业务不写 w-*）。 */
export function SettingsControl({ children, width }: { children: ReactNode; width: ControlWidth }) {
  return <Control width={width}>{children}</Control>
}

/** 行内多个设置控件的统一间距。 */
export function SettingsControls({ children }: { children: ReactNode }) {
  return <Controls>{children}</Controls>
}

/** 长文本设置控件：输入占满右侧，末尾单一辅助操作。 */
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
