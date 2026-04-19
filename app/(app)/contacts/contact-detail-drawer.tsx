'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  X,
  Pencil,
  Trash2,
  MessageSquare,
  MessageCircle,
  Phone,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { deleteLog } from '@/app/actions/logs'
import { PhoneDisplay } from '@/components/phone-display'
import { Skeleton } from '@/components/ui/skeleton'
import type { Contact, ContactLog, Stage, Project } from '@/lib/types'
import { CHANNEL_LABELS, OUTCOME_LABELS } from '@/lib/types'

const QUICK_LOG_KEY = 'crm-quick-log-pending'

interface ContactDetailDrawerProps {
  contact: Contact
  stages: Stage[]
  projects: Project[]
  onClose: () => void
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
  onNewLog: (contact: Contact) => void
  onZalo: (contact: Contact) => void
  onCall?: (contact: Contact) => void
  onSms?: (contact: Contact) => void
  onRefresh: () => void
}

export function ContactDetailDrawer({
  contact,
  stages,
  onClose,
  onEdit,
  onDelete,
  onNewLog,
  onZalo,
  onCall,
  onSms,
  onRefresh,
}: ContactDetailDrawerProps) {
  const supabase = createClient()
  const [logs, setLogs] = useState<ContactLog[]>([])
  const [loading, setLoading] = useState(true)

  const defaultCall = (c: Contact) => {
    sessionStorage.setItem(QUICK_LOG_KEY, JSON.stringify({ contactId: c.id, channel: 'call', triggeredAt: Date.now() }))
    window.location.href = `tel:${phoneForUrl(c.phone)}`
  }
  const defaultSms = (c: Contact) => {
    sessionStorage.setItem(QUICK_LOG_KEY, JSON.stringify({ contactId: c.id, channel: 'sms', triggeredAt: Date.now() }))
    window.location.href = `sms:${phoneForUrl(c.phone)}`
  }
  const handleCall = onCall ?? defaultCall
  const handleSms = onSms ?? defaultSms

  const stage = stages.find((s) => s.id === contact.stage_id)

  const fetchLogs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('contact_logs')
      .select('*')
      .eq('contact_id', contact.id)
      .order('scheduled_for', { ascending: false })

    setLogs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [contact.id])

  const stageColor = stage?.color ?? '#6B7280'

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col" showCloseButton={false}>
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold truncate">
                {contact.name}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                <PhoneDisplay phone={contact.phone} />
              </p>
              <div className="mt-2">
                <Badge
                  className="text-xs font-medium border"
                  style={{
                    backgroundColor: stageColor + '20',
                    color: stageColor,
                    borderColor: stageColor + '40',
                  }}
                >
                  {stage?.name ?? 'Không xác định'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCall(contact)}
                title="Gọi điện"
                aria-label="Gọi điện"
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleSms(contact)}
                title="Nhắn tin SMS"
                aria-label="Nhắn tin SMS"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onZalo(contact)}
                title="Nhắn Zalo"
                aria-label="Nhắn Zalo"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(contact)}
                title="Sửa"
                aria-label="Sửa liên hệ"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(contact)}
                className="hover:text-destructive"
                title="Xoá"
                aria-label="Xoá liên hệ"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-4 py-4 space-y-4">
            {/* Info section */}
            <div className="space-y-2 text-sm">
              {contact.project && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Dự án</span>
                  <span>{contact.project.name}</span>
                </div>
              )}
              {contact.source && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Nguồn</span>
                  <span>{contact.source}</span>
                </div>
              )}
              {contact.note && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Ghi chú</span>
                  <span className="break-words">{contact.note}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">Ngày tạo</span>
                <span>
                  {format(new Date(contact.created_at), 'dd/MM/yyyy', { locale: vi })}
                </span>
              </div>
            </div>

            <Separator />

            {/* Logs section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Lịch sử liên hệ</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onNewLog(contact)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Tạo log mới
                </Button>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="p-3 rounded-full bg-secondary">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Chưa có lịch sử liên hệ</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Ghi lại cuộc gọi hoặc tin nhắn đầu tiên</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onNewLog(contact)}>
                    <FileText className="h-3.5 w-3.5" />
                    Tạo log đầu tiên
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <LogItem
                      key={log.id}
                      log={log}
                      onMarkDone={() => onNewLog(contact)}
                      onRefresh={fetchLogs}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function LogItem({
  log,
  onMarkDone,
  onRefresh,
}: {
  log: ContactLog
  onMarkDone: () => void
  onRefresh: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isPlanned = log.status === 'planned'
  const isOverdue = isPlanned && new Date(log.scheduled_for) < new Date()

  const outcomeColor = (outcome: string | null) => {
    switch (outcome) {
      case 'interested': return 'text-success'
      case 'not_interested': return 'text-destructive'
      case 'bad_number': return 'text-destructive'
      case 'deposited': return 'text-success'
      case 'closed': return 'text-success'
      case 'no_answer': return 'text-muted-foreground'
      default: return 'text-muted-foreground'
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteLog(log.id)
    setDeleting(false)
    if (result.error) {
      toast.error('Không thể xoá log. Vui lòng thử lại.')
    } else {
      toast.success('Đã xoá log.')
      onRefresh()
    }
    setConfirmDelete(false)
  }

  return (
    <>
      <div className="flex gap-3 text-sm group">
        <div className="mt-0.5 shrink-0">
          {isOverdue ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : isPlanned ? (
            <Clock className="h-4 w-4 text-primary" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground text-xs">
              {format(new Date(log.scheduled_for), 'dd/MM/yyyy HH:mm', { locale: vi })}
            </span>
            <span className="text-xs text-muted-foreground">
              {CHANNEL_LABELS[log.channel]}
            </span>
            {log.outcome && (
              <span className={`text-xs font-medium ${outcomeColor(log.outcome)}`}>
                {OUTCOME_LABELS[log.outcome]}
              </span>
            )}
            {isPlanned && (
              <Badge variant="outline" className="text-xs h-4 px-1.5 text-primary border-primary/30">
                Đã lên lịch
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="outline" className="text-xs h-4 px-1.5 text-destructive border-destructive/30">
                Quá hạn
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Xoá log"
              className="ml-auto h-5 w-5 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {log.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 break-words">{log.notes}</p>
          )}
          {isPlanned && (
            <Button
              size="sm"
              variant="outline"
              className="mt-1.5 h-6 text-xs"
              onClick={onMarkDone}
            >
              Đánh dấu hoàn thành
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá log này?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Đang xoá...' : 'Xoá'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
