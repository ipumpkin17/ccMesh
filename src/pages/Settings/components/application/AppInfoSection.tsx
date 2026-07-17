import { useEffect, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { toast } from 'sonner'

import { SettingsAppInfo, SettingsAppInfoStatus } from '@/components/settings'
import { getAppVersion, openGitHubRepo, openReleases, updateApi, type UpdateInfo } from '@/services/modules/update'
import { useUpdateStore } from '@/stores/modules/update'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

const GUIDE_URL = 'https://vkrainb.github.io/ccMesh/guide/quickstart.html'

export function AppInfoSection() {
  const [version, setVersion] = useState('')
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const setUpdate = useUpdateStore((s) => s.set)
  const setUpdateFromInfo = useUpdateStore((s) => s.setFromInfo)

  useEffect(() => {
    getAppVersion()
      .then(setVersion)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    updateApi
      .onProgress((p) => {
        setProgress(p.total ? Math.round((p.downloaded / p.total) * 100) : null)
      })
      .then((u) => {
        unlisten = u
      })
    return () => unlisten?.()
  }, [])

  const check = async () => {
    setChecking(true)
    try {
      const i = await updateApi.check()
      setInfo(i)
      setUpdateFromInfo(i)
      if (!i.available) toast.success('已是最新版本')
    } catch (e) {
      toast.error(`检查失败：${errMsg(e)}`)
    } finally {
      setChecking(false)
    }
  }

  const download = async () => {
    try {
      toast.info('开始下载更新…')
      await updateApi.installUpdateAndRestart()
    } catch (e) {
      toast.error(`下载失败：${errMsg(e)}`)
    }
  }

  const skip = async () => {
    if (!info) return
    await updateApi.skipVersion(info.version).catch(() => undefined)
    setUpdate(false, '')
    setInfo(null)
    toast.success(`已跳过 ${info.version}`)
  }

  return (
    <>
      <SettingsAppInfo
        version={version}
        checking={checking}
        onCheck={check}
        links={[
          { label: 'GitHub', onClick: openGitHubRepo },
          { label: '更新日志', onClick: openReleases },
          { label: '软件说明手册', onClick: () => openUrl(GUIDE_URL).catch((e) => toast.error(errMsg(e))) },
        ]}
        update={
          info?.available
            ? {
                version: info.version,
                notes: info.notes,
                progress,
                onInstall: download,
                onSkip: skip,
              }
            : null
        }
      />
      <SettingsAppInfoStatus checked={Boolean(info && !info.available)} />
    </>
  )
}
