import { TabularText } from '@/components/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DEFAULT_ENDPOINT_QUALITY_BUCKET_COUNT, useEndpointQuality } from '@/hooks/useEndpointQuality'
import { cn } from '@/lib/utils'
import type { EndpointQuality, EndpointQualityBlock } from '@/services/modules/stats'

type EndpointQualityVariant = 'grid' | 'list'

function formatRate(rate: number | null) {
  return rate === null ? '' : `${(rate * 100).toFixed(1)}%`
}

function blockTone(block: EndpointQualityBlock) {
  if (block.total === 0) return 'bg-edge-strong'
  if (block.successCount > 0 && (block.throttledCount > 0 || block.failedCount > 0)) {
    return 'bg-[#facc15]'
  }
  if (block.failedCount > 0) return 'bg-destructive'
  if (block.throttledCount > 0) return 'bg-[#facc15]'
  return 'bg-success'
}

function blockDetail(block: EndpointQualityBlock) {
  if (block.total === 0) return '无请求'
  return `${block.total} 次尝试：成功 ${block.successCount}，限流 ${block.throttledCount}，失败 ${block.failedCount}`
}

function formatBucketTime(timestampMs: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestampMs)
}

function EndpointQualityTimeline({ quality, bucketCount, variant }: { quality: EndpointQuality | undefined; bucketCount: number; variant: EndpointQualityVariant }) {
  const hasQuality = quality?.startedAtMs !== null && quality !== undefined
  const blocks: Array<EndpointQualityBlock | null> = hasQuality ? quality.blocks : Array.from({ length: bucketCount }, () => null)
  const blockSize = variant === 'list' ? 5 : 6
  const trackWidth = bucketCount * blockSize + (bucketCount - 1) * 2

  return (
    <div className="endpoint-quality-strip flex w-max min-w-0 flex-col gap-1">
      <div className="grid h-4 grid-cols-3 items-center whitespace-nowrap text-[10px] leading-4 text-ink-secondary" style={{ width: `${trackWidth}px` }}>
        <span className="text-left">
          <span className="mr-0.5 text-ink-mute">总数</span>
          <TabularText>{(quality?.total ?? 0).toLocaleString()}</TabularText>
        </span>
        <span className="text-center">
          <span className="mr-0.5 text-ink-mute">成功</span>
          <TabularText className={quality && quality.successCount > 0 ? 'text-success' : undefined}>{quality?.successCount ?? 0}</TabularText>
        </span>
        <span className="text-right">
          <span className="mr-0.5 text-ink-mute">失败</span>
          <TabularText className={quality && quality.failureCount > 0 ? 'text-destructive' : undefined}>{quality?.failureCount ?? 0}</TabularText>
        </span>
      </div>
      <div className="endpoint-quality-track flex items-center gap-2">
        <div
          className={cn('grid gap-0.5', variant === 'list' ? 'h-2.5' : 'h-3')}
          aria-label={`${quality?.endpointName ?? '端点'} 最近 1 小时质量`}
          style={{ gridTemplateColumns: `repeat(${bucketCount}, ${blockSize}px)` }}
        >
          {blocks.map((block, index) => {
            if (block === null || !quality) {
              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <span className="rounded-full bg-edge-strong" />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6} className="max-w-none whitespace-nowrap px-2 py-1 text-[11px] leading-4">
                    代理启动后开始记录
                  </TooltipContent>
                </Tooltip>
              )
            }

            const slotStartMs = block.startMs
            const slotEndMs = index === blocks.length - 1 ? quality.windowEndMs : slotStartMs + quality.bucketMs
            return (
              <Tooltip key={slotStartMs}>
                <TooltipTrigger asChild>
                  <span className={cn('rounded-full transition-opacity [@media(hover:hover)]:hover:opacity-70', blockTone(block))} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6} className="max-w-none whitespace-nowrap px-2 py-1 text-[11px] leading-4">
                  {formatBucketTime(slotStartMs)}-{formatBucketTime(slotEndMs)} · {blockDetail(block)}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <TabularText className={cn('w-9 shrink-0 text-right text-xs', quality?.successRate != null ? 'text-success' : 'text-ink-mute')}>
          {formatRate(quality?.successRate ?? null)}
        </TabularText>
      </div>
    </div>
  )
}

/** 端点质量容器：负责查询当前端点数据，展示层不直接依赖数据源。 */
export function EndpointQualityPanel({
  endpointId,
  bucketCount = DEFAULT_ENDPOINT_QUALITY_BUCKET_COUNT,
  variant = 'grid',
}: {
  endpointId: string
  bucketCount?: number
  variant?: EndpointQualityVariant
}) {
  const { data: allQuality } = useEndpointQuality(bucketCount)
  const quality = allQuality?.find((item) => item.endpointId === endpointId)

  return <EndpointQualityTimeline quality={quality} bucketCount={bucketCount} variant={variant} />
}
