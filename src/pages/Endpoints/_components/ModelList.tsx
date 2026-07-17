import { InfoIcon } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState, metaClass, sectionTitleClass, SurfaceCard } from '@/components/common'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEndpoints } from '@/hooks/useEndpoints'
import { getModelIcon } from '@/lib/model-icons'
import { advertisedModels } from '@/services/modules/endpoint'

/** 复制文本到剪贴板，navigator.clipboard 不可用时降级 execCommand。 */
async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
  } else {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

/** 按启用端点分组展示其对外可用模型（出站模型 + 映射入站名）。 */
export function ModelList({ framed = true }: { framed?: boolean }) {
  const { data: endpoints } = useEndpoints()
  const groups = (endpoints ?? [])
    .filter((e) => e.enabled)
    .map((e) => ({
      name: e.name,
      models: advertisedModels(e),
    }))
    .filter((g) => g.models.length > 0)

  const onCopy = (model: string) =>
    copyText(model)
      .then(() => toast.success(`已复制 ${model}`))
      .catch(() => toast.error('复制失败'))

  const content = (
    <>
      <h2 className={cn(sectionTitleClass, 'flex shrink-0 items-center gap-1.5')}>
        可用模型
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoIcon className="text-muted-foreground size-3.5 cursor-help" />
          </TooltipTrigger>
          <TooltipContent>按启用端点</TooltipContent>
        </Tooltip>
      </h2>
      {groups.length === 0 ? (
        <EmptyState>暂无模型（在端点中配置模型清单或锁定模型）</EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 scrollbar-none flex-col gap-3 overflow-y-auto pr-1">
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col gap-1.5">
              <span className={metaClass}>
                {g.name} <span className="text-muted-foreground">({g.models.length})</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {g.models.map((m, i) => {
                  const ModelIcon = getModelIcon(m)
                  return (
                    <Badge
                      key={`${m}-${i}`}
                      variant="muted"
                      role="button"
                      tabIndex={0}
                      onClick={() => onCopy(m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onCopy(m)
                        }
                      }}
                      className="hover:bg-accent flex cursor-pointer items-center gap-1 transition-colors select-none"
                    >
                      <ModelIcon size={14} className="shrink-0" />
                      {m}
                    </Badge>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  if (!framed) {
    return <div className="flex h-full flex-col gap-3">{content}</div>
  }

  return (
    <SurfaceCard padding="md" className="flex h-full flex-col gap-3">
      {content}
    </SurfaceCard>
  )
}
