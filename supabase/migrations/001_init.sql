-- ============================================================
-- Personal CRM — Initial Migration
-- Run this file once in the Supabase SQL Editor
-- ============================================================

-- Drop types if they already exist (safe re-run)
drop type if exists log_channel cascade;
drop type if exists log_status cascade;
drop type if exists log_outcome cascade;

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type log_channel as enum ('call','zalo','sms','meeting','email');
create type log_status as enum ('planned','done');
create type log_outcome as enum (
  'no_answer','bad_number','interested','not_interested',
  'follow_up','deposited','closed'
);

-- ============================================================
-- TABLES
-- ============================================================

-- projects: Dự án bất động sản
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  note text,
  created_at timestamptz not null default now()
);

-- stages: Các giai đoạn trong Kanban
create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null,
  color text,
  is_raw boolean not null default false,
  is_bad_number boolean not null default false,
  is_terminal boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- contacts: Liên hệ khách hàng
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  project_id uuid references projects(id) on delete set null,
  source text,
  note text,
  stage_id uuid not null references stages(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- contact_logs: Lịch sử liên hệ
create table if not exists contact_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  scheduled_for timestamptz not null,
  channel log_channel not null,
  status log_status not null default 'done',
  outcome log_outcome,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_contacts_stage on contacts(stage_id);
create index if not exists idx_contacts_project on contacts(project_id);
create index if not exists idx_contacts_phone on contacts(phone);
create index if not exists idx_logs_contact on contact_logs(contact_id);
create index if not exists idx_logs_scheduled on contact_logs(scheduled_for);
create index if not exists idx_logs_status on contact_logs(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table projects enable row level security;
alter table stages enable row level security;
alter table contacts enable row level security;
alter table contact_logs enable row level security;

-- Drop existing policies to allow re-run
drop policy if exists "authenticated can do all on projects" on projects;
drop policy if exists "authenticated can do all on stages" on stages;
drop policy if exists "authenticated can do all on contacts" on contacts;
drop policy if exists "authenticated can do all on contact_logs" on contact_logs;

create policy "authenticated can do all on projects" on projects
  for all to authenticated using (true) with check (true);

create policy "authenticated can do all on stages" on stages
  for all to authenticated using (true) with check (true);

create policy "authenticated can do all on contacts" on contacts
  for all to authenticated using (true) with check (true);

create policy "authenticated can do all on contact_logs" on contact_logs
  for all to authenticated using (true) with check (true);

-- ============================================================
-- SEED DATA
-- ============================================================

insert into stages (name, position, color, is_raw, is_bad_number, is_terminal, is_system)
select * from (values
  ('Raw',           0,  null,      true,  false, false, true),
  ('Quan tâm',      1,  '#7C3AED', false, false, false, false),
  ('Đang tư vấn',   2,  '#6366F1', false, false, false, false),
  ('Đã xem',        3,  '#3B82F6', false, false, false, false),
  ('Thương lượng',  4,  '#F59E0B', false, false, false, false),
  ('Chốt cọc',      5,  '#10B981', false, false, false, false),
  ('Thành công',    6,  '#059669', false, false, true,  false),
  ('Tạm hoãn',      7,  '#F59E0B', false, false, true,  false),
  ('Huỷ',           8,  '#EF4444', false, false, true,  false),
  ('Số rác',        99, '#6B7280', false, true,  false, true)
) as v(name, position, color, is_raw, is_bad_number, is_terminal, is_system)
where not exists (select 1 from stages limit 1);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at
  before update on contacts
  for each row execute function update_updated_at();

drop trigger if exists contact_logs_updated_at on contact_logs;
create trigger contact_logs_updated_at
  before update on contact_logs
  for each row execute function update_updated_at();
