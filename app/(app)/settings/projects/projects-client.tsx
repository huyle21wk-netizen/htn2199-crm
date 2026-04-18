'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { createClient } from '@/lib/supabase/client'
import { createProject, updateProject, deleteProject } from '@/app/actions/projects'

interface Project {
  id: string
  name: string
  note: string | null
  created_at: string
  contacts?: { count: number }[]
}

const schema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên dự án.'),
  note: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const supabase = createClient()
  const [projects, setProjects] = useState(initialProjects)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [mergeInto, setMergeInto] = useState<string>('none')
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const openCreate = () => {
    setEditTarget(null)
    reset({ name: '', note: '' })
    setFormOpen(true)
  }

  const openEdit = (p: Project) => {
    setEditTarget(p)
    reset({ name: p.name, note: p.note ?? '' })
    setFormOpen(true)
  }

  const refreshProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*, contacts:contacts(count)')
      .order('name')
    setProjects(data ?? [])
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const result = editTarget
      ? await updateProject(editTarget.id, data)
      : await createProject(data)
    setSubmitting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Đã lưu.')
    setFormOpen(false)
    refreshProjects()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const result = await deleteProject(
      deleteTarget.id,
      mergeInto !== 'none' ? mergeInto : null
    )
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Đã xoá dự án.')
    setDeleteTarget(null)
    setMergeInto('none')
    refreshProjects()
  }

  const getContactCount = (p: Project) => {
    if (!p.contacts || p.contacts.length === 0) return 0
    return (p.contacts[0] as unknown as { count: number }).count
  }

  const otherProjects = projects.filter((p) => p.id !== deleteTarget?.id)

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dự án</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý danh sách dự án bất động sản
          </p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:from-[#6D28D9] hover:to-[#8B5CF6] text-white border-0"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Thêm dự án
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">Chưa có dự án nào</p>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Thêm dự án đầu tiên
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tên</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Ghi chú</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Liên hệ</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-3 py-2 font-medium">{project.name}</td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                    {project.note ?? <span className="text-border">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {getContactCount(project)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(project)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setDeleteTarget(project)
                          setMergeInto('none')
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Sửa dự án' : 'Thêm dự án'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="pname">
                Tên dự án <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pname"
                {...register('name')}
                placeholder="Vinhomes Grand Park"
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pnote">Ghi chú</Label>
              <Textarea
                id="pnote"
                {...register('note')}
                placeholder="Ghi chú về dự án..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                Huỷ
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá dự án?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <p>
                  Bạn có chắc muốn xoá dự án{' '}
                  <strong>{deleteTarget?.name}</strong>?
                </p>
                {deleteTarget && getContactCount(deleteTarget) > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-warning">
                      ⚠️ Có {getContactCount(deleteTarget)} liên hệ đang thuộc dự án này.
                      Chọn cách xử lý:
                    </p>
                    <Select value={mergeInto} onValueChange={(v) => setMergeInto(v ?? 'none')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Để trống (xoá liên kết dự án)</SelectItem>
                        {otherProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            Gộp vào: {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
