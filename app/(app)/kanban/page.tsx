import { createClient } from '@/lib/supabase/server'
import { KanbanClient } from './kanban-client'

export default async function KanbanPage() {
  const supabase = await createClient()

  const { data: kanbanStages } = await supabase
    .from('stages')
    .select('*')
    .eq('is_raw', false)
    .eq('is_bad_number', false)
    .order('position')

  const stageIds = (kanbanStages ?? []).map((s) => s.id)

  const [{ data: contacts }, { data: projects }, { data: doneLogs }] =
    await Promise.all([
      stageIds.length > 0
        ? supabase
            .from('contacts')
            .select('*, stage:stages(*), project:projects(*)')
            .in('stage_id', stageIds)
            .order('created_at', { ascending: false })
        : { data: [] },
      supabase.from('projects').select('*').order('name'),
      supabase
        .from('contact_logs')
        .select('contact_id, scheduled_for')
        .eq('status', 'done')
        .order('scheduled_for', { ascending: false }),
    ])

  // Build map contactId -> latest done log date
  const lastContactMap: Record<string, string> = {}
  for (const log of doneLogs ?? []) {
    if (!lastContactMap[log.contact_id]) {
      lastContactMap[log.contact_id] = log.scheduled_for
    }
  }

  return (
    <KanbanClient
      stages={kanbanStages ?? []}
      contacts={contacts ?? []}
      projects={projects ?? []}
      lastContactMap={lastContactMap}
    />
  )
}
