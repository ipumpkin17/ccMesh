import { useState } from 'react'

import { PageShell } from '@/components/common'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EndpointStatsPanel } from './_components/EndpointStatsPanel'
import { UsagePanel } from './_components/UsagePanel'

const TOP_TABS = [
  { key: 'endpoint', label: '端点统计' },
  { key: 'usage', label: '用量统计' },
] as const

type TopKey = (typeof TOP_TABS)[number]['key']

export function Statistics() {
  const [tab, setTab] = useState<TopKey>('endpoint')

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TopKey)} className="h-full min-h-0">
      <PageShell
        title="统计"
        className="flex-1"
        contentClassName="flex flex-col gap-6"
        headerExtra={
          <TabsList>
            {TOP_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        }
      >
        <TabsContent value="endpoint" className="mt-0">
          <EndpointStatsPanel />
        </TabsContent>
        <TabsContent value="usage" className="mt-0">
          <UsagePanel />
        </TabsContent>
      </PageShell>
    </Tabs>
  )
}
