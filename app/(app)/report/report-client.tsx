'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Stage, Project, CHANNEL_LABELS, OUTCOME_LABELS } from '@/lib/types'
import type { LogChannel, LogOutcome } from '@/lib/types'
import {
  format, startOfDay, endOfDay, subDays,
  startOfMonth, endOfMonth, subMonths,
  eachDayOfInterval, startOfWeek, endOfWeek,
  differenceInDays, addDays, isAfter,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import Papa from 'papaparse'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Calendar } from '@/components/ui/calendar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  CalendarIcon, Download, Phone, Users, TrendingUp, Trophy, BarChart3,
} from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Preset = 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom'

interface Overview {
  totalLogs: number
  newContacts: number
  positiveLogs: number
  successContacts: number
}

interface ChartEntry { name: string; value: number }
interface OutcomeEntry extends ChartEntry { color: string }
interface BarEntry { label: string; count: number }

interface ProjectRow {
  projectId: string | null
  projectName: string
  rawCount: number
  inCrmCount: number
  successCount: number
  rate: number
}

interface FunnelRow {
  stageId: string
  stageName: string
  count: number
  color: string | null
  isTerminal: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'this_month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
  { key: 'custom', label: 'Tuỳ chọn' },
]

const PURPLE_SHADES = ['#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE']

const OUTCOME_COLORS: Record<string, string> = {
  interested: '#16a34a',
  follow_up: '#7C3AED',
  deposited: '#2563eb',
  closed: '#166534',
  no_answer: '#9ca3af',
  not_interested: '#ea580c',
  bad_number: '#dc2626',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRange(preset: Preset, customRange?: DateRange): { from: Date; to: Date } {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case '7d':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }
    case '30d':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) }
    case 'last_month': {
      const lm = subMonths(now, 1)
      return { from: startOfMonth(lm), to: endOfDay(endOfMonth(lm)) }
    }
    case 'custom':
      return {
        from: customRange?.from ? startOfDay(customRange.from) : startOfDay(subDays(now, 29)),
        to: customRange?.to ? endOfDay(customRange.to) : endOfDay(now),
      }
  }
}

function buildBarData(
  logs: { created_at: string }[],
  from: Date,
  to: Date,
): BarEntry[] {
  const totalDays = differenceInDays(to, from) + 1
  const groupByWeek = totalDays > 30

  if (groupByWeek) {
    const weeks: { label: string; start: number; count: number }[] = []
    let cur = startOfWeek(from, { weekStartsOn: 1 })
    while (!isAfter(cur, to)) {
      weeks.push({ label: format(cur, 'dd/MM'), start: cur.getTime(), count: 0 })
      cur = addDays(endOfWeek(cur, { weekStartsOn: 1 }), 1)
    }
    for (const log of logs) {
      const ws = startOfWeek(new Date(log.created_at), { weekStartsOn: 1 }).getTime()
      const w = weeks.find((x) => x.start === ws)
      if (w) w.count++
    }
    return weeks.map(({ label, count }) => ({ label, count }))
  }

  const dayMap = new Map<string, number>()
  for (const d of eachDayOfInterval({ start: from, end: to })) {
    dayMap.set(format(d, 'yyyy-MM-dd'), 0)
  }
  for (const log of logs) {
    const key = format(new Date(log.created_at), 'yyyy-MM-dd')
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
  }
  return Array.from(dayMap.entries()).map(([key, count]) => ({
    label: format(new Date(key), 'dd/MM'),
    count,
  }))
}

function downloadCsv(rows: Record<string, string>[], filename: string) {
  const csv = Papa.unparse(rows)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <div className="p-3 rounded-full bg-secondary">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-foreground">Chưa có dữ liệu</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Thay đổi khoảng thời gian để xem dữ liệu khác</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  stages: Stage[]
  projects: Project[]
}

export function ReportClient({ stages, projects }: Props) {
  const supabase = createClient()

  // Time filter state
  const [preset, setPreset] = useState<Preset>('30d')
  const [customRange, setCustomRange] = useState<DateRange | undefined>()
  const [calendarOpen, setCalendarOpen] = useState(false)

  const { from, to } = getRange(preset, customRange)

  // Data state
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<Overview>({ totalLogs: 0, newContacts: 0, positiveLogs: 0, successContacts: 0 })
  const [channelData, setChannelData] = useState<ChartEntry[]>([])
  const [outcomeData, setOutcomeData] = useState<OutcomeEntry[]>([])
  const [barData, setBarData] = useState<BarEntry[]>([])
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([])
  const [funnelRows, setFunnelRows] = useState<FunnelRow[]>([])

  // Export state
  const [exportOpen, setExportOpen] = useState(false)
  const [exportContactsInRange, setExportContactsInRange] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const fromIso = from.toISOString()
    const toIso = to.toISOString()

    try {
      // Fetch all done logs in range (for overview + breakdown)
      const [
        { count: totalLogs },
        { count: newContacts },
        { count: positiveLogs },
        { data: closedLogContacts },
        { data: allDoneLogs },
        { data: allContacts },
        { data: funnelContacts },
      ] = await Promise.all([
        supabase.from('contact_logs').select('*', { count: 'exact', head: true })
          .eq('status', 'done').gte('created_at', fromIso).lte('created_at', toIso),
        supabase.from('contacts').select('*', { count: 'exact', head: true })
          .gte('created_at', fromIso).lte('created_at', toIso),
        supabase.from('contact_logs').select('*', { count: 'exact', head: true })
          .eq('status', 'done')
          .in('outcome', ['interested', 'follow_up', 'deposited', 'closed'])
          .gte('created_at', fromIso).lte('created_at', toIso),
        // closed logs with contact's project_id (for project table)
        supabase.from('contact_logs')
          .select('contact_id, contacts(project_id)')
          .eq('status', 'done').eq('outcome', 'closed')
          .gte('created_at', fromIso).lte('created_at', toIso),
        // all done logs for breakdown charts
        supabase.from('contact_logs')
          .select('channel, outcome, created_at')
          .eq('status', 'done').gte('created_at', fromIso).lte('created_at', toIso),
        // all contacts with stage info for project table
        supabase.from('contacts')
          .select('id, project_id, stage:stages(is_raw, is_bad_number, is_terminal)'),
        // all contacts with stage info for funnel (not time-filtered)
        supabase.from('contacts')
          .select('stage_id, stage:stages(name, position, is_raw, is_bad_number, is_terminal, color)'),
      ])

      // Overview
      const uniqueClosedContacts = new Set(
        (closedLogContacts ?? []).map((l: any) => l.contact_id)
      ).size
      setOverview({
        totalLogs: totalLogs ?? 0,
        newContacts: newContacts ?? 0,
        positiveLogs: positiveLogs ?? 0,
        successContacts: uniqueClosedContacts,
      })

      // Breakdown: channel pie
      const channelMap = new Map<string, number>()
      for (const log of allDoneLogs ?? []) {
        const ch = log.channel as LogChannel
        channelMap.set(ch, (channelMap.get(ch) ?? 0) + 1)
      }
      setChannelData(
        Array.from(channelMap.entries()).map(([ch, value]) => ({
          name: CHANNEL_LABELS[ch as LogChannel] ?? ch,
          value,
        }))
      )

      // Breakdown: outcome pie
      const outcomeMap = new Map<string, number>()
      for (const log of allDoneLogs ?? []) {
        if (log.outcome) {
          outcomeMap.set(log.outcome, (outcomeMap.get(log.outcome) ?? 0) + 1)
        }
      }
      setOutcomeData(
        Array.from(outcomeMap.entries()).map(([oc, value]) => ({
          name: OUTCOME_LABELS[oc as LogOutcome] ?? oc,
          value,
          color: OUTCOME_COLORS[oc] ?? '#9ca3af',
        }))
      )

      // Breakdown: bar chart by day/week
      setBarData(buildBarData(allDoneLogs ?? [], from, to))

      // Project table
      const closedByProject = new Map<string | null, Set<string>>()
      for (const log of closedLogContacts ?? []) {
        const projId = (log.contacts as any)?.project_id ?? null
        const key = projId ?? '__null__'
        if (!closedByProject.has(key)) closedByProject.set(key, new Set())
        closedByProject.get(key)!.add(log.contact_id)
      }

      const projectMap = new Map<string | null, { raw: number; inCrm: number }>()
      for (const c of allContacts ?? []) {
        const stage = c.stage as any
        const key = c.project_id ?? null
        if (!projectMap.has(key)) projectMap.set(key, { raw: 0, inCrm: 0 })
        const entry = projectMap.get(key)!
        if (stage?.is_raw) entry.raw++
        else if (!stage?.is_bad_number && !stage?.is_terminal) entry.inCrm++
      }

      const allProjectIds = new Set([...projectMap.keys(), ...closedByProject.keys()])
      const rows: ProjectRow[] = []
      const projectById = new Map(projects.map((p) => [p.id, p.name]))

      for (const projId of allProjectIds) {
        if (projId === '__null__') continue
        const counts = projectMap.get(projId) ?? { raw: 0, inCrm: 0 }
        const successSet = closedByProject.get(projId) ?? new Set()
        const total = counts.raw + counts.inCrm + successSet.size
        rows.push({
          projectId: projId,
          projectName: projectById.get(projId ?? '') ?? 'Không rõ',
          rawCount: counts.raw,
          inCrmCount: counts.inCrm,
          successCount: successSet.size,
          rate: total > 0 ? Math.round((successSet.size / total) * 1000) / 10 : 0,
        })
      }

      // "Không có dự án" row at end
      const nullCounts = projectMap.get(null) ?? { raw: 0, inCrm: 0 }
      const nullSuccess = closedByProject.get('__null__') ?? new Set()
      const nullTotal = nullCounts.raw + nullCounts.inCrm + nullSuccess.size
      rows.push({
        projectId: null,
        projectName: 'Không có dự án',
        rawCount: nullCounts.raw,
        inCrmCount: nullCounts.inCrm,
        successCount: nullSuccess.size,
        rate: nullTotal > 0 ? Math.round((nullSuccess.size / nullTotal) * 1000) / 10 : 0,
      })

      rows.sort((a, b) => a.projectId === null ? 1 : b.projectId === null ? -1 : 0)
      setProjectRows(rows)

      // Funnel snapshot
      const stageCountMap = new Map<string, number>()
      const stageInfoMap = new Map<string, any>()
      for (const c of funnelContacts ?? []) {
        const stage = c.stage as any
        if (!stage || stage.is_raw || stage.is_bad_number) continue
        stageCountMap.set(c.stage_id, (stageCountMap.get(c.stage_id) ?? 0) + 1)
        if (!stageInfoMap.has(c.stage_id)) stageInfoMap.set(c.stage_id, stage)
      }

      // Include stages with 0 contacts too
      for (const s of stages) {
        if (s.is_raw || s.is_bad_number) continue
        if (!stageCountMap.has(s.id)) stageCountMap.set(s.id, 0)
        if (!stageInfoMap.has(s.id)) stageInfoMap.set(s.id, s)
      }

      const funnel: FunnelRow[] = Array.from(stageCountMap.entries()).map(([id, count]) => {
        const info = stageInfoMap.get(id)
        return {
          stageId: id,
          stageName: info?.name ?? id,
          count,
          color: info?.color ?? null,
          isTerminal: info?.is_terminal ?? false,
        }
      })

      funnel.sort((a, b) => {
        const posA = stageInfoMap.get(a.stageId)?.position ?? 999
        const posB = stageInfoMap.get(b.stageId)?.position ?? 999
        return posA - posB
      })
      setFunnelRows(funnel)
    } finally {
      setLoading(false)
    }
  }, [from.toISOString(), to.toISOString()])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Export handlers
  const handleExportContacts = useCallback(async () => {
    setExporting(true)
    try {
      let query = supabase.from('contacts')
        .select('name, phone, project:projects(name), source, stage:stages(name), note, created_at')
        .order('created_at', { ascending: false })

      if (exportContactsInRange) {
        query = query.gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
      }

      const { data } = await query
      const rows = (data ?? []).map((c: any) => ({
        'Tên': c.name,
        'SĐT': c.phone,
        'Dự án': c.project?.name ?? '',
        'Nguồn': c.source ?? '',
        'Stage': c.stage?.name ?? '',
        'Ghi chú': c.note ?? '',
        'Ngày tạo': format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'),
      }))
      downloadCsv(rows, `contacts_${format(new Date(), 'yyyy-MM-dd')}.csv`)
      setExportOpen(false)
    } finally {
      setExporting(false)
    }
  }, [exportContactsInRange, from, to])

  const handleExportLogs = useCallback(async () => {
    setExporting(true)
    try {
      const { data } = await supabase.from('contact_logs')
        .select('*, contact:contacts(name, phone)')
        .eq('status', 'done')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })

      const rows = (data ?? []).map((l: any) => ({
        'Tên khách': l.contact?.name ?? '',
        'SĐT': l.contact?.phone ?? '',
        'Kênh': CHANNEL_LABELS[l.channel as LogChannel] ?? l.channel,
        'Kết quả': l.outcome ? (OUTCOME_LABELS[l.outcome as LogOutcome] ?? l.outcome) : '',
        'Thời gian': format(new Date(l.scheduled_for), 'dd/MM/yyyy HH:mm'),
        'Ghi chú': l.notes ?? '',
      }))
      downloadCsv(rows, `logs_${format(new Date(), 'yyyy-MM-dd')}.csv`)
      setExportOpen(false)
    } finally {
      setExporting(false)
    }
  }, [from, to])

  // ─── Render ────────────────────────────────────────────────────────────────

  const totalDays = differenceInDays(to, from) + 1
  const dateLabel = preset === 'custom' && customRange?.from
    ? `${format(from, 'dd/MM/yyyy')} – ${format(to, 'dd/MM/yyyy')}`
    : PRESETS.find((p) => p.key === preset)?.label ?? ''

  const projectTotal: ProjectRow = projectRows.reduce(
    (acc, r) => ({
      projectId: null,
      projectName: 'Tổng',
      rawCount: acc.rawCount + r.rawCount,
      inCrmCount: acc.inCrmCount + r.inCrmCount,
      successCount: acc.successCount + r.successCount,
      rate: 0,
    }),
    { projectId: null, projectName: 'Tổng', rawCount: 0, inCrmCount: 0, successCount: 0, rate: 0 }
  )
  const totalDenom = projectTotal.rawCount + projectTotal.inCrmCount + projectTotal.successCount
  projectTotal.rate = totalDenom > 0
    ? Math.round((projectTotal.successCount / totalDenom) * 1000) / 10
    : 0

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* ── Header + Time filter ── */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Báo cáo</h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Preset buttons */}
            <div className="flex flex-wrap gap-1">
              {PRESETS.map(({ key, label }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={preset === key ? 'default' : 'outline'}
                  className={cn(
                    'h-8 px-3 text-sm',
                    preset === key && 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-transparent'
                  )}
                  onClick={() => {
                    setPreset(key)
                    if (key === 'custom') setCalendarOpen(true)
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Custom date range picker */}
            {preset === 'custom' && (
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-2 text-sm')}>
                  <CalendarIcon className="size-4" />
                  {customRange?.from
                    ? customRange.to
                      ? `${format(customRange.from, 'dd/MM/yyyy')} – ${format(customRange.to, 'dd/MM/yyyy')}`
                      : format(customRange.from, 'dd/MM/yyyy')
                    : 'Chọn ngày'}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={setCustomRange}
                    locale={vi}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Export CSV */}
            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-2 text-sm')}>
                <Download className="size-4" />
                Xuất CSV
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Xuất danh sách khách hàng</p>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="in-range"
                        checked={exportContactsInRange}
                        onCheckedChange={(v) => setExportContactsInRange(!!v)}
                      />
                      <Label htmlFor="in-range" className="text-xs cursor-pointer">
                        Chỉ trong khoảng thời gian
                      </Label>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={handleExportContacts}
                      disabled={exporting}
                    >
                      Tải xuống (.csv)
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Xuất lịch sử liên hệ</p>
                    <p className="text-xs text-muted-foreground">Trong khoảng: {dateLabel}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={handleExportLogs}
                      disabled={exporting}
                    >
                      Tải xuống (.csv)
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* ── Block 1: Overview ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Tổng liên hệ đã thực hiện"
          value={overview.totalLogs}
          icon={<Phone className="size-5 text-[#A78BFA]" />}
          loading={loading}
        />
        <MetricCard
          label="Khách hàng mới"
          value={overview.newContacts}
          icon={<Users className="size-5 text-[#A78BFA]" />}
          loading={loading}
        />
        <MetricCard
          label="Phản hồi tích cực"
          value={overview.positiveLogs}
          icon={<TrendingUp className="size-5 text-[#A78BFA]" />}
          loading={loading}
        />
        <MetricCard
          label="Khách thành công"
          value={overview.successContacts}
          icon={<Trophy className="size-5 text-[#A78BFA]" />}
          loading={loading}
        />
      </div>

      {/* ── Block 2: Breakdown charts ── */}
      <div className="rounded-lg border p-5">
        <h2 className="mb-4 text-base font-semibold">Phân tích chi tiết</h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[250px] animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Pie: by channel */}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Theo kênh liên hệ</p>
              {channelData.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                    >
                      {channelData.map((_, i) => (
                        <Cell key={i} fill={PURPLE_SHADES[i % PURPLE_SHADES.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'Số lần']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pie: by outcome */}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Theo kết quả</p>
              {outcomeData.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                    >
                      {outcomeData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'Số lần']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar: by day/week */}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Theo {totalDays > 30 ? 'tuần' : 'ngày'}
              </p>
              {barData.every((d) => d.count === 0) ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [v, 'Liên hệ']} />
                    <Bar dataKey="count" name="Liên hệ" fill="#7C3AED" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Block 3: Projects table ── */}
      <div className="rounded-lg border p-5">
        <h2 className="mb-4 text-base font-semibold">Khách theo dự án</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : projectRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Dự án</th>
                  <th className="pb-2 text-right font-medium">Raw</th>
                  <th className="pb-2 text-right font-medium">Trong CRM</th>
                  <th className="pb-2 text-right font-medium">Thành công</th>
                  <th className="pb-2 text-right font-medium">Tỉ lệ</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr key={row.projectId ?? '__null__'} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {row.projectId === null
                        ? <span className="text-muted-foreground italic">{row.projectName}</span>
                        : row.projectName}
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.rawCount}</td>
                    <td className="py-2 text-right tabular-nums">{row.inCrmCount}</td>
                    <td className="py-2 text-right tabular-nums">{row.successCount}</td>
                    <td className="py-2 text-right tabular-nums">
                      {row.rate > 0 ? `${row.rate}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="pt-2">Tổng</td>
                  <td className="pt-2 text-right tabular-nums">{projectTotal.rawCount}</td>
                  <td className="pt-2 text-right tabular-nums">{projectTotal.inCrmCount}</td>
                  <td className="pt-2 text-right tabular-nums">{projectTotal.successCount}</td>
                  <td className="pt-2 text-right tabular-nums">
                    {projectTotal.rate > 0 ? `${projectTotal.rate}%` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Block 4: Funnel snapshot ── */}
      <div className="rounded-lg border p-5">
        <h2 className="mb-1 text-base font-semibold">Kanban funnel (hiện tại)</h2>
        <p className="mb-4 text-xs text-muted-foreground">Trạng thái hiện tại, không theo bộ lọc thời gian</p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : funnelRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Giai đoạn</th>
                  <th className="pb-2 text-right font-medium">Số khách</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const nonTerminal = funnelRows.filter((r) => !r.isTerminal)
                  const terminal = funnelRows.filter((r) => r.isTerminal)
                  return (
                    <>
                      {nonTerminal.map((row) => (
                        <FunnelRowItem key={row.stageId} row={row} />
                      ))}
                      {terminal.length > 0 && nonTerminal.length > 0 && (
                        <tr>
                          <td colSpan={2} className="py-1">
                            <div className="border-t" />
                          </td>
                        </tr>
                      )}
                      {terminal.map((row) => (
                        <FunnelRowItem key={row.stageId} row={row} />
                      ))}
                    </>
                  )
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon, loading,
}: {
  label: string
  value: number
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          {loading ? (
            <div className="h-10 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <span className="text-4xl font-bold text-[#7C3AED]">{value.toLocaleString('vi-VN')}</span>
          )}
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <div className="mt-1">{icon}</div>
      </div>
    </div>
  )
}

function FunnelRowItem({ row }: { row: FunnelRow }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: row.color ?? '#9ca3af' }}
          />
          {row.stageName}
        </div>
      </td>
      <td className="py-2 text-right tabular-nums font-medium">{row.count}</td>
    </tr>
  )
}
