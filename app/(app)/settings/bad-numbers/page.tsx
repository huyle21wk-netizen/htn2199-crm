import { createClient } from '@/lib/supabase/server'
import { BadNumbersClient } from './bad-numbers-client'

export default async function BadNumbersPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  const { data: badStage } = await supabase
    .from('stages')
    .select('id')
    .eq('is_bad_number', true)
    .single()

  return (
    <BadNumbersClient
      initialBadStageId={badStage?.id ?? null}
      projects={projects ?? []}
    />
  )
}
