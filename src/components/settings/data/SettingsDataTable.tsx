import type { ReactNode } from 'react'

import { tableHeadClass } from '@/lib/typography'
import { Button } from '@/components/ui/button'

export interface SettingsDataTableColumn {
  label: ReactNode
  align?: 'left' | 'right'
}

/** 设置页的紧凑数据表，统一表头、单元格和操作列对齐。 */
export function SettingsDataTable({ columns, rows }: { columns: readonly SettingsDataTableColumn[]; rows: readonly ReactNode[][] }) {
  return (
    <div className="border-edge-subtle bg-surface-raised overflow-hidden rounded-lg border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-edge-subtle border-b">
            {columns.map((column, index) => (
              <th key={index} className={`px-4 py-2 ${column.align === 'right' ? 'text-right' : 'text-left'} ${tableHeadClass}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-edge-subtle border-b last:border-0">
              {row.map((cell, columnIndex) => (
                <td key={columnIndex} className={`px-4 py-2 ${columns[columnIndex]?.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 数据表中并列的文本操作，统一尺寸和颜色。 */
export function SettingsTableActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-1">{children}</div>
}

/** 数据表的文本型行操作统一颜色、尺寸与悬停状态。 */
export function SettingsTableAction({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="xs" variant="ghost" className="text-ink-secondary hover:text-ink-primary" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  )
}
