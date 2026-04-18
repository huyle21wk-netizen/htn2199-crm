'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createProject(data: { name: string; note?: string | null }) {
  const supabase = await createClient()

  const { error, data: project } = await supabase
    .from('projects')
    .insert({ name: data.name.trim(), note: data.note?.trim() || null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Tên dự án đã tồn tại.' }
    }
    return { error: error.message }
  }

  revalidatePath('/settings/projects')
  revalidatePath('/contacts')
  return { success: true, project }
}

export async function updateProject(id: string, data: { name: string; note?: string | null }) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('projects')
    .update({ name: data.name.trim(), note: data.note?.trim() || null })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Tên dự án đã tồn tại.' }
    }
    return { error: error.message }
  }

  revalidatePath('/settings/projects')
  revalidatePath('/contacts')
  return { success: true }
}

export async function deleteProject(id: string, mergeIntoId?: string | null) {
  const supabase = await createClient()

  if (mergeIntoId) {
    // Move contacts to target project before deletion
    const { error: moveError } = await supabase
      .from('contacts')
      .update({ project_id: mergeIntoId })
      .eq('project_id', id)

    if (moveError) return { error: moveError.message }
  }

  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/settings/projects')
  revalidatePath('/contacts')
  return { success: true }
}
