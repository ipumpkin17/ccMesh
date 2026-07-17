import type { ReactNode } from 'react'

import { TabularText } from '@/components/ui'
import { Card, CardContent } from '@/components/ui/card'
import { formatTokenCompact } from '@/lib/format'
import { metaClass } from '@/lib/typography'

interface Props {
  label: string
  value: number | string
  hint?: ReactNode
  /** true 时辅助提示在数值下方（垂直堆叠）；默认在右侧（水平）。 */
  hintBelow?: boolean
}

/** 跨页面业务卡片：标签 + 大号数值 + 可选提示（Statistics / Dashboard 共用）。 */
export function StatCard({ label, value, hint, hintBelow = false }: Props) {
  // Card 默认 py-6/gap-6 适合内容块；指标卡需紧凑，在此清零再由 Content 控距
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-1 px-4 py-3">
        <span className={metaClass}>{label}</span>
        <div className={hintBelow ? 'flex flex-col gap-0.5' : 'flex items-center justify-between gap-2'}>
          <TabularText className="text-foreground text-lg leading-6 font-semibold">{value}</TabularText>
          {hint}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Token 辅助单位小字：仅当数值达到"万"量级（≥ 1e4）才展示折算单位，
 * 否则精确值本身已足够清晰。用作 `StatCard` 的 `hint`。
 */
export function TokenHint({ value }: { value: number }) {
  if (value < 1e4) return null
  return <span className={metaClass}>{formatTokenCompact(value)}</span>
}
