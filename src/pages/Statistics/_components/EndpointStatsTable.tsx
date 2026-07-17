import { TabularText } from '@/components/ui'
import type { EndpointStat } from '@/services/modules/stats'
import { emptyClass, tableHeadClass } from '@/lib/typography'

interface Props {
  rows: EndpointStat[]
}

/** 每端点统计明细表。 */
export function EndpointStatsTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className={emptyClass}>该周期暂无数据</p>
  }
  return (
    <div className="border-edge-subtle bg-surface-card overflow-hidden rounded-lg border">
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
              <td className="px-4 py-2">{r.endpointName}</td>
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
    </div>
  )
}
