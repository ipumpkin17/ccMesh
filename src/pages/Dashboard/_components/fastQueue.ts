import type { Endpoint } from '@/services/modules/endpoint'

type QueueEndpoint = Pick<Endpoint, 'id' | 'enabled' | 'fast' | 'fastSortOrder' | 'sortOrder'>

const byGlobalOrder = <T extends QueueEndpoint>(a: T, b: T) => a.sortOrder - b.sortOrder || a.id - b.id

const byFastOrder = <T extends QueueEndpoint>(a: T, b: T) => a.fastSortOrder - b.fastSortOrder || byGlobalOrder(a, b)

export function splitEndpointQueues<T extends QueueEndpoint>(endpoints: T[]) {
  const fastQueue: T[] = []
  const enabledQueue: T[] = []
  for (const endpoint of endpoints) {
    if (!endpoint.enabled) continue
    ;(endpoint.fast ? fastQueue : enabledQueue).push(endpoint)
  }
  fastQueue.sort(byFastOrder)
  enabledQueue.sort(byGlobalOrder)
  return { fastQueue, enabledQueue }
}

export function reorderFastIds(ids: number[], activeId: number, targetId: number) {
  if (activeId === targetId) return ids
  const next = ids.filter((id) => id !== activeId)
  const targetIndex = next.indexOf(targetId)
  if (targetIndex === -1) return ids.includes(activeId) ? ids : [...ids, activeId]
  next.splice(targetIndex, 0, activeId)
  return next
}

export function appendFastId(ids: number[], id: number) {
  return ids.includes(id) ? ids : [...ids, id]
}

export function removeFastId(ids: number[], id: number) {
  return ids.filter((x) => x !== id)
}
