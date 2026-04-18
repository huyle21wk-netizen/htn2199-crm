'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createStage(data: {
  name: string
  color: string
  is_terminal: boolean
}) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('stages')
    .select('position')
    .eq('is_system', false)
    .order('position', { ascending: false })
    .limit(1)

  const maxPos = existing?.[0]?.position ?? 0

  const { error } = await supabase.from('stages').insert({
    name: data.name.trim(),
    color: data.color,
    is_terminal: data.is_terminal,
    position: maxPos + 1,
    is_raw: false,
    is_bad_number: false,
    is_system: false,
  })

  if (error) return { error: error.message }

  revalidatePath('/kanban')
  revalidatePath('/settings/stages')
  return { success: true }
}

export async function updateStage(
  id: string,
  data: { name?: string; color?: string; is_terminal?: boolean }
) {
  const supabase = await createClient()

  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch.name = data.name.trim()
  if (data.color !== undefined) patch.color = data.color
  if (data.is_terminal !== undefined) patch.is_terminal = data.is_terminal

  const { error } = await supabase
    .from('stages')
    .update(patch)
    .eq('id', id)
    .eq('is_system', false)

  if (error) return { error: error.message }

  revalidatePath('/kanban')
  revalidatePath('/settings/stages')
  return { success: true }
}

export async function deleteStage(id: string, migrateToId: string) {
  const supabase = await createClient()

  const { error: migrateErr } = await supabase
    .from('contacts')
    .update({ stage_id: migrateToId })
    .eq('stage_id', id)

  if (migrateErr) return { error: migrateErr.message }

  const { error } = await supabase
    .from('stages')
    .delete()
    .eq('id', id)
    .eq('is_system', false)

  if (error) return { error: error.message }

  revalidatePath('/kanban')
  revalidatePath('/settings/stages')
  return { success: true }
}

export async function reorderStages(orderedIds: string[]) {
  const supabase = await createClient()

  const updates = orderedIds.map((id, index) =>
    supabase
      .from('stages')
      .update({ position: index + 1 })
      .eq('id', id)
      .eq('is_system', false)
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/kanban')
  revalidatePath('/settings/stages')
  return { success: true }
}
