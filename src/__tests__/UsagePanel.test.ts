import { describe, expect, it } from 'vitest'

import { formatCacheCreationTokens, groupByDate } from '@/pages/Statistics/_components/UsagePanel'
import type { DayModelUsage } from '@/services/modules/usage'

const row = (date: string, model: string): DayModelUsage => ({
  date,
  appType: 'claude',
  model,
  requests: 1,
  inputTokens: 1,
  outputTokens: 1,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
})

describe('groupByDate', () => {
  it('连续同日期行聚为一组，保持后端排序', () => {
    const groups = groupByDate([row('2026-06-08', 'opus'), row('2026-06-08', 'mimo'), row('2026-06-07', 'opus')])
    expect(groups).toHaveLength(2)
    expect(groups[0].date).toBe('2026-06-08')
    expect(groups[0].rows.map((r) => r.model)).toEqual(['opus', 'mimo'])
    expect(groups[1].date).toBe('2026-06-07')
    expect(groups[1].rows).toHaveLength(1)
  })

  it('空输入返回空组', () => {
    expect(groupByDate([])).toEqual([])
  })
})

describe('formatCacheCreationTokens', () => {
  it('Codex 未上报缓存创建时显示未知而不是 0', () => {
    expect(formatCacheCreationTokens({ appType: 'codex', cacheCreationTokens: 0 })).toBe('N/A')
  })

  it('非 Codex 或已有缓存创建数时显示数字', () => {
    expect(formatCacheCreationTokens({ appType: 'claude', cacheCreationTokens: 0 })).toBe('0')
    expect(formatCacheCreationTokens({ appType: 'codex', cacheCreationTokens: 42 })).toBe('42')
  })
})
