import { lazy, Suspense, useEffect, type ComponentType } from 'react'

import { cn } from '@/lib/utils'
import { NAV_PAGE_IDS, useLayoutStore, type NavPageId, type ViewId } from '@/stores'
import { TopNav } from './TopNav'
import { SideNav } from './SideNav'
import { TitleBar } from './TitleBar'

// 6 个页面懒加载，各自拆为独立 chunk，仅在切换到对应视图时加载
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Endpoints = lazy(() => import('@/pages/Endpoints').then((m) => ({ default: m.Endpoints })))
const ConfigProfiles = lazy(() => import('@/pages/ConfigProfiles').then((m) => ({ default: m.ConfigProfiles })))
const Statistics = lazy(() => import('@/pages/Statistics').then((m) => ({ default: m.Statistics })))
const Logs = lazy(() => import('@/pages/Logs').then((m) => ({ default: m.Logs })))
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })))
const PAGES: Record<ViewId, ComponentType> = {
  dashboard: Dashboard,
  endpoints: Endpoints,
  configProfiles: ConfigProfiles,
  statistics: Statistics,
  logs: Logs,
  settings: Settings,
}

export function AppLayout() {
  const navMode = useLayoutStore((s) => s.navMode)
  const activeView = useLayoutStore((s) => s.activeView)
  const hiddenNavIds = useLayoutStore((s) => s.hiddenNavIds)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => {
      const store = useLayoutStore.getState()
      if (store.navMode === 'vertical' && e.matches) {
        store.setSidebarState('collapsed')
      }
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // 业务页被隐藏后，自动切到第一个可见页
  useEffect(() => {
    if (!NAV_PAGE_IDS.includes(activeView as NavPageId)) return
    if (!hiddenNavIds.includes(activeView as NavPageId)) return
    const fallback = NAV_PAGE_IDS.find((id) => !hiddenNavIds.includes(id)) ?? 'settings'
    useLayoutStore.getState().setActiveView(fallback)
  }, [activeView, hiddenNavIds])

  const ActivePage = PAGES[activeView]

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      <TitleBar />
      <div className={cn('flex flex-1 overflow-hidden', navMode === 'vertical' ? 'flex-row' : 'flex-col')}>
        {navMode === 'horizontal' ? <TopNav /> : <SideNav />}
        <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="h-full min-h-0 w-full min-w-3xl">
            <Suspense fallback={null}>
              <ActivePage />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
