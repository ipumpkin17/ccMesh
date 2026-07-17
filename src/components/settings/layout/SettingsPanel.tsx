import type { ReactNode } from 'react'

import { ConfigurationPanelContent } from '@/components/settings/foundation/ConfigurationPanelContent'

/** 非表单模块的标准内容留白。 */
export function SettingsPanel({ children }: { children: ReactNode }) {
  return <ConfigurationPanelContent>{children}</ConfigurationPanelContent>
}
