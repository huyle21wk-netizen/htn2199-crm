'use client'

import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { PhoneDisplay } from '@/components/phone-display'
import type { Contact, Stage, Project } from '@/lib/types'

interface KanbanCardProps {
  contact: Contact & { stage?: Stage | null; project?: Project | null }
  lastContactDate?: string
  isDragOverlay?: boolean
  onClick?: () => void
}

export function KanbanCard({
  contact,
  lastContactDate,
  isDragOverlay = false,
  onClick,
}: KanbanCardProps) {
  const lastContactText = lastContactDate
    ? `Liên hệ ${formatDistanceToNow(new Date(lastContactDate), { addSuffix: true, locale: vi })}`
    : 'Chưa liên hệ'

  return (
    <div
      className={[
        'bg-background border border-border rounded-md p-3 text-sm select-none',
        isDragOverlay
          ? 'shadow-lg rotate-1 opacity-95'
          : 'hover:shadow-sm transition-shadow duration-150 cursor-grab active:cursor-grabbing',
      ].join(' ')}
      onClick={onClick}
    >
      {/* Line 1: name */}
      <p className="font-semibold truncate leading-tight">{contact.name}</p>

      {/* Line 2: phone */}
      <p className="text-muted-foreground mt-1 text-xs">
        <PhoneDisplay phone={contact.phone} />
      </p>

      {/* Line 3: project badge */}
      {contact.project && (
        <div className="mt-1.5">
          <Badge
            variant="secondary"
            className="text-xs h-4 px-1.5 font-normal max-w-full truncate"
          >
            {contact.project.name}
          </Badge>
        </div>
      )}

      {/* Line 4: last contact */}
      <p className="text-muted-foreground text-xs mt-1.5">{lastContactText}</p>
    </div>
  )
}
