import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLayoutStore } from '@/stores'
import type { NavItemDef } from './navConfig'

export function NavItem({ item, variant, collapsed = false }: { item: NavItemDef; variant: 'horizontal' | 'vertical'; collapsed?: boolean }) {
  const activeView = useLayoutStore((s) => s.activeView)
  const setActiveView = useLayoutStore((s) => s.setActiveView)
  const lang = useLayoutStore((s) => s.lang)

  const isActive = activeView === item.id
  const label = lang === 'zh' ? item.label : item.labelEn
  const Icon = item.icon

  if (variant === 'horizontal') {
    return (
      <button
        type="button"
        onClick={() => setActiveView(item.id)}
        className={cn(
          'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
          isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Icon className="size-4" />
        {label}
      </button>
    )
  }

  const row = (
    <button
      type="button"
      onClick={() => setActiveView(item.id)}
      aria-label={label}
      className={cn(
        'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        isActive
          ? 'bg-primary/10 text-primary'
          : collapsed
            ? 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
            : 'text-foreground hover:bg-primary/5 hover:text-primary',
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', isActive && 'text-primary')} />
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
    </button>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return row
}
