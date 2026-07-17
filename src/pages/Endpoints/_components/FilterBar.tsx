import { LayoutGridIcon, ListIcon, PlusIcon, SlidersHorizontalIcon } from 'lucide-react'

import { SearchBox } from '@/components/common/SearchBox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useFilterStore, useLayoutStore } from '@/stores'

import { TypeTabs } from './TypeTabs'
import { metaClass } from '@/lib/typography'

export function FilterBar({ onCreate }: { onCreate: () => void }) {
  const search = useFilterStore((s) => s.search)
  const enabledOnly = useFilterStore((s) => s.enabledOnly)
  const setSearch = useFilterStore((s) => s.setSearch)
  const setEnabledOnly = useFilterStore((s) => s.setEnabledOnly)
  const endpointView = useLayoutStore((s) => s.endpointView)
  const setEndpointView = useLayoutStore((s) => s.setEndpointView)

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {/* 左侧：类型 tabs 保持完整，空间不足时右侧操作整体换行 */}
      <TypeTabs />
      {/* 右侧：搜索 + 设置弹窗（仅启用 / 视图） + 新建 */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="搜索端点…" ariaLabel="搜索端点" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="显示与筛选">
              <SlidersHorizontalIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-56 rounded-md p-3">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <p className={`font-medium ${metaClass}`}>筛选</p>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="enabled-only-pop" className="text-sm">
                    仅启用
                  </Label>
                  <Switch id="enabled-only-pop" checked={enabledOnly} onCheckedChange={setEnabledOnly} />
                </div>
              </div>
              <div className="grid gap-2">
                <p className={`font-medium ${metaClass}`}>视图</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEndpointView('list')}
                    className={cn(
                      'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors',
                      endpointView === 'list' ? 'border-primary/30 bg-primary text-primary-foreground' : 'border-input bg-surface-raised hover:bg-surface-hover',
                    )}
                  >
                    <ListIcon className="size-3.5" /> 列表
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndpointView('grid')}
                    className={cn(
                      'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors',
                      endpointView === 'grid' ? 'border-primary/30 bg-primary text-primary-foreground' : 'border-input bg-surface-raised hover:bg-surface-hover',
                    )}
                  >
                    <LayoutGridIcon className="size-3.5" /> 网格
                  </button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Button onClick={onCreate}>
          <PlusIcon className="size-4" /> 新建端点
        </Button>
      </div>
    </div>
  )
}
