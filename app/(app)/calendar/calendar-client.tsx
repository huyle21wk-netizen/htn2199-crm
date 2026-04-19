'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, startOfMonth, endOfMonth, isBefore, isSameDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { createClient } from '@/lib/supabase/client'
import { DayPanel, type CalendarLogEntry } from './day-panel'
import { MarkDoneModal } from './mark-done-modal'
import { SelectContactModal } from './select-contact-modal'
import type { Stage, Project } from '@/lib/types'

type DayCounts = { planned: number; done: number; overdue: number }

interface CalendarClientProps {
  stages: Stage[]
  projects: Project[]
}

export function CalendarClient({ stages, projects }: CalendarClientProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const [logs, setLogs] = useState<CalendarLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [overdueFilter, setOverdueFilter] = useState(false)
  const [markDoneLog, setMarkDoneLog] = useState<CalendarLogEntry | null>(null)
  const [showSelectContact, setShowSelectContact] = useState(false)

  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const { data } = await supabase
      .from('contact_logs')
      .select('*, contacts(*)')
      .gte('scheduled_for', start.toISOString())
      .lte('scheduled_for', end.toISOString())
      .order('scheduled_for', { ascending: true })
    setLogs((data as CalendarLogEntry[]) ?? [])
    setLogsLoading(false)
  }, [currentMonth])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const dayLogCounts = useMemo(() => {
    const map = new Map<string, DayCounts>()
    const now = new Date()
    for (const log of logs) {
      const key = format(new Date(log.scheduled_for), 'yyyy-MM-dd')
      const c = map.get(key) ?? { planned: 0, done: 0, overdue: 0 }
      if (log.status === 'done') c.done++
      else if (isBefore(new Date(log.scheduled_for), now)) c.overdue++
      else c.planned++
      map.set(key, c)
    }
    return map
  }, [logs])

  const totalOverdue = useMemo(
    () => logs.filter((l) => l.status === 'planned' && isBefore(new Date(l.scheduled_for), new Date())).length,
    [logs]
  )

  const displayedLogs = useMemo(() => {
    if (overdueFilter) {
      return logs.filter((l) => l.status === 'planned' && isBefore(new Date(l.scheduled_for), new Date()))
    }
    return logs.filter((l) => selectedDay && isSameDay(new Date(l.scheduled_for), selectedDay))
  }, [logs, selectedDay, overdueFilter])

  // Stable ref so CustomDayButton is never recreated (avoids DayButton remount flicker)
  const dayLogCountsRef = useRef<Map<string, DayCounts>>(new Map())
  dayLogCountsRef.current = dayLogCounts

  const CustomDayButton = useCallback(
    (props: React.ComponentProps<typeof CalendarDayButton>) => {
      const { day, modifiers, children, className, ...rest } = props
      const dateKey = format(day.date, 'yyyy-MM-dd')
      const counts = dayLogCountsRef.current.get(dateKey) ?? { planned: 0, done: 0, overdue: 0 }
      const total = counts.planned + counts.done + counts.overdue

      // Max 3 visible dots, priority: overdue (red) > planned (purple) > done (gray)
      const dots: string[] = []
      for (let i = 0; i < counts.overdue && dots.length < 3; i++) dots.push('#EF4444')
      for (let i = 0; i < counts.planned && dots.length < 3; i++) dots.push('#7C3AED')
      for (let i = 0; i < counts.done && dots.length < 3; i++) dots.push('#6B7280')
      const extra = total > 3 ? total - 3 : 0

      const overdueBg =
        counts.overdue > 0 && !modifiers.selected
          ? 'bg-red-50 dark:bg-red-950/20'
          : ''

      return (
        <CalendarDayButton
          day={day}
          modifiers={modifiers}
          locale={vi}
          className={cn(className, overdueBg)}
          {...rest}
        >
          {children}
          {total > 0 && (
            <span className="flex items-center gap-0.5 justify-center">
              {dots.map((color, i) => (
                <span
                  key={i}
                  className="rounded-full shrink-0"
                  style={{ width: 4, height: 4, backgroundColor: color }}
                />
              ))}
              {extra > 0 && (
                <span className="text-[8px] leading-none text-muted-foreground">+{extra}</span>
              )}
            </span>
          )}
        </CalendarDayButton>
      )
    },
    [] // stable reference — reads dayLogCounts from ref
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Lịch</h1>

      {/* Overdue banner */}
      {totalOverdue > 0 && (
        <button
          onClick={() => setOverdueFilter((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <span>⚠️ {totalOverdue} follow-up quá hạn</span>
          {overdueFilter && (
            <span className="ml-auto text-xs opacity-70">Đang lọc · Nhấn để bỏ lọc</span>
          )}
        </button>
      )}

      {/* Split layout: calendar left (60%), day panel right (40%) */}
      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Calendar */}
        <div className="w-full md:w-3/5">
          <div className="border border-border rounded-lg p-2 overflow-hidden">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={(day) => {
                if (day) {
                  setSelectedDay(day)
                  setOverdueFilter(false)
                }
              }}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={vi}
              classNames={{
                today: 'ring-2 ring-[#7C3AED] rounded-md',
              }}
              components={{ DayButton: CustomDayButton }}
              className="w-full"
            />
          </div>
        </div>

        {/* Day panel */}
        <div className="w-full md:w-2/5">
          <DayPanel
            selectedDay={selectedDay}
            logs={displayedLogs}
            loading={logsLoading}
            overdueMode={overdueFilter}
            stages={stages}
            projects={projects}
            onMarkDone={(log) => setMarkDoneLog(log)}
            onCreateLog={() => setShowSelectContact(true)}
            onRefresh={fetchLogs}
          />
        </div>
      </div>

      {markDoneLog && (
        <MarkDoneModal
          log={markDoneLog}
          stages={stages}
          onClose={() => {
            setMarkDoneLog(null)
            fetchLogs()
          }}
        />
      )}

      {showSelectContact && (
        <SelectContactModal
          selectedDay={selectedDay}
          stages={stages}
          onClose={() => setShowSelectContact(false)}
          onDone={() => {
            setShowSelectContact(false)
            fetchLogs()
          }}
        />
      )}
    </div>
  )
}
