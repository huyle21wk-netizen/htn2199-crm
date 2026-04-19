'use client'

import { useState } from 'react'
import { format, isBefore } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Phone,
  MessageCircle,
  MessageSquare,
  Users,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ContactDetailDrawer } from '@/app/(app)/contacts/contact-detail-drawer'
import type { ContactLog, Stage, Project, Contact, LogChannel } from '@/lib/types'
import { OUTCOME_LABELS } from '@/lib/types'

export type CalendarLogEntry = ContactLog & {
  contacts: Contact
}

const CHANNEL_ICONS: Record<LogChannel, React.ElementType> = {
  call: Phone,
  zalo: MessageCircle,
  sms: MessageSquare,
  meeting: Users,
  email: Mail,
}

function getLogStatus(log: ContactLog): 'done' | 'planned' | 'overdue' {
  if (log.status === 'done') return 'done'
  if (isBefore(new Date(log.scheduled_for), new Date())) return 'overdue'
  return 'planned'
}

const OUTCOME_COLORS: Record<string, string> = {
  interested: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  follow_up: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  not_interested: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  no_answer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  bad_number: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  deposited: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  closed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
}

function LogCard({
  log,
  stages,
  projects,
  onMarkDone,
  onRefresh,
}: {
  log: CalendarLogEntry
  stages: Stage[]
  projects: Project[]
  onMarkDone: (log: CalendarLogEntry) => void
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const status = getLogStatus(log)
  const Icon = CHANNEL_ICONS[log.channel] ?? Phone
  const timeStr = format(new Date(log.scheduled_for), 'HH:mm')

  return (
    <>
      <div className={`border border-border rounded-lg p-3 space-y-2 text-sm ${
        status === 'overdue' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/10' : ''
      }`}>
        <div className="flex items-start gap-2">
          {/* Time + icon */}
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <span className="text-xs text-muted-foreground font-mono w-10">{timeStr}</span>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Contact + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowDrawer(true)}
                className="font-medium hover:underline hover:text-[#7C3AED] transition-colors text-left leading-tight"
              >
                {log.contacts.name}
              </button>
              <span className="text-xs text-muted-foreground">{log.contacts.phone}</span>
            </div>

            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {/* Status badge */}
              {status === 'planned' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 dark:text-purple-400">
                  <Clock className="h-3 w-3" /> Dự kiến
                </span>
              )}
              {status === 'done' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <CheckCircle2 className="h-3 w-3" /> Đã xong
                </span>
              )}
              {status === 'overdue' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3" /> Quá hạn
                </span>
              )}

              {/* Outcome badge */}
              {log.outcome && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${OUTCOME_COLORS[log.outcome] ?? ''}`}>
                  {OUTCOME_LABELS[log.outcome]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {log.notes && (
          <div className="pl-12">
            <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
              {log.notes}
            </p>
            {log.notes.length > 80 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground mt-0.5"
              >
                {expanded ? <><ChevronUp className="h-3 w-3" /> Thu gọn</> : <><ChevronDown className="h-3 w-3" /> Xem thêm</>}
              </button>
            )}
          </div>
        )}

        {/* Mark done button */}
        {(status === 'planned' || status === 'overdue') && (
          <div className="pl-12">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onMarkDone(log)}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Đánh dấu hoàn thành
            </Button>
          </div>
        )}
      </div>

      {showDrawer && (
        <ContactDetailDrawer
          contact={log.contacts}
          stages={stages}
          projects={projects}
          onClose={() => setShowDrawer(false)}
          onEdit={() => setShowDrawer(false)}
          onDelete={() => setShowDrawer(false)}
          onNewLog={() => setShowDrawer(false)}
          onZalo={() => {}}
          onRefresh={onRefresh}
        />
      )}
    </>
  )
}

interface DayPanelProps {
  selectedDay: Date | undefined
  logs: CalendarLogEntry[]
  overdueMode: boolean
  stages: Stage[]
  projects: Project[]
  onMarkDone: (log: CalendarLogEntry) => void
  onCreateLog: () => void
  onRefresh: () => void
}

export function DayPanel({
  selectedDay,
  logs,
  overdueMode,
  stages,
  projects,
  onMarkDone,
  onCreateLog,
  onRefresh,
}: DayPanelProps) {
  const title = overdueMode
    ? 'Tất cả quá hạn'
    : selectedDay
    ? format(selectedDay, "EEEE, d 'tháng' M, yyyy", { locale: vi })
    : 'Chọn một ngày'

  const titleCapitalized = title.charAt(0).toUpperCase() + title.slice(1)

  return (
    <div className="border border-border rounded-lg flex flex-col h-full min-h-[400px] md:min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold leading-tight">{titleCapitalized}</h2>
        {selectedDay && !overdueMode && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onCreateLog}>
            <Plus className="h-3 w-3" />
            Tạo log
          </Button>
        )}
      </div>

      {/* Log list */}
      <ScrollArea className="flex-1 p-3">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              {overdueMode
                ? 'Không có follow-up quá hạn.'
                : 'Chưa có log nào trong ngày này.'}
            </p>
            {!overdueMode && selectedDay && (
              <Button size="sm" variant="outline" onClick={onCreateLog} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Tạo log
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <LogCard
                key={log.id}
                log={log}
                stages={stages}
                projects={projects}
                onMarkDone={onMarkDone}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
