import { cn } from '@/lib/utils'

/**
 * JsonEditor 等懒加载占位，统一文案与字号。
 */
export function EditorLoading({ className, height = 160 }: { className?: string; height?: number }) {
  return (
    <div className={cn('text-muted-foreground flex items-center justify-center text-xs', className)} style={{ height }}>
      加载编辑器…
    </div>
  )
}
