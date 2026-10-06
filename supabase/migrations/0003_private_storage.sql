-- Conectado Flow — private file storage (Documents page: facturas, contratos, etc).
-- Files are stored under a path prefixed with the uploader's organization_id,
-- and only members of that organization can read or write them.
-- Run this after 0001_init.sql and 0002_multitenant.sql.

insert into storage.buckets (id, name, public) values ('private-files', 'private-files', false)
  on conflict (id) do nothing;

create policy "private_files_read" on storage.objects for select
  using (bucket_id = 'private-files' and (storage.foldername(name))[1] = public.current_org_id()::text);

create policy "private_files_insert" on storage.objects for insert
  with check (bucket_id = 'private-files' and (storage.foldername(name))[1] = public.current_org_id()::text);

create policy "private_files_delete" on storage.objects for delete
  using (bucket_id = 'private-files' and (storage.foldername(name))[1] = public.current_org_id()::text);
