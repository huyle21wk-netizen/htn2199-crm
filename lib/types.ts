export type LogChannel = 'call' | 'zalo' | 'sms' | 'meeting' | 'email'
export type LogStatus = 'planned' | 'done'
export type LogOutcome =
  | 'no_answer'
  | 'bad_number'
  | 'interested'
  | 'not_interested'
  | 'follow_up'
  | 'deposited'
  | 'closed'

export interface Stage {
  id: string
  name: string
  position: number
  color: string | null
  is_raw: boolean
  is_bad_number: boolean
  is_terminal: boolean
  is_system: boolean
  created_at: string
}

export interface Project {
  id: string
  name: string
  note: string | null
  created_at: string
}

export interface Contact {
  id: string
  name: string
  phone: string
  project_id: string | null
  source: string | null
  note: string | null
  stage_id: string
  created_at: string
  updated_at: string
  stage?: Stage
  project?: Project
}

export interface ContactLog {
  id: string
  contact_id: string
  scheduled_for: string
  channel: LogChannel
  status: LogStatus
  outcome: LogOutcome | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const CHANNEL_LABELS: Record<LogChannel, string> = {
  call: 'Gọi điện',
  zalo: 'Zalo',
  sms: 'SMS',
  meeting: 'Gặp mặt',
  email: 'Email',
}

export const OUTCOME_LABELS: Record<LogOutcome, string> = {
  no_answer: 'Không bắt máy',
  bad_number: 'Sai số / thuê bao',
  interested: 'Có quan tâm',
  not_interested: 'Không quan tâm',
  follow_up: 'Cần follow-up tiếp',
  deposited: 'Đã chốt cọc',
  closed: 'Đã ký hợp đồng',
}
