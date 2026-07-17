import { SettingsIcon } from 'lucide-react'

import { UpdateBadge } from '@/components/business'
import { IconButton } from '@/components/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLayoutStore } from '@/stores'

export function SettingsShortcut({ side = 'right' }: { side?: 'right' | 'bottom' }) {
  const activeView = useLayoutStore((s) => s.activeView)
  const setActiveView = useLayoutStore((s) => s.setActiveView)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <IconButton
            variant="outline"
            size="default"
            aria-label="设置"
            onClick={() => setActiveView('settings')}
            className={activeView === 'settings' ? 'border-primary/30 bg-primary/10 text-primary-soft' : undefined}
          >
            <SettingsIcon className="size-4" />
          </IconButton>
          <span className="pointer-events-none absolute -top-0.5 -right-0.5">
            <UpdateBadge />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side={side}>设置</TooltipContent>
    </Tooltip>
  )
}
