import { describe, expect, it } from 'vitest'

import { appendFastId, removeFastId, reorderFastIds, splitEndpointQueues } from '@/pages/Dashboard/_components/fastQueue'

const ep = (id: number, fast = false, fastSortOrder = 0, sortOrder = id) => ({
  id,
  enabled: true,
  fast,
  fastSortOrder,
  sortOrder,
})

describe('fast endpoint queue', () => {
  it('splits enabled endpoints and keeps independent fast order', () => {
    const { fastQueue, enabledQueue } = splitEndpointQueues([ep(1, false, 0, 1), ep(2, true, 9, 2), ep(3, true, 1, 3), { ...ep(4, true, 0, 4), enabled: false }])

    expect(fastQueue.map((e) => e.id)).toEqual([3, 2])
    expect(enabledQueue.map((e) => e.id)).toEqual([1])
  })

  it('reorders only the fast id list', () => {
    expect(reorderFastIds([1, 2, 3], 3, 1)).toEqual([3, 1, 2])
    expect(reorderFastIds([1, 2, 3], 1, 3)).toEqual([2, 1, 3])
  })

  it('adds and removes fast ids without duplicates', () => {
    expect(appendFastId([1], 2)).toEqual([1, 2])
    expect(appendFastId([1], 1)).toEqual([1])
    expect(removeFastId([1, 2], 1)).toEqual([2])
  })
})
