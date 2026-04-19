'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDays, format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { createLog, moveContactToSoRac, revertContactStage } from '@/app/actions/logs'
import type { Contact, Stage, LogChannel, LogOutcome } from '@/lib/types'
import { CHANNEL_LABELS, OUTCOME_LABELS } from '@/lib/types'

const schema = z.object({
  scheduled_for: z.string().min(1, 'Vui lòng chọn thời gian.'),
  channel: z.enum(['call', 'zalo', 'sms', 'meeting', 'email']),
  status: z.enum(['done', 'planned']),
  outcome: z.string().optional(),
  notes: z.string().optional(),
  hasFollowUp: z.boolean(),
  followUp_date: z.string().optional(),
  followUp_notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function toDatetimeLocal(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

interface ContactLogModalProps {
  contact: Contact
  stages: Stage[]
  defaultChannel?: LogChannel
  defaultScheduledFor?: string
  defaultNotes?: string
  onClose: (saved: boolean) => void
}

export function ContactLogModal({
  contact,
  defaultChannel,
  defaultScheduledFor,
  defaultNotes,
  onClose,
}: ContactLogModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [noAnswerDialog, setNoAnswerDialog] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      scheduled_for: defaultScheduledFor ?? toDatetimeLocal(new Date()),
      channel: defaultChannel ?? 'call',
      status: 'done',
      outcome: '',
      notes: defaultNotes ?? '',
      hasFollowUp: false,
      followUp_date: toDatetimeLocal(addDays(new Date(), 3)),
      followUp_notes: '',
    },
  })

  const status = watch('status')
  const hasFollowUp = watch('hasFollowUp')
  const outcome = watch('outcome')

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const onSubmit = async (data: FormData) => {
    if (data.status === 'done' && !data.outcome) {
      toast.error('Vui lòng chọn kết quả.')
      return
    }
    setSubmitting(true)

    const result = await createLog({
      contact_id: contact.id,
      scheduled_for: new Date(data.scheduled_for).toISOString(),
      channel: data.channel as LogChannel,
      status: data.status,
      outcome: data.status === 'done' ? (data.outcome as LogOutcome) : null,
      notes: data.notes || null,
      followUp:
        data.hasFollowUp && data.followUp_date
          ? {
              scheduled_for: new Date(data.followUp_date).toISOString(),
              notes: data.followUp_notes || null,
            }
          : null,
    })

    setSubmitting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    // Handle automation results
    if (result.showNoAnswerDialog) {
      setNoAnswerDialog(true)
      return
    }

    if (result.stageChanged) {
      const { fromName, to, toName } = result.stageChanged
      const isUndoable = result.showUndoCancel

      // Show toast with optional undo
      const toastMsg = `Đã tạo log · Đã chuyển sang ${toName}`

      if (isUndoable) {
        let undone = false
        const toastId = toast.success(toastMsg, {
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
        // Auto-dismiss undo after 10s
        undoTimerRef.current = setTimeout(() => {
          if (!undone) toast.dismiss(toastId)
        }, 10000)
      } else {
        toast.success(toastMsg)
      }
    } else {
      toast.success('Đã tạo log.')
    }

    onClose(true)
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose(false)}>
        <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo log — {contact.name}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            {/* Scheduled for */}
            <div className="space-y-1.5">
              <Label htmlFor="scheduled_for">Thời gian</Label>
              <input
                id="scheduled_for"
                type="datetime-local"
                {...register('scheduled_for')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {errors.scheduled_for && (
                <p className="text-xs text-destructive">{errors.scheduled_for.message}</p>
              )}
            </div>

            {/* Channel */}
            <div className="space-y-1.5">
              <Label>Kênh liên hệ</Label>
              <Controller
                name="channel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={CHANNEL_LABELS}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(CHANNEL_LABELS) as [LogChannel, string][]).map(
                        ([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <div className="flex gap-4">
                {(['done', 'planned'] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      value={s}
                      {...register('status')}
                      className="accent-primary"
                    />
                    {s === 'done' ? 'Đã liên hệ' : 'Lên lịch'}
                  </label>
                ))}
              </div>
            </div>

            {/* Outcome — only when done */}
            {status === 'done' && (
              <div className="space-y-1.5">
                <Label>
                  Kết quả <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="outcome"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange} items={OUTCOME_LABELS}>
                      <SelectTrigger aria-invalid={status === 'done' && !outcome}>
                        <SelectValue placeholder="Chọn kết quả..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(OUTCOME_LABELS) as [LogOutcome, string][]).map(
                          ([val, label]) => (
                            <SelectItem key={val} value={val}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Ghi chú</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Nội dung cuộc gọi, thông tin quan trọng..."
                rows={3}
              />
            </div>

            {/* Follow-up section */}
            {status === 'done' && (
              <div className="border border-border rounded-md p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Controller
                    name="hasFollowUp"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Lên lịch follow-up
                </label>

                {hasFollowUp && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="followUp_date">Thời gian follow-up</Label>
                      <input
                        id="followUp_date"
                        type="datetime-local"
                        {...register('followUp_date')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="followUp_notes">Bước tiếp theo</Label>
                      <Textarea
                        id="followUp_notes"
                        {...register('followUp_notes')}
                        placeholder="Gửi brochure, gọi lại hỏi quyết định..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onClose(false)}
                disabled={submitting}
              >
                Huỷ
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang lưu...' : 'Lưu log'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* No answer dialog */}
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
            <AlertDialogCancel
              onClick={() => {
                setNoAnswerDialog(false)
                onClose(true)
              }}
            >
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
