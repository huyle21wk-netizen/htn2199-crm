'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { Kanban, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { updateContactStage } from '@/app/actions/contacts'
import { ContactDetailDrawer } from '../contacts/contact-detail-drawer'
import { KanbanCard } from './kanban-card'
import type { Contact, Stage, Project } from '@/lib/types'

type ContactWithRels = Contact & { stage?: Stage | null; project?: Project | null }

interface KanbanClientProps {
  stages: Stage[]
  contacts: ContactWithRels[]
  projects: Project[]
  lastContactMap: Record<string, string>
}

export function KanbanClient({
  stages,
  contacts: initialContacts,
  projects,
  lastContactMap,
}: KanbanClientProps) {
  const [contacts, setContacts] = useState<ContactWithRels[]>(initialContacts)
  const [filterProject, setFilterProject] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [selectedMobileStageId, setSelectedMobileStageId] = useState<string>(
    stages[0]?.id ?? ''
  )
  const [drawerContact, setDrawerContact] = useState<ContactWithRels | null>(null)

  // All stages passed in are already filtered (no raw, no bad_number)
  const activeStages = stages.filter((s) => !s.is_terminal)
  const terminalStages = stages.filter((s) => s.is_terminal)

  const filteredContacts = useMemo(() => {
    let result = contacts
    if (filterProject !== 'all') {
      result = result.filter((c) => c.project_id === filterProject)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      )
    }
    return result
  }, [contacts, filterProject, search])

  const contactsByStage = useMemo(() => {
    const map: Record<string, ContactWithRels[]> = {}
    for (const stage of stages) {
      map[stage.id] = []
    }
    for (const contact of filteredContacts) {
      if (map[contact.stage_id]) {
        map[contact.stage_id].push(contact)
      }
    }
    return map
  }, [filteredContacts, stages])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const activeContact = activeContactId
    ? contacts.find((c) => c.id === activeContactId) ?? null
    : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveContactId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveContactId(null)
      const { active, over } = event
      if (!over) return

      const contactId = active.id as string
      const newStageId = over.id as string

      const contact = contacts.find((c) => c.id === contactId)
      if (!contact || contact.stage_id === newStageId) return

      const oldStageId = contact.stage_id
      const newStage = stages.find((s) => s.id === newStageId)

      // Optimistic update
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, stage_id: newStageId, stage: newStage ?? c.stage }
            : c
        )
      )

      const result = await updateContactStage(contactId, newStageId)
      if (result.error) {
        // Rollback
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contactId ? { ...c, stage_id: oldStageId, stage: contact.stage } : c
          )
        )
        toast.error(`Lỗi: ${result.error}`)
      } else {
        toast.success(`Đã chuyển sang "${newStage?.name ?? 'giai đoạn mới'}"`)
      }
    },
    [contacts, stages]
  )

  const handleMobileStageChange = useCallback(
    async (contactId: string, newStageId: string) => {
      const contact = contacts.find((c) => c.id === contactId)
      if (!contact || contact.stage_id === newStageId) return

      const oldStageId = contact.stage_id
      const newStage = stages.find((s) => s.id === newStageId)

      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, stage_id: newStageId, stage: newStage ?? c.stage }
            : c
        )
      )

      const result = await updateContactStage(contactId, newStageId)
      if (result.error) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contactId ? { ...c, stage_id: oldStageId, stage: contact.stage } : c
          )
        )
        toast.error(`Lỗi: ${result.error}`)
      } else {
        toast.success(`Đã chuyển sang "${newStage?.name ?? 'giai đoạn mới'}"`)
      }
    },
    [contacts, stages]
  )

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <h1 className="text-2xl font-semibold shrink-0">Kanban</h1>
        <div className="flex flex-1 gap-2 flex-wrap sm:flex-nowrap sm:justify-end">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Tìm tên, SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={filterProject} onValueChange={(val) => setFilterProject(val ?? 'all')} items={[{value: 'all', label: 'Tất cả dự án'}, ...projects.map(p => ({value: p.id, label: p.name}))]}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Tất cả dự án" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả dự án</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty state when no CRM contacts at all */}
      {contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="p-4 rounded-full bg-secondary">
            <Kanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Chưa có khách hàng trong CRM</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Liên hệ cần được tạo log với kết quả &quot;Có quan tâm&quot; để xuất hiện ở đây
            </p>
          </div>
        </div>
      )}

      {/* Desktop Board */}
      {contacts.length > 0 && <div className="hidden md:block -mx-6 px-6 overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 w-max min-w-full">
            {/* Active columns */}
            {activeStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                contacts={contactsByStage[stage.id] ?? []}
                lastContactMap={lastContactMap}
                onCardClick={(c) => setDrawerContact(c)}
              />
            ))}

            {/* Terminal separator + columns */}
            {terminalStages.length > 0 && (
              <>
                <div className="w-px self-stretch border-l border-dashed border-border mx-1" />
                {terminalStages.map((stage) => (
                  <KanbanColumn
                    key={stage.id}
                    stage={stage}
                    contacts={contactsByStage[stage.id] ?? []}
                    lastContactMap={lastContactMap}
                    onCardClick={(c) => setDrawerContact(c)}
                    isTerminal
                  />
                ))}
              </>
            )}
          </div>

          <DragOverlay>
            {activeContact && (
              <KanbanCard
                contact={activeContact}
                lastContactDate={lastContactMap[activeContact.id]}
                isDragOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>}

      {/* Mobile View */}
      {contacts.length > 0 && <div className="md:hidden">
        {/* Stage tabs */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 w-max pb-3">
            {stages.map((stage) => {
              const isActive = stage.id === selectedMobileStageId
              return (
                <button
                  key={stage.id}
                  onClick={() => setSelectedMobileStageId(stage.id)}
                  className={[
                    'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {stage.name}
                  <span className="ml-1.5 text-xs opacity-70">
                    {(contactsByStage[stage.id] ?? []).length}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Contact list for selected stage */}
        <div className="space-y-2">
          {(contactsByStage[selectedMobileStageId] ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Chưa có liên hệ
            </p>
          ) : (
            (contactsByStage[selectedMobileStageId] ?? []).map((contact) => (
              <MobileContactCard
                key={contact.id}
                contact={contact}
                stages={stages}
                lastContactDate={lastContactMap[contact.id]}
                onCardClick={() => setDrawerContact(contact)}
                onStageChange={(stageId) => handleMobileStageChange(contact.id, stageId)}
              />
            ))
          )}
        </div>
      </div>}

      {/* Contact detail drawer */}
      {drawerContact && (
        <ContactDetailDrawer
          contact={drawerContact}
          stages={stages}
          projects={projects}
          onClose={() => setDrawerContact(null)}
          onEdit={() => {}}
          onDelete={() => {}}
          onNewLog={() => {}}
          onZalo={() => {
            const url = `https://zalo.me/${drawerContact.phone.replace(/\s/g, '')}`
            window.open(url, '_blank')
          }}
          onRefresh={() => {}}
        />
      )}
    </>
  )
}

// Desktop Kanban Column
function KanbanColumn({
  stage,
  contacts,
  lastContactMap,
  onCardClick,
  isTerminal = false,
}: {
  stage: Stage
  contacts: ContactWithRels[]
  lastContactMap: Record<string, string>
  onCardClick: (c: ContactWithRels) => void
  isTerminal?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const accentColor = stage.color ?? '#6B7280'

  return (
    <div
      className={[
        'flex flex-col w-[280px] shrink-0 rounded-lg bg-secondary/50 border border-border',
        isTerminal ? 'opacity-80' : '',
        isOver ? 'ring-2 ring-primary/40' : '',
      ].join(' ')}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-sm font-medium flex-1 truncate">{stage.name}</span>
        <Badge
          variant="secondary"
          className="rounded-full text-xs h-5 min-w-5 px-1.5"
        >
          {contacts.length}
        </Badge>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-220px)]">
        <div
          ref={setNodeRef}
          className="p-2 space-y-2 min-h-[80px]"
        >
          {contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Chưa có liên hệ
            </p>
          ) : (
            contacts.map((contact) => (
              <DraggableCard
                key={contact.id}
                contact={contact}
                lastContactDate={lastContactMap[contact.id]}
                onClick={() => onCardClick(contact)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// Draggable wrapper for KanbanCard
function DraggableCard({
  contact,
  lastContactDate,
  onClick,
}: {
  contact: ContactWithRels
  lastContactDate?: string
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: contact.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <KanbanCard
        contact={contact}
        lastContactDate={lastContactDate}
        onClick={onClick}
      />
    </div>
  )
}

// Mobile contact card with stage change select
function MobileContactCard({
  contact,
  stages,
  lastContactDate,
  onCardClick,
  onStageChange,
}: {
  contact: ContactWithRels
  stages: Stage[]
  lastContactDate?: string
  onCardClick: () => void
  onStageChange: (stageId: string) => void
}) {
  return (
    <div className="bg-background border border-border rounded-lg p-3 space-y-2">
      <div onClick={onCardClick}>
        <KanbanCard contact={contact} lastContactDate={lastContactDate} />
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <span className="text-xs text-muted-foreground shrink-0">Chuyển sang:</span>
        <Select
          value={contact.stage_id}
          onValueChange={(val) => val && onStageChange(val)}
          items={stages.map(s => ({value: s.id, label: s.name}))}
        >
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
