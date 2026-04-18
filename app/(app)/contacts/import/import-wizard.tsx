'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Upload, ChevronLeft, ChevronRight, Check, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { validatePhone } from '@/lib/phone'
import { importContacts } from '@/app/actions/contacts'
import { createProject } from '@/app/actions/projects'
import type { Project } from '@/lib/types'

// Column mapping fields
type CrmField = 'name' | 'phone' | 'project' | 'source' | 'note' | 'ignore'
const CRM_FIELD_LABELS: Record<CrmField, string> = {
  name: 'Tên',
  phone: 'SĐT',
  project: 'Dự án',
  source: 'Nguồn',
  note: 'Ghi chú',
  ignore: 'Bỏ qua',
}

// Auto-detect column mapping
function detectField(header: string): CrmField {
  const h = header.toLowerCase().trim()
  if (/^(name|họ tên|ho ten|tên|ten|full name)$/.test(h)) return 'name'
  if (/^(phone|sđt|sdt|số điện thoại|so dien thoai|mobile|tel)$/.test(h)) return 'phone'
  if (/^(project|dự án|du an|interested project)$/.test(h)) return 'project'
  if (/^(source|nguồn|nguon|từ đâu|tu dau)$/.test(h)) return 'source'
  if (/^(note|ghi chú|ghi chu|notes|comment)$/.test(h)) return 'note'
  return 'ignore'
}

type RowStatus = 'valid' | 'duplicate' | 'missing_name' | 'missing_phone' | 'invalid_phone'

interface ParsedRow {
  raw: Record<string, string>
  index: number
}

interface MappedRow {
  index: number
  name: string
  phone: string
  phoneFormatted: string
  project: string
  source: string
  note: string
  status: RowStatus
  dupName?: string
  skip: boolean
}

interface ProjectResolution {
  rawName: string
  action: 'create' | 'map' | 'ignore'
  mapToId?: string
}

interface ImportWizardProps {
  initialProjects: Project[]
}

export function ImportWizard({ initialProjects }: ImportWizardProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [projects, setProjects] = useState(initialProjects)

  // Step 1
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [globalSource, setGlobalSource] = useState('')
  const [fileName, setFileName] = useState('')

  // Step 2
  const [mapping, setMapping] = useState<Record<string, CrmField>>({})

  // Step 3
  const [projectResolutions, setProjectResolutions] = useState<Record<string, ProjectResolution>>({})

  // Step 4
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([])
  const [existingPhones, setExistingPhones] = useState<Map<string, string>>(new Map())

  // Step 5
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  // ─── Step 1: Parse file ────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (result) => {
          const hdrs = result.meta.fields ?? []
          const data = result.data as Record<string, string>[]
          setHeaders(hdrs)
          setRows(data.map((r, i) => ({ raw: r, index: i })))
          setPreviewRows(data.slice(0, 5))
          const autoMap: Record<string, CrmField> = {}
          hdrs.forEach((h) => { autoMap[h] = detectField(h) })
          setMapping(autoMap)
          setStep(2)
        },
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
          defval: '',
          raw: false,
        })
        const hdrs = json.length > 0 ? Object.keys(json[0]) : []
        setHeaders(hdrs)
        setRows(json.map((r, i) => ({ raw: r, index: i })))
        setPreviewRows(json.slice(0, 5))
        const autoMap: Record<string, CrmField> = {}
        hdrs.forEach((h) => { autoMap[h] = detectField(h) })
        setMapping(autoMap)
        setStep(2)
      }
      reader.readAsArrayBuffer(file)
    } else {
      toast.error('Chỉ hỗ trợ file .csv, .xlsx, .xls')
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  // ─── Step 2 → 3: Build project list ───────────────────────────────────────
  const proceedToStep3 = () => {
    const nameCol = Object.entries(mapping).find(([, v]) => v === 'name')?.[0]
    const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0]

    if (!nameCol || !phoneCol) {
      toast.error('Vui lòng map cột Tên và SĐT.')
      return
    }

    const projectCol = Object.entries(mapping).find(([, v]) => v === 'project')?.[0]
    if (!projectCol) {
      // Skip step 3
      proceedToStep4()
      return
    }

    const rawProjectNames = [
      ...new Set(rows.map((r) => r.raw[projectCol]?.trim()).filter(Boolean)),
    ]
    const existingNames = new Set(projects.map((p) => p.name.toLowerCase()))

    const initial: Record<string, ProjectResolution> = {}
    rawProjectNames.forEach((name) => {
      const match = projects.find((p) => p.name.toLowerCase() === name.toLowerCase())
      initial[name] = match
        ? { rawName: name, action: 'map', mapToId: match.id }
        : { rawName: name, action: 'create' }
    })
    setProjectResolutions(initial)

    if (rawProjectNames.every((n) => existingNames.has(n.toLowerCase()))) {
      // All known, skip to step 4
      proceedToStep4(initial)
    } else {
      setStep(3)
    }
  }

  // ─── Step 3 → 4: Validate rows ────────────────────────────────────────────
  const proceedToStep4 = async (resolutions?: Record<string, ProjectResolution>) => {
    const res = resolutions ?? projectResolutions
    const nameCol = Object.entries(mapping).find(([, v]) => v === 'name')?.[0]!
    const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0]!
    const projectCol = Object.entries(mapping).find(([, v]) => v === 'project')?.[0]
    const sourceCol = Object.entries(mapping).find(([, v]) => v === 'source')?.[0]
    const noteCol = Object.entries(mapping).find(([, v]) => v === 'note')?.[0]

    // Build project ID map from resolutions
    const projectIdMap: Record<string, string | null> = {}
    if (projectCol) {
      Object.values(res).forEach((r) => {
        if (r.action === 'map' && r.mapToId) projectIdMap[r.rawName] = r.mapToId
        else if (r.action === 'create') projectIdMap[r.rawName] = null // will be created
        else projectIdMap[r.rawName] = null
      })
    }

    // Collect all phone numbers to check for duplicates in DB
    const allPhones: string[] = []
    const phoneMap: Record<number, string> = {}
    rows.forEach((row) => {
      const raw = row.raw[phoneCol] ?? ''
      const result = validatePhone(raw)
      if (result.valid) {
        allPhones.push(result.formatted)
        phoneMap[row.index] = result.formatted
      }
    })

    // Check for existing phones in DB
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const existingMap = new Map<string, string>()
    if (allPhones.length > 0) {
      const { data } = await supabase
        .from('contacts')
        .select('phone, name')
        .in('phone', allPhones)
      data?.forEach((c) => existingMap.set(c.phone, c.name))
    }
    setExistingPhones(existingMap)

    const mapped: MappedRow[] = rows.map((row) => {
      const name = (row.raw[nameCol] ?? '').trim()
      const rawPhone = row.raw[phoneCol] ?? ''
      const projectRaw = projectCol ? (row.raw[projectCol] ?? '').trim() : ''
      const source = sourceCol
        ? (row.raw[sourceCol] ?? '').trim() || globalSource
        : globalSource
      const note = noteCol ? (row.raw[noteCol] ?? '').trim() : ''

      let status: RowStatus = 'valid'
      let phoneFormatted = ''
      let dupName: string | undefined

      if (!name) {
        status = 'missing_name'
      } else if (!rawPhone.trim()) {
        status = 'missing_phone'
      } else {
        const phoneResult = validatePhone(rawPhone)
        if (!phoneResult.valid) {
          status = 'invalid_phone'
        } else {
          phoneFormatted = phoneResult.formatted
          if (existingMap.has(phoneFormatted)) {
            status = 'duplicate'
            dupName = existingMap.get(phoneFormatted)
          }
        }
      }

      return {
        index: row.index,
        name,
        phone: rawPhone,
        phoneFormatted,
        project: projectRaw,
        source,
        note,
        status,
        dupName,
        skip: status !== 'valid',
      }
    })

    setMappedRows(mapped)
    setStep(4)
  }

  // ─── Step 4 → 5: Import ────────────────────────────────────────────────────
  const doImport = async () => {
    setImporting(true)
    setStep(5)
    setImportProgress(10)

    // Create new projects first
    const newProjectIdMap: Record<string, string> = {}
    const toCreate = Object.values(projectResolutions).filter((r) => r.action === 'create')
    for (const res of toCreate) {
      const result = await createProject({ name: res.rawName })
      if (result.project) {
        newProjectIdMap[res.rawName] = result.project.id
        setProjects((prev) => [...prev, result.project as Project])
      }
    }
    setImportProgress(30)

    // Build final rows to import
    const toImport = mappedRows
      .filter((r) => !r.skip && r.status === 'valid')
      .map((r) => {
        let projectId: string | null = null
        if (r.project) {
          const res = projectResolutions[r.project]
          if (res?.action === 'map' && res.mapToId) projectId = res.mapToId
          else if (res?.action === 'create') projectId = newProjectIdMap[r.project] ?? null
        }
        return {
          name: r.name,
          phone: r.phoneFormatted,
          project_id: projectId,
          source: r.source || null,
          note: r.note || null,
        }
      })

    setImportProgress(50)

    if (toImport.length === 0) {
      toast.info('Không có liên hệ hợp lệ để import.')
      setImporting(false)
      setImportProgress(100)
      return
    }

    const result = await importContacts(toImport)
    setImportProgress(100)

    if (result.error) {
      toast.error('Lỗi import: ' + result.error)
      setImporting(false)
      return
    }

    const skipped = mappedRows.filter((r) => r.skip).length
    toast.success(`Đã import ${toImport.length} liên hệ. ${skipped} bỏ qua.`)
    setTimeout(() => router.push('/contacts'), 1000)
  }

  const validCount = mappedRows.filter((r) => !r.skip && r.status === 'valid').length
  const dupCount = mappedRows.filter((r) => r.status === 'duplicate').length
  const errorCount = mappedRows.filter(
    (r) => r.status === 'missing_name' || r.status === 'missing_phone' || r.status === 'invalid_phone'
  ).length

  const hasProjectStep = step >= 3 || Object.values(mapping).includes('project')
  const needsProjectStep =
    Object.values(mapping).includes('project') &&
    Object.values(projectResolutions).some((r) => r.action === 'create')

  const steps = ['Upload', 'Cột', ...(hasProjectStep ? ['Dự án'] : []), 'Xem trước', 'Import']
  const currentStepIndex = step - 1

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/contacts')}>
        <ChevronLeft className="h-4 w-4" />
        Quay lại
      </Button>

      <div>
        <h1 className="text-2xl font-semibold">Import liên hệ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import từ file CSV hoặc Excel
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 text-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                ${i < currentStepIndex ? 'bg-primary text-primary-foreground' : ''}
                ${i === currentStepIndex ? 'bg-primary text-primary-foreground' : ''}
                ${i > currentStepIndex ? 'bg-secondary text-muted-foreground border border-border' : ''}
              `}
            >
              {i < currentStepIndex ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={`hidden sm:inline ${i === currentStepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* ─── Step 1: Upload ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Kéo thả file vào đây hoặc bấm để chọn</p>
            <p className="text-xs text-muted-foreground mt-1">
              Hỗ trợ .csv, .xlsx, .xls
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="globalSource">Nguồn cho toàn bộ file (không bắt buộc)</Label>
            <Input
              id="globalSource"
              placeholder="FB ads T4/2026, Zalo group..."
              value={globalSource}
              onChange={(e) => setGlobalSource(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ─── Step 2: Column mapping ──────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            File: <strong>{fileName}</strong> — {rows.length} dòng
          </p>

          {/* Preview */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  {headers.map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {headers.map((h) => (
                      <td key={h} className="px-2 py-1.5 text-muted-foreground max-w-32 truncate">
                        {row[h] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mapping selects */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Map cột với trường CRM:</p>
            <div className="grid gap-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate shrink-0 text-muted-foreground">{h}</span>
                  <Select
                    value={mapping[h] ?? 'ignore'}
                    onValueChange={(val) =>
                      setMapping((prev) => ({ ...prev, [h]: val as CrmField }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(CRM_FIELD_LABELS) as [CrmField, string][]).map(
                        ([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" />
              Quay lại
            </Button>
            <Button onClick={proceedToStep3}>
              Tiếp theo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Project resolution ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tìm thấy các dự án chưa có trong hệ thống. Chọn cách xử lý:
          </p>
          <div className="space-y-2">
            {Object.values(projectResolutions).map((res) => {
              const isExisting = projects.some(
                (p) => p.name.toLowerCase() === res.rawName.toLowerCase()
              )
              return (
                <div
                  key={res.rawName}
                  className="flex items-center gap-3 p-3 border border-border rounded-lg flex-wrap"
                >
                  <span className="text-sm font-medium w-40 shrink-0">{res.rawName}</span>
                  <div className="flex gap-2 flex-wrap flex-1">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={res.rawName}
                        checked={res.action === 'create'}
                        onChange={() =>
                          setProjectResolutions((prev) => ({
                            ...prev,
                            [res.rawName]: { ...res, action: 'create' },
                          }))
                        }
                        className="accent-primary"
                        disabled={isExisting}
                      />
                      Tạo mới
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={res.rawName}
                        checked={res.action === 'map'}
                        onChange={() =>
                          setProjectResolutions((prev) => ({
                            ...prev,
                            [res.rawName]: {
                              ...res,
                              action: 'map',
                              mapToId: projects[0]?.id,
                            },
                          }))
                        }
                        className="accent-primary"
                      />
                      Gán vào có sẵn
                    </label>
                    {res.action === 'map' && (
                      <Select
                        value={res.mapToId ?? ''}
                        onValueChange={(val) =>
                          setProjectResolutions((prev) => ({
                            ...prev,
                            [res.rawName]: { ...res, mapToId: val ?? undefined },
                          }))
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-40">
                          <SelectValue placeholder="Chọn dự án..." />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={res.rawName}
                        checked={res.action === 'ignore'}
                        onChange={() =>
                          setProjectResolutions((prev) => ({
                            ...prev,
                            [res.rawName]: { ...res, action: 'ignore' },
                          }))
                        }
                        className="accent-primary"
                      />
                      Để trống
                    </label>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4" />
              Quay lại
            </Button>
            <Button onClick={() => proceedToStep4()}>
              Tiếp theo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Validation preview ─────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex gap-3 text-sm flex-wrap">
            <span className="flex items-center gap-1 text-success">
              <Check className="h-4 w-4" /> {validCount} hợp lệ
            </span>
            {dupCount > 0 && (
              <span className="flex items-center gap-1 text-warning">
                <AlertTriangle className="h-4 w-4" /> {dupCount} trùng SĐT
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <X className="h-4 w-4" /> {errorCount} lỗi
              </span>
            )}
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Bỏ qua</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Trạng thái</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Tên</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">SĐT</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Dự án</th>
                </tr>
              </thead>
              <tbody>
                {mappedRows.map((row) => (
                  <tr
                    key={row.index}
                    className={`border-b border-border last:border-0 ${row.skip ? 'opacity-50' : ''}`}
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={row.skip}
                        onChange={(e) =>
                          setMappedRows((prev) =>
                            prev.map((r) =>
                              r.index === row.index ? { ...r, skip: e.target.checked } : r
                            )
                          )
                        }
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {row.status === 'valid' && (
                        <span className="text-success flex items-center gap-1">
                          <Check className="h-3 w-3" /> Hợp lệ
                        </span>
                      )}
                      {row.status === 'duplicate' && (
                        <span className="text-warning flex items-center gap-1 whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3" /> Trùng ({row.dupName})
                        </span>
                      )}
                      {row.status === 'missing_name' && (
                        <span className="text-destructive flex items-center gap-1">
                          <X className="h-3 w-3" /> Thiếu tên
                        </span>
                      )}
                      {row.status === 'missing_phone' && (
                        <span className="text-destructive flex items-center gap-1">
                          <X className="h-3 w-3" /> Thiếu SĐT
                        </span>
                      )}
                      {row.status === 'invalid_phone' && (
                        <span className="text-destructive flex items-center gap-1">
                          <X className="h-3 w-3" /> SĐT không hợp lệ
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 max-w-32 truncate">{row.name}</td>
                    <td className="px-2 py-1.5 font-mono">{row.phoneFormatted || row.phone}</td>
                    <td className="px-2 py-1.5 hidden sm:table-cell text-muted-foreground">
                      {row.project}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setStep(needsProjectStep ? 3 : 2)}>
              <ChevronLeft className="h-4 w-4" />
              Quay lại
            </Button>
            <Button
              disabled={validCount === 0}
              onClick={doImport}
              className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:from-[#6D28D9] hover:to-[#8B5CF6] text-white border-0"
            >
              Import {validCount} liên hệ
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 5: Progress ────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4 text-center py-8">
          {importing ? (
            <>
              <p className="text-sm font-medium">Đang import...</p>
              <Progress value={importProgress} className="w-full max-w-sm mx-auto" />
              <p className="text-xs text-muted-foreground">{importProgress}%</p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-full bg-success/10">
                <Check className="h-6 w-6 text-success" />
              </div>
              <p className="font-medium">Import hoàn tất!</p>
              <p className="text-sm text-muted-foreground">Đang chuyển về danh sách liên hệ...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
