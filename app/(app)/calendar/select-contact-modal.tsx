'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { ContactLogModal } from '@/app/(app)/contacts/contact-log-modal'
import type { Contact, Stage } from '@/lib/types'

function toDatetimeLocal(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

interface SelectContactModalProps {
  selectedDay: Date
  stages: Stage[]
  onClose: () => void
  onDone: () => void
}

export function SelectContactModal({ selectedDay, stages, onClose, onDone }: SelectContactModalProps) {
  const [search, setSearch] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length < 1) {
        setContacts([])
        return
      }
      setLoading(true)
      const q = search.trim()
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .order('name')
        .limit(20)
      setContacts(data ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  if (selectedContact) {
    const defaultScheduledFor = toDatetimeLocal(
      new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 9, 0)
    )
    return (
      <ContactLogModal
        contact={selectedContact}
        stages={stages}
        defaultScheduledFor={defaultScheduledFor}
        onClose={(saved) => {
          if (saved) onDone()
          else onClose()
        }}
      />
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chọn liên hệ</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Tìm theo tên hoặc số điện thoại…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-4">Đang tìm…</p>
          )}
          {!loading && search.trim().length > 0 && contacts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Không tìm thấy liên hệ.</p>
          )}
          {!loading && search.trim().length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nhập tên hoặc số điện thoại để tìm kiếm.</p>
          )}
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{contact.name}</p>
                <p className="text-xs text-muted-foreground">{contact.phone}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
