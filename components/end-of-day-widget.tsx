'use client'

import { useEffect, useState } from 'react'
import { format, startOfDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { X, ClipboardCopy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface DaySummary {
  total: number
  interested: number
  notInterested: number
  noAnswer: number
  interestedContacts: { name: string; phone: string; note: string | null }[]
}

function getDismissKey() {
  return `eod-dismissed-${format(new Date(), 'yyyy-MM-dd')}`
}

function shouldShow() {
  if (typeof window === 'undefined') return false
  if (new Date().getHours() < 18) return false
  if (sessionStorage.getItem(getDismissKey())) return false
  return true
}

export function EndOfDayWidget() {
  const router = useRouter()
  const supabase = createClient()
  const [visible, setVisible] = useState(false)
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!shouldShow()) return
    setVisible(true)
    fetchSummary()
  }, [])

  const fetchSummary = async () => {
    setLoading(true)
    const todayStart = startOfDay(new Date()).toISOString()
    const now = new Date().toISOString()

    const { data } = await supabase
      .from('contact_logs')
      .select('outcome, notes, contacts(id, name, phone)')
      .eq('status', 'done')
      .gte('scheduled_for', todayStart)
      .lte('scheduled_for', now)

    if (!data) { setLoading(false); return }

    const total = data.length
    const interested = data.filter((l) => l.outcome === 'interested' || l.outcome === 'follow_up').length
    const notInterested = data.filter((l) => l.outcome === 'not_interested').length
    const noAnswer = data.filter((l) => l.outcome === 'no_answer').length

    // Distinct contacts with interested outcome, keep latest log note
    const seenIds = new Set<string>()
    const interestedContacts: DaySummary['interestedContacts'] = []
    for (const log of data) {
      if (log.outcome !== 'interested') continue
      const contact = log.contacts as unknown as { id: string; name: string; phone: string }
      if (!contact || seenIds.has(contact.id)) continue
      seenIds.add(contact.id)
      interestedContacts.push({ name: contact.name, phone: contact.phone, note: log.notes })
    }

    setSummary({ total, interested, notInterested, noAnswer, interestedContacts })
    setLoading(false)
  }

  const handleDismiss = () => {
    sessionStorage.setItem(getDismissKey(), '1')
    setVisible(false)
  }

  const handleCopyReport = async (s: DaySummary) => {
    const dateStr = format(new Date(), 'dd/MM/yyyy')
    const lines: string[] = [
      `Báo cáo ngày ${dateStr}:`,
      `- Tổng liên hệ: ${s.total}`,
      `- Quan tâm: ${s.interested}`,
      `- Không quan tâm: ${s.notInterested}`,
      `- Không nghe máy: ${s.noAnswer}`,
    ]

    if (s.interestedContacts.length > 0) {
      lines.push('')
      lines.push('Khách quan tâm:')
      s.interestedContacts.forEach((c, i) => {
        if (c.note) {
          lines.push(`${i + 1}. ${c.name} - ${c.phone} - ${c.note}`)
        } else {
          lines.push(`${i + 1}. ${c.name} - ${c.phone}`)
        }
      })
    }

    await navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Đã copy báo cáo · Paste vào Zalo là xong 👍')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!visible) return null

  const todayLabel = format(new Date(), 'EEEE, dd/MM', { locale: vi })

  return (
    <div className="md:hidden mb-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">📊 Tổng kết hôm nay</p>
          <p className="text-xs text-muted-foreground">{todayLabel}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={handleDismiss} aria-label="Đóng">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Đang tải...</p>
      ) : summary ? (
        <>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">📞 Tổng liên hệ</span>
              <span className="font-semibold">{summary.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">✅ Quan tâm</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{summary.interested}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">❌ Không quan tâm</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">{summary.notInterested}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">📵 Không nghe máy</span>
              <span className="font-semibold">{summary.noAnswer}</span>
            </div>
          </div>

          {summary.interestedContacts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Khách quan tâm hôm nay:</p>
              {summary.interestedContacts.slice(0, 5).map((c) => (
                <div key={c.phone} className="text-xs flex items-start gap-1">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {' · '}
                    <span className="font-mono text-muted-foreground">{c.phone}</span>
                    {c.note && (
                      <span className="text-muted-foreground">
                        {' · '}
                        {c.note.length > 30 ? c.note.slice(0, 30) + '…' : c.note}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={() => handleCopyReport(summary!)}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              Copy báo cáo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => router.push('/report')}
            >
              Xem báo cáo đầy đủ →
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
