import { useQuery } from '@tanstack/react-query'

import { endpointApi } from '@/services/modules/endpoint'

/** 端点列表；`enabled` 可关闭（如仅回查图标且已有 type）。 */
export function useEndpoints(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['endpoints'],
    queryFn: endpointApi.list,
    // 默认开启；仅 EndpointLabel 回查图标等场景可传 false 关闭
    enabled: options?.enabled ?? true,
  })
}
