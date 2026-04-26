-- Weightlifting PR Tracker MVP schema for Supabase
-- Run this in Supabase SQL Editor after your project is ready.

create extension if not exists "pgcrypto";

create type public.sex_option as enum (
  'female',
  'male',
  'non_binary',
  'prefer_not_to_say',
  'self_describe'
);

create type public.visibility_option as enum (
  'private',
  'friends',
  'public'
);

create type public.friendship_status as enum (
  'pending',
  'accepted',
  'rejected'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null,
  surname text,
  nickname text,
  profile_photo_url text,
  sex public.sex_option not null default 'prefer_not_to_say',
  sex_self_description text,
  birthday date,
  bodyweight numeric(7, 2) not null,
  preferred_unit text not null default 'kg' check (preferred_unit in ('kg', 'lb')),
  country text not null,
  club text,
  privacy_setting public.visibility_option not null default 'friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  lift_type text,
  description text,
  is_global boolean not null default false,
  owner_user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint exercises_global_or_owner check (
    (is_global = true and owner_user_id is null)
    or
    (is_global = false and owner_user_id is not null)
  )
);

create unique index if not exists exercises_global_slug_unique
  on public.exercises (slug)
  where is_global = true;

create index if not exists exercises_owner_user_id_idx
  on public.exercises (owner_user_id);

create table if not exists public.lift_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  date date not null,
  weight numeric(8, 2) not null check (weight > 0),
  unit text not null check (unit in ('kg', 'lb')),
  normalized_weight_kg numeric(8, 2) not null check (normalized_weight_kg > 0),
  reps integer not null check (reps > 0),
  percentage_of_max numeric(5, 2),
  estimated_1rm_kg numeric(8, 2),
  notes text,
  location text,
  bodyweight numeric(7, 2),
  bodyweight_unit text check (bodyweight_unit in ('kg', 'lb')),
  straps_used boolean not null default false,
  is_pr boolean not null default false,
  visibility public.visibility_option not null default 'friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lift_entries_user_date_idx
  on public.lift_entries (user_id, date desc);

create index if not exists lift_entries_exercise_idx
  on public.lift_entries (exercise_id);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  lift_entry_id uuid not null unique references public.lift_entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_provider text not null default 'supabase_storage',
  storage_bucket text not null default 'lift-videos',
  storage_object_key text not null,
  video_url text,
  thumbnail_url text,
  mime_type text not null,
  file_size_bytes bigint,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists videos_user_id_idx
  on public.videos (user_id);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> recipient_id)
);

create unique index if not exists friendships_unique_pair
  on public.friendships (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id)
  );

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  lift_entry_id uuid not null references public.lift_entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_lift_entry_id_idx
  on public.comments (lift_entry_id, created_at);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  lift_entry_id uuid not null references public.lift_entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lift_entry_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type text not null,
  lift_entry_id uuid references public.lift_entries(id) on delete cascade,
  friendship_id uuid references public.friendships(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists lift_entries_set_updated_at on public.lift_entries;
create trigger lift_entries_set_updated_at
before update on public.lift_entries
for each row execute function public.set_updated_at();

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (requester_id = user_a and recipient_id = user_b)
        or
        (requester_id = user_b and recipient_id = user_a)
      )
  );
$$;

create or replace function public.can_view_lift(viewer_id uuid, owner_id uuid, lift_visibility public.visibility_option)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lift_visibility = 'public'
    or viewer_id = owner_id
    or (lift_visibility = 'friends' and public.are_friends(viewer_id, owner_id));
$$;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.lift_entries enable row level security;
alter table public.videos enable row level security;
alter table public.friendships enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles visible to owner and friends/public" on public.profiles;
create policy "profiles visible to owner and friends/public"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or privacy_setting = 'public'
  or public.are_friends(auth.uid(), id)
);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "exercises select global or own" on public.exercises;
create policy "exercises select global or own"
on public.exercises
for select
to authenticated
using (is_global = true or owner_user_id = auth.uid());

drop policy if exists "exercises insert own custom" on public.exercises;
create policy "exercises insert own custom"
on public.exercises
for insert
to authenticated
with check (is_global = false and owner_user_id = auth.uid());

drop policy if exists "exercises update own custom" on public.exercises;
create policy "exercises update own custom"
on public.exercises
for update
to authenticated
using (is_global = false and owner_user_id = auth.uid())
with check (is_global = false and owner_user_id = auth.uid());

drop policy if exists "exercises delete own custom" on public.exercises;
create policy "exercises delete own custom"
on public.exercises
for delete
to authenticated
using (is_global = false and owner_user_id = auth.uid());

drop policy if exists "lift entries select by visibility" on public.lift_entries;
create policy "lift entries select by visibility"
on public.lift_entries
for select
to authenticated
using (public.can_view_lift(auth.uid(), user_id, visibility));

drop policy if exists "lift entries insert own" on public.lift_entries;
create policy "lift entries insert own"
on public.lift_entries
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "lift entries update own" on public.lift_entries;
create policy "lift entries update own"
on public.lift_entries
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "lift entries delete own" on public.lift_entries;
create policy "lift entries delete own"
on public.lift_entries
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "videos select by parent lift visibility" on public.videos;
create policy "videos select by parent lift visibility"
on public.videos
for select
to authenticated
using (
  exists (
    select 1
    from public.lift_entries le
    where le.id = videos.lift_entry_id
      and public.can_view_lift(auth.uid(), le.user_id, le.visibility)
  )
);

drop policy if exists "videos insert own" on public.videos;
create policy "videos insert own"
on public.videos
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "videos update own" on public.videos;
create policy "videos update own"
on public.videos
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "videos delete own" on public.videos;
create policy "videos delete own"
on public.videos
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "friendships select involved" on public.friendships;
create policy "friendships select involved"
on public.friendships
for select
to authenticated
using (requester_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "friendships insert requester" on public.friendships;
create policy "friendships insert requester"
on public.friendships
for insert
to authenticated
with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists "friendships update involved" on public.friendships;
create policy "friendships update involved"
on public.friendships
for update
to authenticated
using (requester_id = auth.uid() or recipient_id = auth.uid())
with check (requester_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "comments select visible lifts" on public.comments;
create policy "comments select visible lifts"
on public.comments
for select
to authenticated
using (
  exists (
    select 1
    from public.lift_entries le
    where le.id = comments.lift_entry_id
      and public.can_view_lift(auth.uid(), le.user_id, le.visibility)
  )
);

drop policy if exists "comments insert visible lifts" on public.comments;
create policy "comments insert visible lifts"
on public.comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lift_entries le
    where le.id = comments.lift_entry_id
      and public.can_view_lift(auth.uid(), le.user_id, le.visibility)
  )
);

drop policy if exists "comments update own" on public.comments;
create policy "comments update own"
on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "comments delete own" on public.comments;
create policy "comments delete own"
on public.comments
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "likes select visible lifts" on public.likes;
create policy "likes select visible lifts"
on public.likes
for select
to authenticated
using (
  exists (
    select 1
    from public.lift_entries le
    where le.id = likes.lift_entry_id
      and public.can_view_lift(auth.uid(), le.user_id, le.visibility)
  )
);

drop policy if exists "likes insert visible lifts" on public.likes;
create policy "likes insert visible lifts"
on public.likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lift_entries le
    where le.id = likes.lift_entry_id
      and public.can_view_lift(auth.uid(), le.user_id, le.visibility)
  )
);

drop policy if exists "likes delete own" on public.likes;
create policy "likes delete own"
on public.likes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.exercises (name, slug, lift_type, description, is_global)
values
  ('Snatch', 'snatch', 'olympic', 'Predefined Olympic weightlifting movement.', true),
  ('Power snatch', 'power_snatch', 'olympic', 'Predefined Olympic weightlifting movement.', true),
  ('Hang snatch', 'hang_snatch', 'olympic', 'Predefined Olympic weightlifting movement.', true),
  ('Clean', 'clean', 'olympic', 'Predefined Olympic weightlifting movement.', true),
  ('Power clean', 'power_clean', 'olympic', 'Predefined Olympic weightlifting movement.', true),
  ('Hang clean', 'hang_clean', 'olympic', 'Predefined Olympic weightlifting movement.', true),
  ('Clean and jerk', 'clean_and_jerk', 'olympic', 'Predefined Olympic weightlifting movement.', true),
  ('Jerk', 'jerk', 'overhead', 'Predefined Olympic weightlifting movement.', true),
  ('Split jerk', 'split_jerk', 'overhead', 'Predefined Olympic weightlifting movement.', true),
  ('Push press', 'push_press', 'overhead', 'Predefined strength movement.', true),
  ('Front squat', 'front_squat', 'squat', 'Predefined strength movement.', true),
  ('Back squat', 'back_squat', 'squat', 'Predefined strength movement.', true),
  ('Deadlift', 'deadlift', 'pull', 'Predefined strength movement.', true),
  ('Bench press', 'bench_press', 'press', 'Predefined strength movement.', true),
  ('Overhead squat', 'overhead_squat', 'squat', 'Predefined strength movement.', true)
on conflict do nothing;
