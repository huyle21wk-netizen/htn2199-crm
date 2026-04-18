import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from './projects-client'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*, contacts:contacts(count)')
    .order('name')

  return <ProjectsClient initialProjects={projects ?? []} />
}
