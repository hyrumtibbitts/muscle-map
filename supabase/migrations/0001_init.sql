-- Muscle Map: Phase 1 schema
-- Run in the Supabase SQL editor, or with `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type public.muscle_role as enum ('primary', 'secondary');
create type public.muscle_status_source as enum ('auto', 'manual', 'carry_forward');

-- ---------- Reference data ----------
create table public.muscles (
  id            text primary key,                     -- e.g. 'pec_upper'
  name          text not null,
  muscle_group  text not null,                        -- chest | back | shoulders | arms | core | legs | neck
  body_view     text not null check (body_view in ('front', 'back', 'both')),
  bilateral     boolean not null default true,
  external_ids  jsonb not null default '{}'::jsonb     -- e.g. {"biodigital": ["..."]}
);

create table public.exercises (
  id            text primary key,                     -- slug, e.g. 'back-squat'
  name          text not null,
  category      text not null check (category in ('compound', 'isolation')),
  pattern       text not null,                        -- squat | hinge | horizontal_push | ...
  equipment     text not null,
  aliases       text[] not null default '{}',
  is_global     boolean not null default true,        -- true = seeded; false = user-created
  owner_id      uuid references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  check (is_global = (owner_id is null))
);

create table public.exercise_muscles (
  exercise_id   text not null references public.exercises (id) on delete cascade,
  muscle_id     text not null references public.muscles (id) on delete restrict,
  role          public.muscle_role not null,
  primary key (exercise_id, muscle_id)
);

create index exercise_muscles_muscle_idx on public.exercise_muscles (muscle_id);

-- ---------- User data ----------
create table public.workout_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  logged_on     date not null default current_date,
  title         text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index workout_logs_user_date_idx on public.workout_logs (user_id, logged_on desc);

create table public.workout_sets (
  id              uuid primary key default gen_random_uuid(),
  workout_log_id  uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id     text not null references public.exercises (id) on delete restrict,
  set_index       smallint not null check (set_index >= 1),
  reps            smallint check (reps >= 0),
  weight_kg       numeric(6, 2) check (weight_kg >= 0),
  rpe             numeric(3, 1) check (rpe between 1 and 10),
  is_warmup       boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (workout_log_id, exercise_id, set_index)
);

create index workout_sets_log_idx on public.workout_sets (workout_log_id);

create table public.daily_muscle_status (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  muscle_id               text not null references public.muscles (id) on delete restrict,
  status_date             date not null default current_date,
  trained                 boolean not null default false,
  working_sets            smallint not null default 0 check (working_sets >= 0),
  mind_muscle_connection  smallint check (mind_muscle_connection between 1 and 5),
  soreness                smallint check (soreness between 0 and 5),
  tightness               smallint check (tightness between 0 and 5),
  note                    text,
  source                  public.muscle_status_source not null default 'manual',
  last_trained_on         date,
  updated_at              timestamptz not null default now(),
  unique (user_id, muscle_id, status_date)
);

create index daily_muscle_status_lookup_idx
  on public.daily_muscle_status (user_id, muscle_id, status_date desc);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger workout_logs_updated_at
  before update on public.workout_logs
  for each row execute function public.set_updated_at();

create trigger daily_muscle_status_updated_at
  before update on public.daily_muscle_status
  for each row execute function public.set_updated_at();

-- ---------- Carry-forward read model ----------
-- Muscles not trained keep their last known state.
-- For each muscle, return the newest status row on or before p_date.
create or replace function public.muscle_status_on(
  p_date date default current_date,
  p_user uuid default auth.uid()
)
returns table (
  muscle_id               text,
  name                    text,
  muscle_group            text,
  body_view               text,
  status_date             date,
  days_since_status       integer,
  trained_on_date         boolean,
  working_sets            smallint,
  mind_muscle_connection  smallint,
  soreness                smallint,
  tightness               smallint,
  note                    text,
  source                  public.muscle_status_source,
  last_trained_on         date
)
language sql stable security invoker as $$
  select distinct on (m.id)
    m.id,
    m.name,
    m.muscle_group,
    m.body_view,
    s.status_date,
    (p_date - s.status_date)::integer,
    coalesce(s.trained and s.status_date = p_date, false),
    s.working_sets,
    s.mind_muscle_connection,
    s.soreness,
    s.tightness,
    s.note,
    s.source,
    s.last_trained_on
  from public.muscles m
  left join public.daily_muscle_status s
    on s.muscle_id = m.id
   and s.user_id = p_user
   and s.status_date <= p_date
  order by m.id, s.status_date desc nulls last
$$;

-- ---------- Row Level Security ----------
alter table public.muscles             enable row level security;
alter table public.exercises           enable row level security;
alter table public.exercise_muscles    enable row level security;
alter table public.workout_logs        enable row level security;
alter table public.workout_sets        enable row level security;
alter table public.daily_muscle_status enable row level security;

create policy "muscles readable by all authenticated"
  on public.muscles for select to authenticated using (true);

create policy "exercises: read global or own"
  on public.exercises for select to authenticated
  using (is_global or owner_id = auth.uid());

create policy "exercises: insert own"
  on public.exercises for insert to authenticated
  with check (owner_id = auth.uid() and is_global = false);

create policy "exercises: update own"
  on public.exercises for update to authenticated
  using (owner_id = auth.uid());

create policy "exercises: delete own"
  on public.exercises for delete to authenticated
  using (owner_id = auth.uid());

create policy "exercise_muscles: read if exercise visible"
  on public.exercise_muscles for select to authenticated
  using (exists (
    select 1 from public.exercises e
    where e.id = exercise_id and (e.is_global or e.owner_id = auth.uid())
  ));

create policy "exercise_muscles: write for own exercises"
  on public.exercise_muscles for all to authenticated
  using (exists (
    select 1 from public.exercises e
    where e.id = exercise_id and e.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.exercises e
    where e.id = exercise_id and e.owner_id = auth.uid()
  ));

create policy "workout_logs: own rows"
  on public.workout_logs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "workout_sets: via own log"
  on public.workout_sets for all to authenticated
  using (exists (
    select 1 from public.workout_logs l
    where l.id = workout_log_id and l.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_logs l
    where l.id = workout_log_id and l.user_id = auth.uid()
  ));

create policy "daily_muscle_status: own rows"
  on public.daily_muscle_status for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
