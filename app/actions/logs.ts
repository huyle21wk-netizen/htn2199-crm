'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { LogChannel, LogOutcome } from '@/lib/types'

export interface CreateLogInput {
  contact_id: string
  scheduled_for: string
  channel: LogChannel
  status: 'done' | 'planned'
  outcome?: LogOutcome | null
  notes?: string | null
  // Optional follow-up
  followUp?: {
    scheduled_for: string
    notes?: string | null
  } | null
}

export interface CreateLogResult {
  error?: string
  stageChanged?: {
    from: string
    fromName: string
    to: string
    toName: string
  }
  showNoAnswerDialog?: boolean
  showUndoCancel?: boolean
}

export async function createLog(input: CreateLogInput): Promise<CreateLogResult> {
  const supabase = await createClient()

  // 1. Insert main log
  const { error: logError } = await supabase.from('contact_logs').insert({
    contact_id: input.contact_id,
    scheduled_for: input.scheduled_for,
    channel: input.channel,
    status: input.status,
    outcome: input.status === 'done' ? input.outcome : null,
    notes: input.notes || null,
  })

  if (logError) return { error: logError.message }

  // 2. Insert follow-up if provided
  if (input.followUp && input.status === 'done') {
    const { error: fuError } = await supabase.from('contact_logs').insert({
      contact_id: input.contact_id,
      scheduled_for: input.followUp.scheduled_for,
      channel: 'call',
      status: 'planned',
      outcome: null,
      notes: input.followUp.notes || null,
    })
    if (fuError) return { error: fuError.message }
  }

  // 3. Apply automation if status='done'
  if (input.status !== 'done' || !input.outcome) {
    revalidatePath('/contacts')
    return {}
  }

  // Fetch contact with current stage
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, stage_id, stages(*)')
    .eq('id', input.contact_id)
    .single()

  if (!contact) return { error: 'Không tìm thấy liên hệ.' }

  const currentStage = contact.stages as unknown as {
    id: string; name: string; is_raw: boolean; is_bad_number: boolean;
    is_terminal: boolean; is_system: boolean
  }

  const moveContact = async (targetStageId: string) => {
    await supabase
      .from('contacts')
      .update({ stage_id: targetStageId })
      .eq('id', input.contact_id)
    revalidatePath('/contacts')
  }

  const result: CreateLogResult = {}

  switch (input.outcome) {
    case 'interested':
    case 'follow_up': {
      if (currentStage.is_raw) {
        const { data: qtStage } = await supabase
          .from('stages')
          .select('id, name')
          .eq('name', 'Quan tâm')
          .single()
        if (qtStage) {
          await moveContact(qtStage.id)
          result.stageChanged = {
            from: currentStage.id,
            fromName: currentStage.name,
            to: qtStage.id,
            toName: qtStage.name,
          }
        }
      }
      break
    }

    case 'not_interested': {
      if (!currentStage.is_bad_number) {
        // Check the most recent PREVIOUS done log
        const { data: prevLogs } = await supabase
          .from('contact_logs')
          .select('outcome, created_at')
          .eq('contact_id', input.contact_id)
          .eq('status', 'done')
          .order('created_at', { ascending: false })
          .limit(2)

        // prevLogs[0] is the one we just created, prevLogs[1] is the previous
        const prevOutcome = prevLogs && prevLogs.length >= 2 ? prevLogs[1].outcome : null

        if (prevOutcome === 'not_interested') {
          // Two consecutive not_interested → move to Huỷ
          const { data: huyStage } = await supabase
            .from('stages')
            .select('id, name')
            .eq('name', 'Huỷ')
            .single()

          if (huyStage && !currentStage.is_terminal) {
            await moveContact(huyStage.id)
            result.stageChanged = {
              from: currentStage.id,
              fromName: currentStage.name,
              to: huyStage.id,
              toName: huyStage.name,
            }
            result.showUndoCancel = true
          }
        }
        // If not 2 consecutive → soft flag only (handled on frontend via log query)
      }
      break
    }

    case 'bad_number': {
      const { data: soRacStage } = await supabase
        .from('stages')
        .select('id, name')
        .eq('is_bad_number', true)
        .single()

      if (soRacStage) {
        await moveContact(soRacStage.id)
        result.stageChanged = {
          from: currentStage.id,
          fromName: currentStage.name,
          to: soRacStage.id,
          toName: soRacStage.name,
        }
      }
      break
    }

    case 'deposited': {
      if (!currentStage.is_terminal) {
        const { data: cotCocStage } = await supabase
          .from('stages')
          .select('id, name')
          .eq('name', 'Chốt cọc')
          .single()

        if (cotCocStage) {
          await moveContact(cotCocStage.id)
          result.stageChanged = {
            from: currentStage.id,
            fromName: currentStage.name,
            to: cotCocStage.id,
            toName: cotCocStage.name,
          }
        }
      }
      break
    }

    case 'closed': {
      if (!currentStage.is_terminal) {
        const { data: thanhCongStage } = await supabase
          .from('stages')
          .select('id, name')
          .eq('name', 'Thành công')
          .single()

        if (thanhCongStage) {
          await moveContact(thanhCongStage.id)
          result.stageChanged = {
            from: currentStage.id,
            fromName: currentStage.name,
            to: thanhCongStage.id,
            toName: thanhCongStage.name,
          }
        }
      }
      break
    }

    case 'no_answer': {
      // Check last 3 consecutive done logs
      const { data: recentLogs } = await supabase
        .from('contact_logs')
        .select('outcome')
        .eq('contact_id', input.contact_id)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(3)

      if (
        recentLogs &&
        recentLogs.length >= 3 &&
        recentLogs.every((l) => l.outcome === 'no_answer')
      ) {
        result.showNoAnswerDialog = true
      }
      break
    }
  }

  revalidatePath('/contacts')
  return result
}

export async function moveContactToSoRac(contactId: string) {
  const supabase = await createClient()

  const { data: soRacStage } = await supabase
    .from('stages')
    .select('id')
    .eq('is_bad_number', true)
    .single()

  if (!soRacStage) return { error: 'Không tìm thấy giai đoạn Số rác.' }

  const { error } = await supabase
    .from('contacts')
    .update({ stage_id: soRacStage.id })
    .eq('id', contactId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  return { success: true }
}

export async function revertContactStage(contactId: string, stageId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('contacts')
    .update({ stage_id: stageId })
    .eq('id', contactId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  return { success: true }
}

export interface MarkLogAsDoneInput {
  logId: string
  contact_id: string
  outcome: LogOutcome
  notes?: string | null
  scheduled_for?: string | null
  followUp?: {
    scheduled_for: string
    notes?: string | null
  } | null
}

export async function markLogAsDone(input: MarkLogAsDoneInput): Promise<CreateLogResult> {
  const supabase = await createClient()

  const scheduledFor = input.scheduled_for || new Date().toISOString()

  const { error: updateError } = await supabase
    .from('contact_logs')
    .update({
      status: 'done',
      outcome: input.outcome,
      notes: input.notes ?? null,
      scheduled_for: scheduledFor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.logId)

  if (updateError) return { error: updateError.message }

  if (input.followUp) {
    const { error: fuError } = await supabase.from('contact_logs').insert({
      contact_id: input.contact_id,
      scheduled_for: input.followUp.scheduled_for,
      channel: 'call',
      status: 'planned',
      outcome: null,
      notes: input.followUp.notes ?? null,
    })
    if (fuError) return { error: fuError.message }
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, stage_id, stages(*)')
    .eq('id', input.contact_id)
    .single()

  if (!contact) return { error: 'Không tìm thấy liên hệ.' }

  const currentStage = contact.stages as unknown as {
    id: string; name: string; is_raw: boolean; is_bad_number: boolean
    is_terminal: boolean; is_system: boolean
  }

  const moveContact = async (targetStageId: string) => {
    await supabase.from('contacts').update({ stage_id: targetStageId }).eq('id', input.contact_id)
  }

  const result: CreateLogResult = {}

  switch (input.outcome) {
    case 'interested':
    case 'follow_up': {
      if (currentStage.is_raw) {
        const { data: qtStage } = await supabase.from('stages').select('id, name').eq('name', 'Quan tâm').single()
        if (qtStage) {
          await moveContact(qtStage.id)
          result.stageChanged = { from: currentStage.id, fromName: currentStage.name, to: qtStage.id, toName: qtStage.name }
        }
      }
      break
    }
    case 'not_interested': {
      if (!currentStage.is_bad_number) {
        const { data: prevLogs } = await supabase
          .from('contact_logs')
          .select('outcome, created_at')
          .eq('contact_id', input.contact_id)
          .eq('status', 'done')
          .order('created_at', { ascending: false })
          .limit(2)
        const prevOutcome = prevLogs && prevLogs.length >= 2 ? prevLogs[1].outcome : null
        if (prevOutcome === 'not_interested' && !currentStage.is_terminal) {
          const { data: huyStage } = await supabase.from('stages').select('id, name').eq('name', 'Huỷ').single()
          if (huyStage) {
            await moveContact(huyStage.id)
            result.stageChanged = { from: currentStage.id, fromName: currentStage.name, to: huyStage.id, toName: huyStage.name }
            result.showUndoCancel = true
          }
        }
      }
      break
    }
    case 'bad_number': {
      const { data: soRacStage } = await supabase.from('stages').select('id, name').eq('is_bad_number', true).single()
      if (soRacStage) {
        await moveContact(soRacStage.id)
        result.stageChanged = { from: currentStage.id, fromName: currentStage.name, to: soRacStage.id, toName: soRacStage.name }
      }
      break
    }
    case 'deposited': {
      if (!currentStage.is_terminal) {
        const { data: cotCocStage } = await supabase.from('stages').select('id, name').eq('name', 'Chốt cọc').single()
        if (cotCocStage) {
          await moveContact(cotCocStage.id)
          result.stageChanged = { from: currentStage.id, fromName: currentStage.name, to: cotCocStage.id, toName: cotCocStage.name }
        }
      }
      break
    }
    case 'closed': {
      if (!currentStage.is_terminal) {
        const { data: thanhCongStage } = await supabase.from('stages').select('id, name').eq('name', 'Thành công').single()
        if (thanhCongStage) {
          await moveContact(thanhCongStage.id)
          result.stageChanged = { from: currentStage.id, fromName: currentStage.name, to: thanhCongStage.id, toName: thanhCongStage.name }
        }
      }
      break
    }
    case 'no_answer': {
      const { data: recentLogs } = await supabase
        .from('contact_logs')
        .select('outcome')
        .eq('contact_id', input.contact_id)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(3)
      if (recentLogs && recentLogs.length >= 3 && recentLogs.every((l) => l.outcome === 'no_answer')) {
        result.showNoAnswerDialog = true
      }
      break
    }
  }

  revalidatePath('/calendar')
  revalidatePath('/contacts')
  return result
}

export async function deleteLog(logId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('contact_logs').delete().eq('id', logId)
  if (error) return { error: error.message }
  revalidatePath('/calendar')
  revalidatePath('/contacts')
  return {}
}
