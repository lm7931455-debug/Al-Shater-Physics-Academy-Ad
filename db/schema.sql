create extension if not exists "pgcrypto";

create table if not exists settings (
  id integer primary key default 1,
  teacher_image_path text not null default '',
  marquee_text text not null default '',
  site_locked boolean not null default false,
  whatsapp_visible boolean not null default true,
  whatsapp_number text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists chapters (
  id text primary key,
  grade text not null,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists materials (
  id text primary key,
  chapter_id text not null references chapters(id) on delete cascade,
  title text not null,
  storage_path text not null,
  file_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exams (
  id text primary key,
  chapter_id text not null references chapters(id) on delete cascade,
  title text not null default '',
  question_text text not null default '',
  storage_path text not null,
  file_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  time_limit_minutes integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists students (
  id text primary key,
  full_name text not null,
  student_number text not null unique,
  mobile_number text not null default '',
  guardian_number text not null,
  school text not null,
  grade text not null default '',
  score numeric default 0,
  blocked boolean not null default false,
  last_exam_id text not null default '',
  last_exam_at timestamptz,
  last_ip text not null default '',
  last_user_agent text not null default '',
  last_device_type text not null default '',
  security_alert boolean not null default false,
  security_alert_reason text not null default '',
  security_alert_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('physicsstudio-media', 'physicsstudio-media', false)
on conflict (id) do nothing;

alter table settings enable row level security;
alter table chapters enable row level security;
alter table materials enable row level security;
alter table exams enable row level security;
alter table students enable row level security;

revoke all on table settings, chapters, materials, exams, students from anon, authenticated;
grant select, insert, update, delete on table settings, chapters, materials, exams, students to service_role;

drop policy if exists "deny public settings" on settings;
create policy "deny public settings"
on settings for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny public chapters" on chapters;
create policy "deny public chapters"
on chapters for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny public materials" on materials;
create policy "deny public materials"
on materials for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny public exams" on exams;
create policy "deny public exams"
on exams for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny public students" on students;
create policy "deny public students"
on students for all
to anon, authenticated
using (false)
with check (false);

revoke all on table storage.objects from anon, authenticated;
revoke all on table storage.buckets from anon, authenticated;
grant select, insert, update, delete on table storage.objects to service_role;
grant select, insert, update, delete on table storage.buckets to service_role;

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

drop policy if exists "deny public storage objects" on storage.objects;
create policy "deny public storage objects"
on storage.objects for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny public storage buckets" on storage.buckets;
create policy "deny public storage buckets"
on storage.buckets for all
to anon, authenticated
using (false)
with check (false);
