import { createClient } from '@/lib/supabase/server'
import { ReportClient } from './report-client'

export default async function ReportPage() {
  const supabase = await createClient()

  const [{ data: stages }, { data: projects }] = await Promise.all([
    supabase.from('stages').select('*').order('position'),
    supabase.from('projects').select('*').order('name'),
  ])

  return (
    <ReportClient
      stages={stages ?? []}
      projects={projects ?? []}
    />
  )
}
