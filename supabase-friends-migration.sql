-- PR Forge friends/search migration
-- Run this after supabase-schema.sql.

alter table public.profiles
add column if not exists search_enabled boolean not null default true;

drop policy if exists "profiles discoverable search" on public.profiles;
create policy "profiles discoverable search"
on public.profiles
for select
to authenticated
using (
  search_enabled = true
  or id = auth.uid()
  or privacy_setting = 'public'
  or public.are_friends(auth.uid(), id)
);

drop policy if exists "friendships update recipient decision" on public.friendships;
create policy "friendships update recipient decision"
on public.friendships
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

