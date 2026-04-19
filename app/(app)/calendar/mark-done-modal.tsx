'use client'

import { useRef, useState } from 'react'
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
import { markLogAsDone, moveContactToSoRac, revertContactStage } from '@/app/actions/logs'
import type { ContactLog, Stage, LogOutcome } from '@/lib/types'
import { OUTCOME_LABELS } from '@/lib/types'

function toDatetimeLocal(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

const schema = z.object({
  outcome: z.enum(['no_answer', 'bad_number', 'interested', 'not_interested', 'follow_up', 'deposited', 'closed'], {
    required_error: 'Vui lòng chọn kết quả.',
  }),
  notes: z.string().optional(),
  scheduled_for: z.string().min(1),
  hasFollowUp: z.boolean(),
  followUp_date: z.string().optional(),
  followUp_notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface MarkDoneModalProps {
  log: ContactLog & { contacts: { id: string; name: string; phone: string; stage_id: string } }
  stages: Stage[]
  onClose: () => void
}

export function MarkDoneModal({ log, stages, onClose }: MarkDoneModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [noAnswerDialog, setNoAnswerDialog] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      outcome: undefined,
      notes: log.notes ?? '',
      scheduled_for: toDatetimeLocal(new Date()),
      hasFollowUp: false,
      followUp_date: toDatetimeLocal(addDays(new Date(), 3)),
      followUp_notes: '',
    },
  })

  const hasFollowUp = watch('hasFollowUp')

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)

    const result = await markLogAsDone({
      logId: log.id,
      contact_id: log.contact_id,
      outcome: data.outcome as LogOutcome,
      notes: data.notes || null,
      scheduled_for: new Date(data.scheduled_for).toISOString(),
      followUp:
        data.hasFollowUp && data.followUp_date
          ? { scheduled_for: new Date(data.followUp_date).toISOString(), notes: data.followUp_notes || null }
          : null,
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

    let toastMsg = 'Đã đánh dấu hoàn thành.'
    if (result.stageChanged) toastMsg += ` Đã chuyển sang ${result.stageChanged.toName}.`

    if (result.showUndoCancel && result.stageChanged) {
      const { from, toName } = result.stageChanged
      toast(toastMsg, {
        duration: 10000,
        action: {
          label: 'Hoàn tác',
          onClick: async () => {
            await revertContactStage(log.contact_id, from)
            toast.success(`Đã hoàn tác. Chuyển về giai đoạn trước.`)
          },
        },
      })
    } else {
      toast.success(toastMsg)
    }

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    onClose()
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Đánh dấu hoàn thành</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-muted-foreground mb-2">
            {log.contacts.name} · {log.contacts.phone}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Outcome */}
            <div className="space-y-1.5">
              <Label>Kết quả <span className="text-destructive">*</span></Label>
              <Controller
                name="outcome"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} items={OUTCOME_LABELS}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn kết quả…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.outcome && <p className="text-xs text-destructive">{errors.outcome.message}</p>}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Textarea
                {...register('notes')}
                placeholder="Ghi chú về cuộc gọi…"
                className="resize-none"
                rows={2}
              />
            </div>

            {/* Datetime */}
            <div className="space-y-1.5">
              <Label>Thời gian thực hiện</Label>
              <input
                type="datetime-local"
                {...register('scheduled_for')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Follow-up */}
            <div className="space-y-3 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Controller
                  name="hasFollowUp"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="hasFollowUp"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="hasFollowUp" className="cursor-pointer font-normal">
                  Lên lịch follow-up
                </Label>
              </div>

              {hasFollowUp && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Thời gian follow-up</Label>
                    <input
                      type="datetime-local"
                      {...register('followUp_date')}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bước tiếp theo</Label>
                    <Textarea
                      {...register('followUp_notes')}
                      placeholder="Mô tả bước tiếp theo…"
                      className="resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang lưu…' : 'Xác nhận'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={noAnswerDialog} onOpenChange={setNoAnswerDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Không bắt máy 3 lần liên tiếp</AlertDialogTitle>
            <AlertDialogDescription>
              Contact này đã 3 lần không bắt máy. Chuyển sang Số rác?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setNoAnswerDialog(false); onClose() }}>Không</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await moveContactToSoRac(log.contact_id)
                toast.success('Đã chuyển sang Số rác.')
                setNoAnswerDialog(false)
                onClose()
              }}
            >
              Có, chuyển sang Số rác
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
