import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { proxyApi } from '@/services/modules/proxy'

/**
 * 代理运行态（running/port/currentEndpoint/enabledEndpointCount）。
 * `proxy-status-changed` 事件到达即失效，由 React Query 重拉 `proxyApi.status`，
 * 替代原先 Zustand `useProxyStore` 的事件直写，统一进 RQ 缓存体系。
 */
export function useProxyStatus() {
  const qc = useQueryClient()
  useEffect(() => {
    let unlisten: (() => void) | undefined
    proxyApi
      .onStatusChanged(() => qc.invalidateQueries({ queryKey: ['proxy-status'] }))
      .then((un) => {
        unlisten = un
      })
    return () => unlisten?.()
  }, [qc])

  return useQuery({ queryKey: ['proxy-status'], queryFn: proxyApi.status })
}
