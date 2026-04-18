import { createClient } from '@/lib/supabase/server'
import { ContactsClient } from './contacts-client'

export default async function ContactsPage() {
  const supabase = await createClient()

  const [{ data: stages }, { data: projects }] = await Promise.all([
    supabase.from('stages').select('*').order('position'),
    supabase.from('projects').select('*').order('name'),
  ])

  return (
    <ContactsClient
      stages={stages ?? []}
      projects={projects ?? []}
    />
  )
}
