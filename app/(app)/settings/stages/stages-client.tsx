'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createStage, updateStage, deleteStage, reorderStages } from '@/app/actions/stages'
import type { Stage } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên giai đoạn.'),
  color: z.string().min(4, 'Chọn màu cho giai đoạn.'),
  is_terminal: z.boolean(),
})
type FormData = z.infer<typeof schema>

interface StagesClientProps {
  initialStages: Stage[]
  contactCountMap: Record<string, number>
}

export function StagesClient({ initialStages, contactCountMap }: StagesClientProps) {
  const [stages, setStages] = useState<Stage[]>(initialStages)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Stage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null)
  const [migrateTo, setMigrateTo] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const systemStages = stages.filter((s) => s.is_system)
  const draggableStages = stages.filter((s) => !s.is_system)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = draggableStages.findIndex((s) => s.id === active.id)
      const newIndex = draggableStages.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(draggableStages, oldIndex, newIndex)

      // Optimistic update: rebuild full stages list preserving system stages positions
      const rawStage = systemStages.find((s) => s.is_raw)
      const badStage = systemStages.find((s) => s.is_bad_number)
      const newList: Stage[] = []
      if (rawStage) newList.push(rawStage)
      newList.push(...reordered)
      if (badStage) newList.push(badStage)

      setStages(newList)

      const result = await reorderStages(reordered.map((s) => s.id))
      if (result.error) {
        setStages(stages)
        toast.error('Lỗi khi lưu thứ tự: ' + result.error)
      }
    },
    [draggableStages, systemStages, stages]
  )

  const openCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  const openEdit = (stage: Stage) => {
    setEditTarget(stage)
    setFormOpen(true)
  }

  const handleFormSuccess = (newStages: Stage[]) => {
    setStages(newStages)
    setFormOpen(false)
    setEditTarget(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const count = contactCountMap[deleteTarget.id] ?? 0
    if (count > 0 && !migrateTo) {
      toast.error('Vui lòng chọn giai đoạn để chuyển liên hệ.')
      return
    }
    setSubmitting(true)
    const targetId = count > 0 ? migrateTo : (stages.find((s) => !s.is_system && s.id !== deleteTarget.id)?.id ?? '')
    const result = await deleteStage(deleteTarget.id, targetId)
    setSubmitting(false)
    if (result.error) {
      toast.error('Lỗi: ' + result.error)
    } else {
      toast.success('Đã xoá giai đoạn.')
      setStages((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
      setMigrateTo('')
    }
  }

  const deleteContactCount = deleteTarget ? (contactCountMap[deleteTarget.id] ?? 0) : 0
  const migrateOptions = stages.filter((s) => s.id !== deleteTarget?.id && !s.is_bad_number && !s.is_raw)

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quản lý giai đoạn</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kéo để sắp xếp thứ tự hiển thị trên Kanban
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Thêm giai đoạn
        </Button>
      </div>

      <div className="space-y-1">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={draggableStages.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* System: Raw (fixed top) */}
            {systemStages
              .filter((s) => s.is_raw)
              .map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  contactCount={contactCountMap[stage.id] ?? 0}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  disabled
                />
              ))}

            {/* Draggable non-system stages */}
            {draggableStages.map((stage) => (
              <SortableStageRow
                key={stage.id}
                stage={stage}
                contactCount={contactCountMap[stage.id] ?? 0}
                onEdit={() => openEdit(stage)}
                onDelete={() => {
                  setMigrateTo('')
                  setDeleteTarget(stage)
                }}
              />
            ))}

            {/* System: Số rác (fixed bottom) */}
            {systemStages
              .filter((s) => s.is_bad_number)
              .map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  contactCount={contactCountMap[stage.id] ?? 0}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  disabled
                />
              ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Create/Edit modal */}
      <StageFormModal
        open={formOpen}
        editTarget={editTarget}
        stages={stages}
        onClose={() => {
          setFormOpen(false)
          setEditTarget(null)
        }}
        onSuccess={handleFormSuccess}
      />

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá giai đoạn "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteContactCount > 0 ? (
                <>
                  Có <strong>{deleteContactCount} liên hệ</strong> đang ở giai đoạn này.
                  Chọn giai đoạn để chuyển họ sang:
                </>
              ) : (
                'Giai đoạn này không có liên hệ nào. Xác nhận xoá?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteContactCount > 0 && (
            <div className="py-2">
              <Select value={migrateTo} onValueChange={(val) => setMigrateTo(val ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn giai đoạn thay thế..." />
                </SelectTrigger>
                <SelectContent>
                  {migrateOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={submitting || (deleteContactCount > 0 && !migrateTo)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Đang xoá...' : 'Xoá giai đoạn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Non-draggable row (for system stages)
function StageRow({
  stage,
  contactCount,
  onEdit,
  onDelete,
  disabled = false,
}: {
  stage: Stage
  contactCount: number
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  const accentColor = stage.color ?? '#6B7280'

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border border-border rounded-lg bg-background opacity-60">
      <div className="w-5 h-5 flex items-center justify-center text-muted-foreground/40">
        <GripVertical className="h-4 w-4" />
      </div>
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: accentColor }}
      />
      <span className="flex-1 text-sm font-medium truncate">{stage.name}</span>
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className="text-xs">Hệ thống</Badge>
        {stage.is_terminal && (
          <Badge variant="outline" className="text-xs">Kết thúc</Badge>
        )}
        <span className="text-xs text-muted-foreground w-6 text-right">{contactCount}</span>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" disabled>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled className="hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// Sortable row for non-system stages
function SortableStageRow({
  stage,
  contactCount,
  onEdit,
  onDelete,
}: {
  stage: Stage
  contactCount: number
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const accentColor = stage.color ?? '#6B7280'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2.5 border border-border rounded-lg bg-background hover:bg-secondary/30 transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="w-5 h-5 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: accentColor }}
      />
      <span className="flex-1 text-sm font-medium truncate">{stage.name}</span>
      <div className="flex items-center gap-1.5">
        {stage.is_terminal && (
          <Badge variant="outline" className="text-xs">Kết thúc</Badge>
        )}
        <span className="text-xs text-muted-foreground w-6 text-right">{contactCount}</span>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// Create/Edit modal
function StageFormModal({
  open,
  editTarget,
  stages,
  onClose,
  onSuccess,
}: {
  open: boolean
  editTarget: Stage | null
  stages: Stage[]
  onClose: () => void
  onSuccess: (stages: Stage[]) => void
}) {
  const isEdit = !!editTarget
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        name: '',
        color: '#7C3AED',
        is_terminal: false,
      },
    })

  useEffect(() => {
    if (open) {
      reset({
        name: editTarget?.name ?? '',
        color: editTarget?.color ?? '#7C3AED',
        is_terminal: editTarget?.is_terminal ?? false,
      })
    }
  }, [open, editTarget, reset])

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose()
      reset()
    }
  }

  const onSubmit = async (data: FormData) => {
    if (isEdit && editTarget) {
      const result = await updateStage(editTarget.id, data)
      if (result.error) {
        toast.error('Lỗi: ' + result.error)
        return
      }
      toast.success('Đã cập nhật giai đoạn.')
      onSuccess(
        stages.map((s) =>
          s.id === editTarget.id ? { ...s, ...data } : s
        )
      )
    } else {
      const result = await createStage(data)
      if (result.error) {
        toast.error('Lỗi: ' + result.error)
        return
      }
      toast.success('Đã thêm giai đoạn.')
      // Reload: just close and let user see updated list via server revalidation
      // Since we don't have the new ID, we'll refetch by closing and the parent page will revalidate
      onClose()
      reset()
      // Trigger a soft reload
      window.location.reload()
    }
  }

  const colorValue = watch('color')
  const isTerminalValue = watch('is_terminal')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa giai đoạn' : 'Thêm giai đoạn'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên giai đoạn *</Label>
            <Input id="name" {...register('name')} placeholder="Ví dụ: Đang xem nhà" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="color">Màu sắc</Label>
            <div className="flex items-center gap-3">
              <input
                id="color"
                type="color"
                value={colorValue}
                onChange={(e) => setValue('color', e.target.value)}
                className="h-9 w-16 rounded-md border border-border cursor-pointer p-1"
              />
              <span className="text-sm text-muted-foreground font-mono">{colorValue}</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="is_terminal"
              checked={isTerminalValue}
              onCheckedChange={(v) => setValue('is_terminal', !!v)}
              disabled={isEdit && editTarget?.is_system}
            />
            <div className="space-y-0.5">
              <Label htmlFor="is_terminal" className="cursor-pointer">
                Giai đoạn kết thúc
              </Label>
              <p className="text-xs text-muted-foreground">
                Sẽ hiện ở cuối Kanban với visual phân biệt
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
