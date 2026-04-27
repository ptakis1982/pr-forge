-- PR Forge workout planning migration
-- Run this after supabase-schema.sql.

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  date date not null default current_date,
  base_weight numeric(8, 2) not null check (base_weight > 0),
  unit text not null check (unit in ('kg', 'lb')),
  rounding numeric(5, 2) not null default 2.5,
  visibility public.visibility_option not null default 'friends',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_rounds (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  position integer not null check (position > 0),
  percentage numeric(5, 2) not null check (percentage > 0),
  reps integer check (reps > 0),
  target_weight numeric(8, 2) not null check (target_weight > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, date desc);

create index if not exists workout_rounds_workout_id_idx
  on public.workout_rounds (workout_id, position);

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

alter table public.workouts enable row level security;
alter table public.workout_rounds enable row level security;

drop policy if exists "workouts select by visibility" on public.workouts;
create policy "workouts select by visibility"
on public.workouts
for select
to authenticated
using (public.can_view_lift(auth.uid(), user_id, visibility));

drop policy if exists "workouts insert own" on public.workouts;
create policy "workouts insert own"
on public.workouts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "workouts update own" on public.workouts;
create policy "workouts update own"
on public.workouts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "workouts delete own" on public.workouts;
create policy "workouts delete own"
on public.workouts
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "workout rounds select by parent workout" on public.workout_rounds;
create policy "workout rounds select by parent workout"
on public.workout_rounds
for select
to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_rounds.workout_id
      and public.can_view_lift(auth.uid(), w.user_id, w.visibility)
  )
);

drop policy if exists "workout rounds insert own parent" on public.workout_rounds;
create policy "workout rounds insert own parent"
on public.workout_rounds
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_rounds.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "workout rounds update own parent" on public.workout_rounds;
create policy "workout rounds update own parent"
on public.workout_rounds
for update
to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_rounds.workout_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_rounds.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "workout rounds delete own parent" on public.workout_rounds;
create policy "workout rounds delete own parent"
on public.workout_rounds
for delete
to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_rounds.workout_id
      and w.user_id = auth.uid()
  )
);
