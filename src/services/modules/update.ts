import type { UnlistenFn } from '@tauri-apps/api/event'
import { getVersion } from '@tauri-apps/api/app'
import { openUrl } from '@tauri-apps/plugin-opener'

import { Events, request, subscribe } from '../request'

export interface UpdateInfo {
  available: boolean
  version: string
  currentVersion: string
  notes: string
}

export interface UpdateSettings {
  autoCheck: boolean
  checkInterval: number
  skippedVersion: string
}

export interface DownloadProgress {
  downloaded: number
  total: number | null
}

export const GITHUB_REPO_URL = 'https://github.com/ipumpkin17/ccMesh'
export const GITHUB_RELEASES_URL = 'https://github.com/ipumpkin17/ccMesh/releases'
/** 与 tauri.conf.json plugins.updater.endpoints 保持一致，便于排查。 */
export const UPDATE_LATEST_JSON_URL = 'https://github.com/ipumpkin17/ccMesh/releases/latest/download/latest.json'

export async function openGitHubRepo() {
  await openUrl(GITHUB_REPO_URL)
}

export async function openReleases() {
  await openUrl(GITHUB_RELEASES_URL)
}

export async function getAppVersion(): Promise<string> {
  return getVersion()
}

export const updateApi = {
  check: () => request<UpdateInfo>('check_for_updates'),
  installUpdateAndRestart: () => request<void>('install_update_and_restart'),
  getSettings: () => request<UpdateSettings>('get_update_settings'),
  setSettings: (autoCheck: boolean, checkInterval: number) => request<void>('set_update_settings', { autoCheck, checkInterval }),
  skipVersion: (version: string) => request<void>('skip_version', { version }),
  onProgress: (cb: (p: DownloadProgress) => void): Promise<UnlistenFn> => subscribe<DownloadProgress>(Events.updateProgress, (e) => cb(e.payload)),
}
