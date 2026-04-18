'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validatePhone } from '@/lib/phone'

export async function createContact(data: {
  name: string
  phone: string
  project_id?: string | null
  source?: string | null
  note?: string | null
}) {
  const supabase = await createClient()

  const phoneResult = validatePhone(data.phone)
  if (!phoneResult.valid) {
    return { error: phoneResult.error }
  }

  // Get the raw stage
  const { data: rawStage } = await supabase
    .from('stages')
    .select('id')
    .eq('is_raw', true)
    .single()

  if (!rawStage) {
    return { error: 'Không tìm thấy giai đoạn Raw.' }
  }

  const { error } = await supabase.from('contacts').insert({
    name: data.name.trim(),
    phone: phoneResult.formatted,
    project_id: data.project_id || null,
    source: data.source?.trim() || null,
    note: data.note?.trim() || null,
    stage_id: rawStage.id,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Số điện thoại này đã tồn tại trong hệ thống.' }
    }
    return { error: error.message }
  }

  revalidatePath('/contacts')
  return { success: true }
}

export async function updateContact(
  id: string,
  data: {
    name: string
    phone: string
    project_id?: string | null
    source?: string | null
    note?: string | null
  }
) {
  const supabase = await createClient()

  const phoneResult = validatePhone(data.phone)
  if (!phoneResult.valid) {
    return { error: phoneResult.error }
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      name: data.name.trim(),
      phone: phoneResult.formatted,
      project_id: data.project_id || null,
      source: data.source?.trim() || null,
      note: data.note?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Số điện thoại này đã tồn tại trong hệ thống.' }
    }
    return { error: error.message }
  }

  revalidatePath('/contacts')
  return { success: true }
}

export async function deleteContact(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('contacts').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/contacts')
  return { success: true }
}

export async function checkPhoneDuplicate(phone: string, excludeId?: string) {
  const supabase = await createClient()

  const phoneResult = validatePhone(phone)
  if (!phoneResult.valid) return null

  let query = supabase
    .from('contacts')
    .select('id, name')
    .eq('phone', phoneResult.formatted)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data } = await query.single()
  return data || null
}

export async function getExistingSources() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contacts')
    .select('source')
    .not('source', 'is', null)
    .order('source')

  if (!data) return []
  const sources = [...new Set(data.map((c) => c.source).filter(Boolean))] as string[]
  return sources
}

export async function importContacts(
  rows: Array<{
    name: string
    phone: string
    project_id?: string | null
    source?: string | null
    note?: string | null
  }>
) {
  const supabase = await createClient()

  const { data: rawStage } = await supabase
    .from('stages')
    .select('id')
    .eq('is_raw', true)
    .single()

  if (!rawStage) {
    return { error: 'Không tìm thấy giai đoạn Raw.' }
  }

  const toInsert = rows.map((r) => ({
    name: r.name.trim(),
    phone: r.phone,
    project_id: r.project_id || null,
    source: r.source?.trim() || null,
    note: r.note?.trim() || null,
    stage_id: rawStage.id,
  }))

  const { error, count } = await supabase
    .from('contacts')
    .insert(toInsert, { count: 'exact' })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/contacts')
  return { success: true, count: count ?? rows.length }
}
