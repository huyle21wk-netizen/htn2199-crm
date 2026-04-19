'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { validatePhone } from '@/lib/phone'
import { createContact, updateContact, getExistingSources } from '@/app/actions/contacts'
import { createProject as createProjectAction } from '@/app/actions/projects'
import type { Contact, Project } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên.'),
  phone: z.string().min(1, 'Vui lòng nhập số điện thoại.'),
  project_id: z.string().optional(),
  source: z.string().optional(),
  note: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ContactFormModalProps {
  open: boolean
  contact: Contact | null
  projects: Project[]
  onClose: (saved: boolean) => void
}

export function ContactFormModal({ open, contact, projects: initialProjects, onClose }: ContactFormModalProps) {
  const supabase = createClient()
  const [projects, setProjects] = useState(initialProjects)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneFormatted, setPhoneFormatted] = useState('')
  const [dupWarning, setDupWarning] = useState<{ id: string; name: string } | null>(null)
  const [sources, setSources] = useState<string[]>([])
  const [showSourceSuggest, setShowSourceSuggest] = useState(false)
  const [newProjectMode, setNewProjectMode] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const dupCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      project_id: '',
      source: '',
      note: '',
    },
  })

  const sourceValue = watch('source') ?? ''

  useEffect(() => {
    if (open) {
      if (contact) {
        reset({
          name: contact.name,
          phone: contact.phone,
          project_id: contact.project_id ?? '',
          source: contact.source ?? '',
          note: contact.note ?? '',
        })
        setPhoneFormatted(contact.phone)
      } else {
        reset({ name: '', phone: '', project_id: '', source: '', note: '' })
        setPhoneFormatted('')
      }
      setPhoneError(null)
      setDupWarning(null)
      setNewProjectMode(false)
      setNewProjectName('')
      // Load sources
      getExistingSources().then(setSources)
      setProjects(initialProjects)
    }
  }, [open, contact, reset, initialProjects])

  const handlePhoneBlur = async (raw: string) => {
    if (!raw) return
    const result = validatePhone(raw)
    if (!result.valid) {
      setPhoneError(result.error)
      setPhoneFormatted('')
      return
    }
    setPhoneError(null)
    setPhoneFormatted(result.formatted)
    setValue('phone', result.formatted)

    // Duplicate check
    if (dupCheckRef.current) clearTimeout(dupCheckRef.current)
    const { data } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('phone', result.formatted)
      .neq('id', contact?.id ?? '00000000-0000-0000-0000-000000000000')
      .maybeSingle()

    if (data) {
      setDupWarning(data)
    } else {
      setDupWarning(null)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    const result = await createProjectAction({ name: newProjectName.trim() })
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.project) {
      const updated = [...projects, result.project as Project].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      setProjects(updated)
      setValue('project_id', result.project.id)
    }
    setNewProjectMode(false)
    setNewProjectName('')
  }

  const onSubmit = async (data: FormData) => {
    const phoneResult = validatePhone(data.phone)
    if (!phoneResult.valid) {
      setPhoneError(phoneResult.error)
      return
    }
    setSubmitting(true)
    const payload = {
      name: data.name,
      phone: phoneResult.formatted,
      project_id: data.project_id || null,
      source: data.source || null,
      note: data.note || null,
    }

    const result = contact
      ? await updateContact(contact.id, payload)
      : await createContact(payload)

    setSubmitting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Đã lưu.')
    onClose(true)
  }

  const filteredSources = sources.filter(
    (s) => s.toLowerCase().includes(sourceValue.toLowerCase()) && s !== sourceValue
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>{contact ? 'Sửa liên hệ' : 'Thêm liên hệ'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Tên <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Nguyễn Văn A"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              Số điện thoại <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="0912 345 678"
              aria-invalid={!!phoneError || !!errors.phone}
              onBlur={(e) => handlePhoneBlur(e.target.value)}
            />
            {phoneFormatted && !phoneError && (
              <p className="text-xs text-muted-foreground">
                Định dạng: {phoneFormatted}
              </p>
            )}
            {phoneError && (
              <p className="text-xs text-destructive">{phoneError}</p>
            )}
            {errors.phone && !phoneError && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
            {dupWarning && (
              <div className="text-xs bg-warning/10 border border-warning/30 rounded-md px-3 py-2 text-foreground">
                ⚠️ Số này đã có trong hệ thống:{' '}
                <strong>{dupWarning.name}</strong>.{' '}
                <button
                  type="button"
                  className="underline text-primary"
                  onClick={() => setDupWarning(null)}
                >
                  Bỏ qua
                </button>
              </div>
            )}
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <Label>Dự án</Label>
            {newProjectMode ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Tên dự án mới"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCreateProject()
                    }
                    if (e.key === 'Escape') {
                      setNewProjectMode(false)
                      setNewProjectName('')
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={handleCreateProject}>
                  Lưu
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewProjectMode(false)
                    setNewProjectName('')
                  }}
                >
                  Huỷ
                </Button>
              </div>
            ) : (
              <Select
                value={watch('project_id') ?? ''}
                items={[{value: '', label: 'Không có'}, ...projects.map(p => ({value: p.id, label: p.name})), {value: '__new__', label: 'Thêm dự án mới'}]}
                onValueChange={(val) => {
                  if (val === '__new__') {
                    setNewProjectMode(true)
                  } else {
                    setValue('project_id', val ?? undefined)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn dự án (không bắt buộc)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Không có</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">
                    <span className="flex items-center gap-1 text-primary">
                      <Plus className="h-3.5 w-3.5" />
                      Thêm dự án mới
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Source */}
          <div className="space-y-1.5 relative">
            <Label htmlFor="source">Nguồn</Label>
            <Input
              id="source"
              {...register('source')}
              placeholder="FB ads, Zalo, Giới thiệu..."
              autoComplete="off"
              onFocus={() => setShowSourceSuggest(true)}
              onBlur={() => setTimeout(() => setShowSourceSuggest(false), 150)}
            />
            {showSourceSuggest && filteredSources.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                {filteredSources.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={() => {
                      setValue('source', s)
                      setShowSourceSuggest(false)
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea
              id="note"
              {...register('note')}
              placeholder="Ghi chú về khách hàng..."
              rows={3}
            />
          </div>

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
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
