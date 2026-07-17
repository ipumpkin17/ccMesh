import type { ComponentType } from 'react'
import { LayoutGridIcon } from 'lucide-react'
import { Anthropic, Codex, OpenAI } from '@lobehub/icons'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFilterStore } from '@/stores'

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
    <Tabs value={transformer} onValueChange={setTransformer} className="shrink-0" aria-label="端点类型">
      <TabsList>
        {TYPE_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger key={tab.value} value={tab.value}>
              <Icon size={16} className="shrink-0" />
              {tab.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
