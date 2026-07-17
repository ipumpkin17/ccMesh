import { useQuery } from '@tanstack/react-query'
import { isEnabled } from '@tauri-apps/plugin-autostart'

/**
 * 系统自启状态（OS 级开关，由 `@tauri-apps/plugin-autostart` 持有，非应用 config 字段）。
 * 保持独立 queryKey；切换自启后由调用方 `invalidateQueries(["autostart-enabled"])` 失效。
 */
export function useAutostartEnabled() {
  return useQuery({ queryKey: ['autostart-enabled'], queryFn: () => isEnabled() })
}
