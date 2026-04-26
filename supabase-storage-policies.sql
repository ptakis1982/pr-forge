-- Weightlifting PR Tracker MVP storage policies for Supabase
-- Run after creating the private storage bucket named: lift-videos

-- Expected object path format:
-- {user_id}/{lift_entry_id}/{filename}
--
-- The first folder must be the authenticated user's UUID.

drop policy if exists "lift videos owner uploads" on storage.objects;
create policy "lift videos owner uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lift-videos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "lift videos owner updates" on storage.objects;
create policy "lift videos owner updates"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lift-videos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'lift-videos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "lift videos owner deletes" on storage.objects;
create policy "lift videos owner deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lift-videos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "lift videos visible through lift privacy" on storage.objects;
create policy "lift videos visible through lift privacy"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lift-videos'
  and exists (
    select 1
    from public.videos v
    join public.lift_entries le on le.id = v.lift_entry_id
    where v.storage_bucket = 'lift-videos'
      and v.storage_object_key = storage.objects.name
      and public.can_view_lift(auth.uid(), le.user_id, le.visibility)
  )
);

