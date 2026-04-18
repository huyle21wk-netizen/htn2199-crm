import { createClient } from '@/lib/supabase/server'
import { StagesClient } from './stages-client'

export default async function StagesPage() {
  const supabase = await createClient()

  const [{ data: stages }, { data: contactCounts }] = await Promise.all([
    supabase.from('stages').select('*').order('position'),
    supabase
      .from('contacts')
      .select('stage_id')
      .then(({ data }) => {
        const map: Record<string, number> = {}
        for (const c of data ?? []) {
          map[c.stage_id] = (map[c.stage_id] ?? 0) + 1
        }
        return { data: map }
      }),
  ])

  return (
    <StagesClient
      initialStages={stages ?? []}
      contactCountMap={contactCounts ?? {}}
    />
  )
}
