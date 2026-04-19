import { createClient } from '@/lib/supabase/server'
import { CalendarClient } from './calendar-client'

export default async function CalendarPage() {
  const supabase = await createClient()

  const [{ data: stages }, { data: projects }] = await Promise.all([
    supabase.from('stages').select('*').order('position'),
    supabase.from('projects').select('*').order('name'),
  ])

  return (
    <CalendarClient
      stages={stages ?? []}
      projects={projects ?? []}
    />
  )
}
