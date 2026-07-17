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
    <div className="flex w-full min-w-0 items-center gap-2">
      <Input
        className="min-w-0 flex-1 font-mono"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onValueChange(event.target.value)
        }}
        onBlur={onCommit}
      />
      <Button size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={onAction} disabled={actionPending}>
        {actionPending ? '读取中…' : actionLabel}
      </Button>
    </div>
  )
}
