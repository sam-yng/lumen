-- M4 Storage bucket for uploaded library files and audio.
--
-- Object names are always scoped as:
--   <auth.uid()>/<generated-file-name>
--
-- The app creates object keys server-side after authenticating the request.
-- These policies keep direct Storage API access constrained to the same prefix.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-files', 'library-files', false, 52428800, null)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "library_files_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'library-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "library_files_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'library-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "library_files_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'library-files'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'library-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "library_files_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'library-files'
  and split_part(name, '/', 1) = auth.uid()::text
);
