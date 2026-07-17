import { cn } from '@/lib/utils'
import { IS_MAC } from '@/lib/platform'
import { WindowControls } from './WindowControls'

/**
 * 无边框窗口自定义标题栏：左侧可拖拽区，右侧窗口控制按钮。
 * macOS 改用系统原生红绿灯（位于左上角），故左侧留白避让，且不渲染自绘按钮。
 */
export function TitleBar() {
  return (
    <div data-tauri-drag-region className={cn('border-edge-subtle bg-surface flex h-8 shrink-0 items-center justify-between border-b select-none', IS_MAC ? 'pl-20' : 'pl-3')}>
      <span data-tauri-drag-region className="text-ink-mute text-xs font-medium tracking-tight">
        ccMesh
      </span>
      <WindowControls />
    </div>
  )
}
