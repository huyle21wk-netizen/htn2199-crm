'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Trash2, RotateCcw, Download, Search, X, PhoneOff, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { deleteContact, restoreFromBadNumbers } from '@/app/actions/contacts'
import type { Contact, Project } from '@/lib/types'

type BadContact = Contact & {
  project: Project | null
  last_log_date?: string | null
}

interface BadNumbersClientProps {
  initialBadStageId: string | null
  projects: Project[]
}

export function BadNumbersClient({ initialBadStageId, projects }: BadNumbersClientProps) {
  const supabase = createClient()
  const [contacts, setContacts] = useState<BadContact[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchName, setSearchName] = useState('')
  const [searchPhone, setSearchPhone] = useState('')
  const [filterProject, setFilterProject] = useState('all')
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false)
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<BadContact | null>(null)
  const [singleRestoreTarget, setSingleRestoreTarget] = useState<BadContact | null>(null)
  const [working, setWorking] = useState(false)

  const fetchContacts = useCallback(async () => {
    if (!initialBadStageId) { setLoading(false); return }
    setLoading(true)
    let query = supabase
      .from('contacts')
      .select('*, project:projects(*)')
      .eq('stage_id', initialBadStageId)
      .order('created_at', { ascending: false })

    if (searchName.trim()) query = query.ilike('name', `%${searchName.trim()}%`)
    if (searchPhone.trim()) query = query.ilike('phone', `%${searchPhone.trim().replace(/\s/g, '')}%`)
    if (filterProject !== 'all') {
      if (filterProject === 'none') query = query.is('project_id', null)
      else query = query.eq('project_id', filterProject)
    }

    const { data } = await query
    if (!data) { setLoading(false); return }

    // Fetch last log date for each contact
    const ids = data.map((c) => c.id)
    if (ids.length > 0) {
      const { data: logs } = await supabase
        .from('contact_logs')
        .select('contact_id, scheduled_for')
        .in('contact_id', ids)
        .eq('status', 'done')
        .order('scheduled_for', { ascending: false })

      const lastLogMap: Record<string, string> = {}
      for (const log of logs ?? []) {
        if (!lastLogMap[log.contact_id]) {
          lastLogMap[log.contact_id] = log.scheduled_for
        }
      }
      setContacts(data.map((c) => ({ ...c, last_log_date: lastLogMap[c.id] ?? null })))
    } else {
      setContacts([])
    }
    setLoading(false)
  }, [initialBadStageId, searchName, searchPhone, filterProject])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map((c) => c.id)))
    }
  }

  const clearFilters = () => {
    setSearchName('')
    setSearchPhone('')
    setFilterProject('all')
  }
  const hasFilters = searchName || searchPhone || filterProject !== 'all'

  // ── Single actions ──────────────────────────────────────────
  const handleSingleDelete = async () => {
    if (!singleDeleteTarget) return
    setWorking(true)
    const result = await deleteContact(singleDeleteTarget.id)
    setWorking(false)
    setSingleDeleteTarget(null)
    if (result.error) {
      toast.error('Không thể xoá. Vui lòng thử lại.')
    } else {
      toast.success('Đã xoá vĩnh viễn.')
      setSelected((prev) => { const n = new Set(prev); n.delete(singleDeleteTarget.id); return n })
      fetchContacts()
    }
  }

  const handleSingleRestore = async () => {
    if (!singleRestoreTarget) return
    setWorking(true)
    const result = await restoreFromBadNumbers(singleRestoreTarget.id)
    setWorking(false)
    setSingleRestoreTarget(null)
    if (result.error) {
      toast.error('Không thể khôi phục. Vui lòng thử lại.')
    } else {
      toast.success(`Đã khôi phục "${singleRestoreTarget.name}" về Raw.`)
      setSelected((prev) => { const n = new Set(prev); n.delete(singleRestoreTarget.id); return n })
      fetchContacts()
    }
  }

  // ── Bulk actions ──────────────────────────────────────────
  const handleBulkDelete = async () => {
    setWorking(true)
    let failed = 0
    for (const id of selected) {
      const result = await deleteContact(id)
      if (result.error) failed++
    }
    setWorking(false)
    setBulkDeleteOpen(false)
    if (failed > 0) {
      toast.error(`${failed} liên hệ không thể xoá.`)
    } else {
      toast.success(`Đã xoá ${selected.size} liên hệ.`)
    }
    setSelected(new Set())
    fetchContacts()
  }

  const handleBulkRestore = async () => {
    setWorking(true)
    let failed = 0
    for (const id of selected) {
      const result = await restoreFromBadNumbers(id)
      if (result.error) failed++
    }
    setWorking(false)
    setBulkRestoreOpen(false)
    if (failed > 0) {
      toast.error(`${failed} liên hệ không thể khôi phục.`)
    } else {
      toast.success(`Đã khôi phục ${selected.size} liên hệ về Raw.`)
    }
    setSelected(new Set())
    fetchContacts()
  }

  // ── Export CSV ──────────────────────────────────────────
  const handleExportCSV = () => {
    if (contacts.length === 0) { toast.error('Không có dữ liệu để xuất.'); return }
    const rows = [
      ['Tên', 'SĐT', 'Dự án', 'Ngày tạo', 'Log gần nhất'],
      ...contacts.map((c) => [
        c.name,
        c.phone,
        c.project?.name ?? '',
        format(new Date(c.created_at), 'dd/MM/yyyy', { locale: vi }),
        c.last_log_date ? format(new Date(c.last_log_date), 'dd/MM/yyyy', { locale: vi }) : '',
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `so-rac-${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất CSV.')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Số rác</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkRestoreOpen(true)}
                disabled={working}
              >
                <RotateCcw className="h-4 w-4" />
                Khôi phục ({selected.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={working}
              >
                <Trash2 className="h-4 w-4" />
                Xoá ({selected.size})
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            Xuất CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 w-44 text-sm"
            placeholder="Tìm theo tên"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>
        <Input
          className="h-8 w-40 text-sm"
          placeholder="Tìm theo SĐT"
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
        />
        <Select value={filterProject} onValueChange={(v) => setFilterProject(v ?? 'all')} items={[{value: 'all', label: 'Tất cả dự án'}, {value: 'none', label: 'Không có dự án'}, ...projects.map(p => ({value: p.id, label: p.name}))]}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Tất cả dự án" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả dự án</SelectItem>
            <SelectItem value="none">Không có dự án</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
            <X className="h-3.5 w-3.5" />
            Xoá bộ lọc
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-3 py-2 w-10" />
                {['Tên', 'SĐT', 'Dự án', 'Ngày tạo', 'Log gần nhất', ''].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2">
                    <Skeleton className="h-3 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 w-10"><Skeleton className="h-4 w-4" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-3 w-28" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-3 w-24" /></td>
                  <td className="px-3 py-2 hidden sm:table-cell"><Skeleton className="h-3 w-20" /></td>
                  <td className="px-3 py-2 hidden md:table-cell"><Skeleton className="h-3 w-18" /></td>
                  <td className="px-3 py-2 hidden lg:table-cell"><Skeleton className="h-3 w-18" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-6 w-24 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="p-4 rounded-full bg-secondary">
            <PhoneOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {hasFilters ? 'Không tìm thấy kết quả' : 'Không có số rác'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters
                ? 'Thử thay đổi bộ lọc'
                : 'Các số được đánh dấu rác sẽ xuất hiện ở đây'}
            </p>
          </div>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Xoá bộ lọc
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-3 py-2 w-10">
                    <Checkbox
                      checked={contacts.length > 0 && selected.size === contacts.length}
                      onCheckedChange={toggleAll}
                      aria-label="Chọn tất cả"
                    />
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tên</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">SĐT</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Dự án</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Ngày tạo</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Log gần nhất</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-3 py-2 w-10">
                      <Checkbox
                        checked={selected.has(contact.id)}
                        onCheckedChange={() => toggleSelect(contact.id)}
                        aria-label={`Chọn ${contact.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{contact.name}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{contact.phone}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                      {contact.project?.name ?? <span className="text-border">—</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                      {format(new Date(contact.created_at), 'dd/MM/yyyy', { locale: vi })}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">
                      {contact.last_log_date
                        ? format(new Date(contact.last_log_date), 'dd/MM/yyyy', { locale: vi })
                        : <span className="text-border">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSingleRestoreTarget(contact)}
                          disabled={working}
                          aria-label={`Khôi phục ${contact.name}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Khôi phục</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setSingleDeleteTarget(contact)}
                          disabled={working}
                          aria-label={`Xoá vĩnh viễn ${contact.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Xoá</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single delete confirm */}
      <AlertDialog open={!!singleDeleteTarget} onOpenChange={(o) => !o && setSingleDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá vĩnh viễn?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xoá <strong>{singleDeleteTarget?.name}</strong>? Hành động này không thể hoàn tác.
              Tất cả log liên quan sẽ bị xoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleSingleDelete}
              disabled={working}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Xoá vĩnh viễn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single restore confirm */}
      <AlertDialog open={!!singleRestoreTarget} onOpenChange={(o) => !o && setSingleRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Khôi phục liên hệ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{singleRestoreTarget?.name}</strong> sẽ được trả về giai đoạn Raw.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleSingleRestore} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Khôi phục'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá {selected.size} số rác?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Tất cả log liên quan sẽ bị xoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={working}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : `Xoá ${selected.size} liên hệ`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk restore confirm */}
      <AlertDialog open={bulkRestoreOpen} onOpenChange={(o) => !o && setBulkRestoreOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Khôi phục {selected.size} liên hệ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tất cả sẽ được trả về giai đoạn Raw.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkRestore} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : `Khôi phục ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
