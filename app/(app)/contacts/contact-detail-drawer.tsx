'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  X,
  Pencil,
  Trash2,
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
import { createClient } from '@/lib/supabase/client'
import { phoneForUrl } from '@/lib/phone'
import type { Contact, ContactLog, Stage, Project } from '@/lib/types'
import { CHANNEL_LABELS, OUTCOME_LABELS } from '@/lib/types'

interface ContactDetailDrawerProps {
  contact: Contact
  stages: Stage[]
  projects: Project[]
  onClose: () => void
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
  onNewLog: (contact: Contact) => void
  onZalo: (contact: Contact) => void
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
  onRefresh,
}: ContactDetailDrawerProps) {
  const supabase = createClient()
  const [logs, setLogs] = useState<ContactLog[]>([])
  const [loading, setLoading] = useState(true)

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
              <p className="text-sm text-muted-foreground font-mono mt-0.5">
                {contact.phone}
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
                onClick={() => onZalo(contact)}
                title="Zalo"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(contact)}
                title="Sửa"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(contact)}
                className="hover:text-destructive"
                title="Xoá"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
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
                <p className="text-sm text-muted-foreground">Đang tải...</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có lịch sử liên hệ.</p>
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
}: {
  log: ContactLog
  onMarkDone: () => void
  onRefresh: () => void
}) {
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

  return (
    <div className="flex gap-3 text-sm">
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
  )
}
