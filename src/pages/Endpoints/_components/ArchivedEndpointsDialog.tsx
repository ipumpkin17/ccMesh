import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArchiveRestoreIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { EndpointLabel } from '@/components/business'
import { EmptyState } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { endpointApi, type Endpoint } from '@/services/modules/endpoint'
import { metaClass } from '@/lib/typography'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 归档端点列表弹窗：显示所有已归档端点，支持还原和删除操作。
 */
export function ArchivedEndpointsDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient()
  const { data: archived, isLoading } = useQuery({
    queryKey: ['archived-endpoints'],
    queryFn: () => endpointApi.listArchived(),
    enabled: open,
  })

  const [deleteTarget, setDeleteTarget] = useState<Endpoint | null>(null)

  const unarchive = useMutation({
    mutationFn: (id: number) => endpointApi.unarchive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoints'] })
      qc.invalidateQueries({ queryKey: ['archived-endpoints'] })
      toast.success('端点已还原到列表末尾')
    },
    onError: (err) => toast.error(`还原失败：${errMsg(err)}`),
  })

  const del = useMutation({
    mutationFn: (id: number) => endpointApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archived-endpoints'] })
      setDeleteTarget(null)
      toast.success('端点已彻底删除')
    },
    onError: (err) => toast.error(`删除失败：${errMsg(err)}`),
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>归档端点</DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] scrollbar-none overflow-y-auto">
            {isLoading ? (
              <EmptyState align="center" className="py-8">
                加载中…
              </EmptyState>
            ) : !archived || archived.length === 0 ? (
              <EmptyState align="center" className="py-8">
                暂无归档端点
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {archived.map((ep) => {
                  return (
                    <Card key={ep.id}>
                      <CardContent className="flex items-center gap-3 px-4 py-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <EndpointLabel name={ep.name} type={ep.transformer} size={18} nameClassName="font-medium text-ink-primary" />
                            <Badge variant="muted">{ep.transformer}</Badge>
                          </div>
                          <span className={`truncate ${metaClass}`}>{ep.apiUrl}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => unarchive.mutate(ep.id)} disabled={unarchive.isPending}>
                            <ArchiveRestoreIcon className="size-4" />
                            还原
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(ep)} disabled={del.isPending}>
                            <Trash2Icon className="size-4" />
                            删除
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-ink-secondary text-sm">
            确定删除端点「<span className="font-medium">{deleteTarget?.name}</span>
            」吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => {
                if (deleteTarget) del.mutate(deleteTarget.id)
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
