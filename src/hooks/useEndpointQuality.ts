import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { statsApi } from '@/services/modules/stats'

const QUERY_KEY = ['endpoint-quality'] as const
export const DEFAULT_ENDPOINT_QUALITY_BUCKET_COUNT = 24
const ENDPOINT_QUALITY_WINDOW_MS = 60 * 60 * 1000
const ROLLING_WINDOW_REFRESH_MS = ENDPOINT_QUALITY_WINDOW_MS / DEFAULT_ENDPOINT_QUALITY_BUCKET_COUNT

/**
 * 端点质量运行态查询。数据只来自真实转发尝试，端点页可见时才订阅更新。
 * 使用短暂防抖，将同一批并发尝试合并为一次状态读取。
 */
export function useEndpointQualityEvents() {
  const qc = useQueryClient()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false
    statsApi
      .onEndpointQualityUpdated(() => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          qc.invalidateQueries({ queryKey: QUERY_KEY })
          timer.current = undefined
        }, 300)
      })
      .then((un) => {
        if (disposed) {
          un()
        } else {
          unlisten = un
        }
      })
    // 每个时间格结束时推进最近 1 小时窗口，让过期样本自然移出色块时间轴。
    const rollingWindowTimer = window.setInterval(() => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    }, ROLLING_WINDOW_REFRESH_MS)
    return () => {
      disposed = true
      if (timer.current) clearTimeout(timer.current)
      window.clearInterval(rollingWindowTimer)
      unlisten?.()
    }
  }, [qc])
}

/** 多张端点卡片共享同一批质量概览，React Query 会自动去重。 */
export function useEndpointQuality(bucketCount: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, bucketCount],
    queryFn: () => statsApi.getEndpointQuality(bucketCount),
    staleTime: 1_000,
  })
}
