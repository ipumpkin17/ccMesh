import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NavMode = 'horizontal' | 'vertical'
export type SidebarState = 'expanded' | 'collapsed'
export type EndpointView = 'list' | 'grid'
export type ViewId = 'dashboard' | 'endpoints' | 'configProfiles' | 'statistics' | 'logs' | 'settings'

/** 可在导航中显隐的业务页（不含设置/关于）。 */
export type NavPageId = 'dashboard' | 'endpoints' | 'configProfiles' | 'statistics' | 'logs'

export const NAV_PAGE_IDS: NavPageId[] = ['dashboard', 'endpoints', 'configProfiles', 'statistics', 'logs']

export type Lang = 'zh' | 'en'

interface LayoutState {
  navMode: NavMode
  sidebarState: SidebarState
  activeView: ViewId
  lang: Lang
  endpointView: EndpointView
  /** 隐藏的业务导航页；默认空=全部显示。 */
  hiddenNavIds: NavPageId[]
  setNavMode: (mode: NavMode) => void
  toggleNavMode: () => void
  setSidebarState: (state: SidebarState) => void
  toggleSidebar: () => void
  setActiveView: (view: ViewId) => void
  toggleLang: () => void
  setEndpointView: (view: EndpointView) => void
  toggleEndpointView: () => void
  setNavPageVisible: (id: NavPageId, visible: boolean) => void
  isNavPageVisible: (id: NavPageId) => boolean
}

function normalizeHidden(ids: NavPageId[] | undefined): NavPageId[] {
  if (!Array.isArray(ids)) return []
  const allowed = new Set<string>(NAV_PAGE_IDS)
  const seen = new Set<NavPageId>()
  const out: NavPageId[] = []
  for (const id of ids) {
    if (!allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  // 至少保留一个业务页可见，避免导航只剩设置/关于
  if (out.length >= NAV_PAGE_IDS.length) {
    return out.filter((id) => id !== 'dashboard')
  }
  return out
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      navMode: 'vertical',
      sidebarState: 'expanded',
      activeView: 'dashboard',
      lang: 'zh',
      endpointView: 'list',
      hiddenNavIds: [],
      setNavMode: (navMode) => set({ navMode }),
      toggleNavMode: () =>
        set((s) => ({
          navMode: s.navMode === 'horizontal' ? 'vertical' : 'horizontal',
        })),
      setSidebarState: (sidebarState) => set({ sidebarState }),
      toggleSidebar: () =>
        set((s) => ({
          sidebarState: s.sidebarState === 'expanded' ? 'collapsed' : 'expanded',
        })),
      setActiveView: (activeView) => set({ activeView }),
      toggleLang: () => set((s) => ({ lang: s.lang === 'zh' ? 'en' : 'zh' })),
      setEndpointView: (endpointView) => set({ endpointView }),
      toggleEndpointView: () =>
        set((s) => ({
          endpointView: s.endpointView === 'list' ? 'grid' : 'list',
        })),
      setNavPageVisible: (id, visible) =>
        set((s) => {
          const hidden = new Set(normalizeHidden(s.hiddenNavIds))
          if (visible) hidden.delete(id)
          else hidden.add(id)
          const nextHidden = normalizeHidden([...hidden])
          // 若当前页被隐藏，跳到第一个仍可见的业务页
          let activeView = s.activeView
          if (!visible && activeView === id && nextHidden.includes(id as NavPageId)) {
            const fallback = NAV_PAGE_IDS.find((pageId) => !nextHidden.includes(pageId)) ?? 'settings'
            activeView = fallback
          }
          return { hiddenNavIds: nextHidden, activeView }
        }),
      isNavPageVisible: (id) => !get().hiddenNavIds.includes(id),
    }),
    {
      name: 'layout-prefs',
      partialize: (s) => ({
        navMode: s.navMode,
        sidebarState: s.sidebarState,
        lang: s.lang,
        endpointView: s.endpointView,
        hiddenNavIds: s.hiddenNavIds,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutState>
        return {
          ...current,
          ...p,
          hiddenNavIds: normalizeHidden(p.hiddenNavIds),
        }
      },
    },
  ),
)
