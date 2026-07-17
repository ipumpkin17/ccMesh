import { SettingsIcon } from 'lucide-react'

import { UpdateBadge } from '@/components/business'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLayoutStore } from '@/stores'

export function SettingsShortcut({ side = 'right' }: { side?: 'right' | 'bottom' }) {
  const activeView = useLayoutStore((s) => s.activeView)
  const setActiveView = useLayoutStore((s) => s.setActiveView)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            aria-label="设置"
            onClick={() => setActiveView('settings')}
            className={activeView === 'settings' ? 'border-primary/30 bg-primary/10 text-primary-soft' : undefined}
          >
            <SettingsIcon className="size-4" />
          </Button>
          <span className="pointer-events-none absolute -top-0.5 -right-0.5">
            <UpdateBadge />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side={side}>设置</TooltipContent>
    </Tooltip>
  )
}
