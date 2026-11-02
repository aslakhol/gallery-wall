-- A plan is one person's planning session: their photos and everything they decide.
create table if not exists plans (
  id text primary key,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Written only by the server as each photo is processed, so it never races the plan's autosave.
create table if not exists photos (
  id text primary key,
  plan_id text not null references plans (id) on delete cascade,
  url text not null,
  width integer not null,
  height integer not null,
  analysis jsonb,
  clean_url text,
  failed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists photos_plan_id_created_at on photos (plan_id, created_at);

-- Deleting a plan removes its photos and state but keeps the row for accounting.
alter table plans add column if not exists deleted_at timestamptz;
