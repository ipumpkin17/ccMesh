import type { ComponentType } from 'react'
import { LayoutGridIcon } from 'lucide-react'
import { Anthropic, Codex, OpenAI } from '@lobehub/icons'
import { motion } from 'motion/react'

import { useFilterStore } from '@/stores'
import { cn } from '@/lib/utils'

type TabIcon = ComponentType<{ size?: number; className?: string }>

const TYPE_TABS: { value: string; label: string; icon: TabIcon }[] = [
  { value: 'all', label: '全部', icon: LayoutGridIcon },
  { value: 'claude', label: 'claude', icon: Anthropic },
  { value: 'openai', label: 'openai', icon: OpenAI },
  { value: 'codex', label: 'codex', icon: Codex },
]

export function TypeTabs() {
  const transformer = useFilterStore((s) => s.transformer)
  const setTransformer = useFilterStore((s) => s.setTransformer)

  return (
    <nav className="flex shrink-0 items-stretch gap-1 self-stretch" aria-label="端点类型">
      {TYPE_TABS.map((tab) => {
        const active = transformer === tab.value
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => setTransformer(tab.value)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 px-3 text-sm whitespace-nowrap transition-colors',
              active ? 'text-ink-primary' : 'text-ink-mute hover:text-ink-primary',
            )}
          >
            <Icon size={14} className="shrink-0" />
            {tab.label}
            {active && (
              <motion.span
                layoutId="endpoint-type-indicator"
                className="bg-primary absolute inset-x-0 -bottom-px h-0.5"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
