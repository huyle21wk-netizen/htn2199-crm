'use client'

import { useEffect, useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { toast } from 'sonner'
import { X } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PhoneDisplay } from '@/components/phone-display'
import { createLog, moveContactToSoRac, revertContactStage } from '@/app/actions/logs'
import { phoneForUrl } from '@/lib/phone'
import type { Contact, LogChannel, LogOutcome } from '@/lib/types'

interface QuickLogSheetProps {
  open: boolean
  contact: Contact
  channel: 'call' | 'sms' | 'zalo'
  onClose: (saved: boolean) => void
  onOpenFullLog: (contact: Contact, channel: LogChannel, notes?: string) => void
}

type QuickOutcome = 'no_answer' | 'interested' | 'not_interested' | 'follow_up' | 'bad_number' | 'other'

const FOLLOW_UP_OPTIONS = [
  { label: '1 ngày', days: 1 },
  { label: '2 ngày', days: 2 },
  { label: '3 ngày', days: 3 },
  { label: '1 tuần', days: 7 },
]

function formatFollowUpDate(days: number) {
  return format(addDays(new Date(), days), 'EEEE, dd/MM', { locale: vi })
}

export function QuickLogSheet({ open, contact, channel, onClose, onOpenFullLog }: QuickLogSheetProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<QuickOutcome | null>(null)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [followUpDays, setFollowUpDays] = useState(2)
  const [followUpConfirmed, setFollowUpConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [noAnswerDialog, setNoAnswerDialog] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedOutcome(null)
      setNotes('')
      setReason('')
      setFollowUpDays(2)
      setFollowUpConfirmed(false)
    }
  }, [open])

  useEffect(() => {
    if (open && selectedOutcome === null) {
      const t = setTimeout(() => textareaRef.current?.focus(), 300)
      return () => clearTimeout(t)
    }
  }, [open, selectedOutcome])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const outcomeMap: Record<QuickOutcome, LogOutcome | null> = {
    no_answer: 'no_answer',
    interested: 'interested',
    not_interested: 'not_interested',
    follow_up: 'follow_up',
    bad_number: 'bad_number',
    other: null,
  }

  const handleSave = async () => {
    if (!selectedOutcome || selectedOutcome === 'other') return
    const outcome = outcomeMap[selectedOutcome]!

    setSubmitting(true)
    const combinedNotes = [notes, selectedOutcome === 'not_interested' && reason ? `Lý do: ${reason}` : ''].filter(Boolean).join('\n').trim() || null

    const followUp = selectedOutcome === 'interested' && followUpConfirmed
      ? { scheduled_for: addDays(new Date(), followUpDays).toISOString(), notes: null }
      : null

    const result = await createLog({
      contact_id: contact.id,
      scheduled_for: new Date().toISOString(),
      channel: channel as LogChannel,
      status: 'done',
      outcome,
      notes: combinedNotes,
      followUp,
    })

    setSubmitting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.showNoAnswerDialog) {
      setNoAnswerDialog(true)
      return
    }

    if (result.stageChanged) {
      const { fromName, to, toName } = result.stageChanged
      if (result.showUndoCancel) {
        let undone = false
        const toastId = toast.success(`Đã lưu log · Đã chuyển sang ${toName}`, {
          duration: 10000,
          action: {
            label: 'Hoàn tác',
            onClick: async () => {
              undone = true
              clearTimeout(undoTimerRef.current!)
              await revertContactStage(contact.id, result.stageChanged!.from)
              toast.success(`Đã hoàn tác về ${fromName}.`)
            },
          },
        })
        undoTimerRef.current = setTimeout(() => {
          if (!undone) toast.dismiss(toastId)
        }, 10000)
      } else {
        toast.success(`Đã lưu log · Đã chuyển sang ${toName}`)
      }
    } else {
      toast.success('Đã lưu log.')
    }

    onClose(true)
  }

  const handleOpenFull = () => {
    onOpenFullLog(contact, channel as LogChannel, notes || undefined)
  }

  const outcomeButtons: { key: QuickOutcome; label: string }[] = [
    { key: 'no_answer', label: 'KNM' },
    { key: 'interested', label: 'Quan tâm' },
    { key: 'not_interested', label: 'Không QT' },
    { key: 'follow_up', label: 'Hẹn lại' },
    { key: 'bad_number', label: 'Sai số' },
    { key: 'other', label: 'Khác' },
  ]

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose(false)}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0"
          showCloseButton={false}
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold truncate">{contact.name}</SheetTitle>
                <div className="text-sm text-muted-foreground mt-0.5">
                  <PhoneDisplay phone={contact.phone} />
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => onClose(false)} aria-label="Đóng">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="px-4 py-4 space-y-4">
            {/* Outcome buttons */}
            <div>
              <p className="text-sm font-medium mb-2">Kết quả liên hệ:</p>
              <div className="grid grid-cols-3 gap-2">
                {outcomeButtons.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === 'other') {
                        handleOpenFull()
                        return
                      }
                      setSelectedOutcome(key)
                    }}
                    className={[
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      selectedOutcome === key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expand: Quan tâm */}
            {selectedOutcome === 'interested' && (
              <div className="rounded-lg border border-border p-3 space-y-3 bg-accent/30">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">✅ Quan tâm</p>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    window.open(`https://zalo.me/${phoneForUrl(contact.phone)}`, '_blank')
                  }}
                >
                  Z&nbsp; Mở Zalo ngay
                </Button>

                <div>
                  <p className="text-sm font-medium mb-2">Lên lịch gọi lại:</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {FOLLOW_UP_OPTIONS.map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setFollowUpDays(opt.days)}
                        className={[
                          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                          followUpDays === opt.days
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-accent',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{formatFollowUpDate(followUpDays)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={followUpConfirmed ? 'default' : 'outline'}
                      onClick={() => setFollowUpConfirmed((v) => !v)}
                    >
                      {followUpConfirmed ? '✓ Đã xác nhận' : 'Xác nhận'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Expand: Không QT */}
            {selectedOutcome === 'not_interested' && (
              <div>
                <label className="text-sm text-muted-foreground">Lý do (tuỳ chọn):</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Không có nhu cầu, đã mua chỗ khác..."
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Ghi chú nhanh:</label>
              <Textarea
                ref={textareaRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nội dung cuộc gọi, thông tin quan trọng..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pb-2">
              <Button
                type="button"
                className="flex-1"
                disabled={!selectedOutcome || submitting}
                onClick={handleSave}
              >
                {submitting ? 'Đang lưu...' : 'Lưu log'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleOpenFull}
              >
                Mở form đầy đủ
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={noAnswerDialog}
        onOpenChange={(o) => {
          if (!o) {
            setNoAnswerDialog(false)
            onClose(true)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>3 lần không bắt máy</AlertDialogTitle>
            <AlertDialogDescription>
              Contact này đã 3 lần không bắt máy liên tiếp. Chuyển sang Số rác?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setNoAnswerDialog(false); onClose(true) }}>
              Không
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await moveContactToSoRac(contact.id)
                toast.success('Đã chuyển sang Số rác.')
                setNoAnswerDialog(false)
                onClose(true)
              }}
            >
              Có, chuyển Số rác
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
