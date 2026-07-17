import type { ReactNode } from 'react'

import { ConfigurationFormLayout } from '@/components/settings/foundation/ConfigurationFormLayout'

export interface SettingsFormField {
  id: string
  label: ReactNode
  control: ReactNode
}

/** 设置表单的统一字段栅格和操作区。 */
export function SettingsForm({ fields, actions, columns = 'one' }: { fields: readonly SettingsFormField[]; actions?: ReactNode; columns?: 'one' | 'two' }) {
  return <ConfigurationFormLayout fields={fields} actions={actions} columns={columns} />
}
