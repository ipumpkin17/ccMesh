import { useMemo } from 'react'
import { Anthropic, Codex, OpenAI } from '@lobehub/icons'
import type { ComponentType } from 'react'

import { cn } from '@/lib/utils'
import { useEndpoints } from '@/hooks/useEndpoints'

type BrandIcon = ComponentType<{ size?: number; className?: string }>

/**
 * 端点类型 → 品牌图标。
 * transformer：claude / openai / codex 及别名；
 * inboundFormat 回退：claude / openai / responses。
 */
const ENDPOINT_TYPE_ICON: Record<string, BrandIcon> = {
  claude: Anthropic,
  openai: OpenAI,
  openai_chat: OpenAI,
  'openai-chat': OpenAI,
  openai2: OpenAI,
  codex: Codex.Color,
  responses: Codex.Color,
  openai_responses: Codex.Color,
  'openai-responses': Codex.Color,
}

/** 按类型取图标；未知回退 OpenAI。 */
export function getEndpointTypeIcon(type?: string | null): BrandIcon {
  if (type) {
    const icon = ENDPOINT_TYPE_ICON[type.toLowerCase()]
    if (icon) return icon
  }
  return OpenAI
}

/** 与端点卡片一致的 transformer → 图标（仅主类型）。 */
export function getTransformerIcon(transformer: string): BrandIcon {
  return getEndpointTypeIcon(transformer)
}

interface BrandIconProps {
  type?: string | null
  size?: number
  className?: string
}

/** 品牌图标：保持各家原始比例，不做光学缩放。 */
export function EndpointBrandIcon({ type, size = 16, className }: BrandIconProps) {
  const Icon = getEndpointTypeIcon(type)
  return <Icon size={size} className={cn('shrink-0', className)} />
}

interface EndpointLabelProps {
  name: string
  /** 直接指定类型（transformer 优先，或 inboundFormat）。 */
  type?: string | null
  /** 统计等无 type 时，用端点 uid 回查 transformer。 */
  endpointId?: string | null
  size?: number
  className?: string
  nameClassName?: string
}

/**
 * 统一端点展示：品牌图标 + 名称。
 * 请求记录、统计表、历史记录共用，避免有的有图标有的纯文字。
 */
export function EndpointLabel({ name, type, endpointId, size = 12, className, nameClassName }: EndpointLabelProps) {
  // 已有 type 时不拉端点列表；仅统计表等缺 type 场景才回查
  const needsLookup = !type && Boolean(endpointId)
  const { data: endpoints } = useEndpoints({ enabled: needsLookup })
  const resolvedType = useMemo(() => {
    if (type) return type
    if (!endpointId || !endpoints) return null
    return endpoints.find((e) => e.uid === endpointId || String(e.id) === endpointId)?.transformer ?? null
  }, [type, endpointId, endpoints])

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <EndpointBrandIcon type={resolvedType} size={size} />
      <span className={cn('truncate', nameClassName)}>{name}</span>
    </span>
  )
}
