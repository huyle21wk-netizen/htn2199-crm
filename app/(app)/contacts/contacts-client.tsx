'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Plus,
  Upload,
  Search,
  X,
  Phone,
  MessageSquare,
  MessageCircle,
  FileText,
  Pencil,
  Trash2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
import { createClient } from '@/lib/supabase/client'
import { phoneForUrl } from '@/lib/phone'
import { deleteContact } from '@/app/actions/contacts'
import { Skeleton } from '@/components/ui/skeleton'
import type { Contact, Stage, Project } from '@/lib/types'
import { ContactFormModal } from './contact-form-modal'
import { ContactDetailDrawer } from './contact-detail-drawer'
import { ContactLogModal } from './contact-log-modal'
import { PhoneDisplay } from '@/components/phone-display'
import { QuickLogSheet } from '@/components/quick-log-sheet'

const PAGE_SIZE = 50
const QUICK_LOG_KEY = 'crm-quick-log-pending'

interface ContactsClientProps {
  stages: Stage[]
  projects: Project[]
}

export function ContactsClient({ stages, projects }: ContactsClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [softFlags, setSoftFlags] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)

  // Filters
  const [searchName, setSearchName] = useState('')
  const [searchPhone, setSearchPhone] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [showAll, setShowAll] = useState(false)

  // Modals
  const [formOpen, setFormOpen] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null)
  const [logContact, setLogContact] = useState<Contact | null>(null)
  const [logChannel, setLogChannel] = useState<'call' | 'zalo' | 'sms' | 'meeting' | 'email' | undefined>()
  const [logDefaultNotes, setLogDefaultNotes] = useState<string | undefined>()
  const [quickLogContact, setQuickLogContact] = useState<Contact | null>(null)
  const [quickLogChannel, setQuickLogChannel] = useState<'call' | 'zalo' | 'sms' | undefined>()
  const [quickLogOpen, setQuickLogOpen] = useState(false)

  const rawStage = stages.find((s) => s.is_raw)
  const badNumberStage = stages.find((s) => s.is_bad_number)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('contacts')
        .select(
          '*, stage:stages(*), project:projects(*)',
          { count: 'exact' }
        )

      // Stage filter: default = raw only, showAll = exclude bad_number
      if (!showAll) {
        if (rawStage) query = query.eq('stage_id', rawStage.id)
      } else {
        if (badNumberStage) query = query.neq('stage_id', badNumberStage.id)
      }

      if (searchName.trim()) {
        query = query.ilike('name', `%${searchName.trim()}%`)
      }
      if (searchPhone.trim()) {
        const cleaned = searchPhone.replace(/\s/g, '')
        query = query.ilike('phone', `%${cleaned}%`)
      }
      if (filterProject !== 'all') {
        if (filterProject === 'none') {
          query = query.is('project_id', null)
        } else {
          query = query.eq('project_id', filterProject)
        }
      }

      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      setContacts(data ?? [])
      setTotal(count ?? 0)

      // Fetch soft flags for visible contacts
      if (data && data.length > 0) {
        const ids = data.map((c) => c.id)
        const { data: logs } = await supabase
          .from('contact_logs')
          .select('contact_id, outcome, created_at')
          .in('contact_id', ids)
          .eq('status', 'done')
          .order('created_at', { ascending: false })

        if (logs) {
          // For each contact, find the latest done log
          const latestByContact = new Map<string, string | null>()
          for (const log of logs) {
            if (!latestByContact.has(log.contact_id)) {
              latestByContact.set(log.contact_id, log.outcome)
            }
          }
          const flags = new Set<string>()
          latestByContact.forEach((outcome, contactId) => {
            if (outcome === 'not_interested') flags.add(contactId)
          })
          setSoftFlags(flags)
        }
      } else {
        setSoftFlags(new Set())
      }
    } catch {
      toast.error('Không thể tải danh sách liên hệ.')
    } finally {
      setLoading(false)
    }
  }, [supabase, showAll, searchName, searchPhone, filterProject, page, rawStage, badNumberStage])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [searchName, searchPhone, filterProject, showAll])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const result = await deleteContact(deleteTarget.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Đã xoá liên hệ.')
      fetchContacts()
    }
    setDeleteTarget(null)
  }

  const triggerContactAction = (contact: Contact, channel: 'call' | 'sms' | 'zalo') => {
    sessionStorage.setItem(QUICK_LOG_KEY, JSON.stringify({
      contactId: contact.id,
      channel,
      triggeredAt: Date.now(),
    }))
    const stripped = phoneForUrl(contact.phone)
    if (channel === 'zalo') {
      window.open(`https://zalo.me/${stripped}`, '_blank')
    } else if (channel === 'call') {
      window.location.href = `tel:${stripped}`
    } else {
      window.location.href = `sms:${stripped}`
    }
  }

  const handleZalo = (contact: Contact) => triggerContactAction(contact, 'zalo')
  const handleCall = (contact: Contact) => triggerContactAction(contact, 'call')
  const handleSms = (contact: Contact) => triggerContactAction(contact, 'sms')

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return
      const raw = sessionStorage.getItem(QUICK_LOG_KEY)
      if (!raw) return
      try {
        const pending = JSON.parse(raw)
        if (Date.now() - pending.triggeredAt > 30 * 60 * 1000) {
          sessionStorage.removeItem(QUICK_LOG_KEY)
          return
        }
        sessionStorage.removeItem(QUICK_LOG_KEY)
        const contact = contacts.find((c) => c.id === pending.contactId)
        if (!contact) return
        if (window.innerWidth < 768) {
          setQuickLogContact(contact)
          setQuickLogChannel(pending.channel)
          setQuickLogOpen(true)
        } else {
          setLogContact(contact)
          setLogChannel(pending.channel)
        }
      } catch {}
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [contacts])

  const handleFormClose = (saved: boolean) => {
    setFormOpen(false)
    setEditContact(null)
    if (saved) fetchContacts()
  }

  const handleLogClose = (saved: boolean) => {
    setLogContact(null)
    setLogChannel(undefined)
    setLogDefaultNotes(undefined)
    if (saved) {
      fetchContacts()
      // Also refresh drawer if open
      if (drawerContact) {
        setDrawerContact((prev) =>
          prev ? { ...prev } : null
        )
      }
    }
  }

  const clearFilters = () => {
    setSearchName('')
    setSearchPhone('')
    setFilterProject('all')
    setShowAll(false)
  }

  const hasFilters =
    searchName || searchPhone || filterProject !== 'all' || showAll

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Liên hệ</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/contacts/import')}
          >
            <Upload className="h-4 w-4" />
            Import file
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:from-[#6D28D9] hover:to-[#8B5CF6] text-white border-0"
            onClick={() => {
              setEditContact(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Thêm liên hệ
          </Button>
        </div>
      </div>

      {/* Filter bar */}
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
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Hiện tất cả
        </label>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-3 py-2"><Skeleton className="h-3 w-12" /></th>
                  <th className="text-left px-3 py-2"><Skeleton className="h-3 w-16" /></th>
                  <th className="text-left px-3 py-2 hidden sm:table-cell"><Skeleton className="h-3 w-14" /></th>
                  <th className="text-left px-3 py-2 hidden md:table-cell"><Skeleton className="h-3 w-12" /></th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell"><Skeleton className="h-3 w-18" /></th>
                  <th className="text-right px-3 py-2"><Skeleton className="h-3 w-14 ml-auto" /></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2"><Skeleton className="h-3 w-28" /></td>
                    <td className="px-3 py-2"><Skeleton className="h-3 w-24" /></td>
                    <td className="px-3 py-2 hidden sm:table-cell"><Skeleton className="h-3 w-20" /></td>
                    <td className="px-3 py-2 hidden md:table-cell"><Skeleton className="h-3 w-16" /></td>
                    <td className="px-3 py-2 hidden lg:table-cell"><Skeleton className="h-3 w-18" /></td>
                    <td className="px-3 py-2"><div className="flex justify-end gap-1"><Skeleton className="h-6 w-6 rounded" /><Skeleton className="h-6 w-6 rounded" /><Skeleton className="h-6 w-6 rounded" /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          hasFilters={!!hasFilters}
          onAdd={() => setFormOpen(true)}
          onImport={() => router.push('/contacts/import')}
          onClearFilters={clearFilters}
        />
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tên</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">SĐT</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Dự án</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Nguồn</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Ngày tạo</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => {
                    const hasFlag = softFlags.has(contact.id)
                    return (
                      <tr
                        key={contact.id}
                        className="border-b border-border last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors"
                        onClick={() => setDrawerContact(contact)}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{contact.name}</span>
                            {hasFlag && (
                              <Tooltip>
                                <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
                                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Khách vừa nói không quan tâm
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          <PhoneDisplay phone={contact.phone} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                          {contact.project?.name ?? (
                            <span className="text-border">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                          {contact.source ?? <span className="text-border">—</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">
                          {new Date(contact.created_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-3 py-2">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Gọi điện"
                              aria-label={`Gọi ${contact.name}`}
                              onClick={() => handleCall(contact)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Nhắn tin SMS"
                              aria-label={`SMS ${contact.name}`}
                              onClick={() => handleSms(contact)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Nhắn Zalo"
                              aria-label={`Zalo ${contact.name}`}
                              onClick={() => handleZalo(contact)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Tạo log"
                              aria-label={`Tạo log cho ${contact.name}`}
                              onClick={() => {
                                setLogContact(contact)
                                setLogChannel(undefined)
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Sửa"
                              aria-label={`Sửa ${contact.name}`}
                              onClick={() => {
                                setEditContact(contact)
                                setFormOpen(true)
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Xoá"
                              aria-label={`Xoá ${contact.name}`}
                              onClick={() => setDeleteTarget(contact)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ContactFormModal
        open={formOpen}
        contact={editContact}
        projects={projects}
        onClose={handleFormClose}
      />

      {logContact && (
        <ContactLogModal
          contact={logContact}
          stages={stages}
          defaultChannel={logChannel}
          defaultNotes={logDefaultNotes}
          onClose={handleLogClose}
        />
      )}

      {drawerContact && (
        <ContactDetailDrawer
          contact={drawerContact}
          stages={stages}
          projects={projects}
          onClose={() => setDrawerContact(null)}
          onEdit={(c) => {
            setEditContact(c)
            setFormOpen(true)
          }}
          onDelete={(c) => setDeleteTarget(c)}
          onNewLog={(c) => {
            setLogContact(c)
            setLogChannel(undefined)
          }}
          onZalo={handleZalo}
          onCall={handleCall}
          onSms={handleSms}
          onRefresh={fetchContacts}
        />
      )}

      {quickLogContact && quickLogChannel && (
        <QuickLogSheet
          open={quickLogOpen}
          contact={quickLogContact}
          channel={quickLogChannel}
          onClose={(saved) => {
            setQuickLogOpen(false)
            setQuickLogContact(null)
            setQuickLogChannel(undefined)
            if (saved) fetchContacts()
          }}
          onOpenFullLog={(c, ch, notes) => {
            setQuickLogOpen(false)
            setQuickLogContact(null)
            setQuickLogChannel(undefined)
            setLogContact(c)
            setLogChannel(ch)
            setLogDefaultNotes(notes)
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá liên hệ?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xoá <strong>{deleteTarget?.name}</strong>? Tất cả lịch sử liên hệ sẽ bị xoá theo.
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState({
  hasFilters,
  onAdd,
  onImport,
  onClearFilters,
}: {
  hasFilters: boolean
  onAdd: () => void
  onImport: () => void
  onClearFilters: () => void
}) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="p-4 rounded-full bg-secondary">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Không tìm thấy liên hệ phù hợp</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Thử thay đổi từ khoá hoặc bộ lọc
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4" />
          Xoá bộ lọc
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="p-4 rounded-full bg-accent">
        <Users className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">Chưa có liên hệ nào</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Thêm thủ công hoặc import từ file CSV/Excel
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onImport}>
          <Upload className="h-4 w-4" />
          Import file
        </Button>
        <Button
          size="sm"
          className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:from-[#6D28D9] hover:to-[#8B5CF6] text-white border-0"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
          Thêm liên hệ
        </Button>
      </div>
    </div>
  )
}
