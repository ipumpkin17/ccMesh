import type { ReactNode } from 'react'

import { ConfigurationActionGroup } from '@/components/settings/foundation/ConfigurationActionGroup'
import { ConfigurationModule } from '@/components/settings/foundation/ConfigurationModule'

type SettingsSectionLayout = 'rows' | 'panel' | 'plain'

/** 设置中心模块的唯一入口，统一标题、说明、卡片和内容留白。 */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  layout = 'rows',
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  layout?: SettingsSectionLayout
}) {
  if (layout === 'plain') {
    return (
      <ConfigurationModule title={title} description={description} actions={actions} surface={false}>
        {children}
      </ConfigurationModule>
    )
  }

  if (layout === 'panel') {
    return (
      <ConfigurationModule title={title} description={description} actions={actions}>
        {children}
      </ConfigurationModule>
    )
  }

  return (
    <ConfigurationModule title={title} description={description} actions={actions} surface={false}>
      <ConfigurationActionGroup>{children}</ConfigurationActionGroup>
    </ConfigurationModule>
  )
}
