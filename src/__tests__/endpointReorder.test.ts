import { describe, expect, it } from 'vitest'

import { moveBeforeEndpoint } from '@/pages/Endpoints/_components/reorder'

const ep = (id: number) => ({ id })

describe('endpoint filtered reorder', () => {
  it('moves the active card before the preview target', () => {
    expect(moveBeforeEndpoint([ep(1), ep(2), ep(3), ep(4)], 1, 3)).toEqual([ep(2), ep(1), ep(3), ep(4)])
    expect(moveBeforeEndpoint([ep(1), ep(2), ep(3), ep(4)], 4, 2)).toEqual([ep(1), ep(4), ep(2), ep(3)])
  })
})
