import { createClient } from '@/lib/supabase/server'
import { ImportWizard } from './import-wizard'

export default async function ImportPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  return <ImportWizard initialProjects={projects ?? []} />
}
