import { useEffect } from 'react'

import { updateApi } from '@/services/modules/update'
import { useUpdateStore } from '@/stores/modules/update'

/** 启动时按设置检查更新；有新版本（且未跳过）则置红点。 */
export function useUpdate() {
  const setFromInfo = useUpdateStore((s) => s.setFromInfo)

  useEffect(() => {
    updateApi
      .getSettings()
      .then((settings) => {
        if (!settings.autoCheck) return
        updateApi
          .check()
          .then((info) => {
            setFromInfo(info, settings.skippedVersion)
          })
          .catch(() => undefined)
      })
      .catch(() => undefined)
  }, [setFromInfo])
}
