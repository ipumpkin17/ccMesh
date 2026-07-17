import { EndpointLabel } from '@/components/business'
import { EmptyState, SurfaceCard } from '@/components/common'
import { TabularText } from '@/components/ui'
import type { EndpointStat } from '@/services/modules/stats'
import { tableHeadClass } from '@/lib/typography'

interface Props {
  rows: EndpointStat[]
}

/** 每端点统计明细表。 */
export function EndpointStatsTable({ rows }: Props) {
  if (rows.length === 0) {
    return <EmptyState>该周期暂无数据</EmptyState>
  }
  return (
    <SurfaceCard as="div" padding="none" className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-edge-subtle border-b">
            <th className={`px-4 py-2 text-left ${tableHeadClass}`}>端点</th>
            <th className={`px-4 py-2 text-right ${tableHeadClass}`}>请求</th>
            <th className={`px-4 py-2 text-right ${tableHeadClass}`}>错误</th>
            <th className={`px-4 py-2 text-right ${tableHeadClass}`}>输入 Token</th>
            <th className={`px-4 py-2 text-right ${tableHeadClass}`}>输出 Token</th>
            <th className={`px-4 py-2 text-right ${tableHeadClass}`}>缓存创建</th>
            <th className={`px-4 py-2 text-right ${tableHeadClass}`}>缓存读取</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.endpointId} className="border-edge-subtle border-b last:border-0">
              <td className="px-4 py-2">
                <EndpointLabel name={r.endpointName} endpointId={r.endpointId} size={14} nameClassName="text-sm text-ink-primary" />
              </td>
              <td className="px-4 py-2 text-right">
                <TabularText>{r.requests}</TabularText>
              </td>
              <td className="px-4 py-2 text-right">
                <TabularText>{r.errors}</TabularText>
              </td>
              <td className="px-4 py-2 text-right">
                <TabularText>{r.inputTokens}</TabularText>
              </td>
              <td className="px-4 py-2 text-right">
                <TabularText>{r.outputTokens}</TabularText>
              </td>
              <td className="px-4 py-2 text-right">
                <TabularText>{r.cacheCreationTokens}</TabularText>
              </td>
              <td className="px-4 py-2 text-right">
                <TabularText>{r.cacheReadTokens}</TabularText>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SurfaceCard>
  )
}
