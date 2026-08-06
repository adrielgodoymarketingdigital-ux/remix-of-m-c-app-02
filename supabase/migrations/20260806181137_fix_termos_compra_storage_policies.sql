-- Bucket termos-compra ficou sem policies de INSERT/SELECT após ser tornado
-- privado, causando "new row violates row-level security policy" ao gerar
-- o recibo legal de compra (upload do PDF bloqueado pelo RLS).

create policy "Users can upload own termos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'termos-compra'
  and (auth.uid())::text = (storage.foldername(name))[1]
);

create policy "Users can view own termos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'termos-compra'
  and (auth.uid())::text = (storage.foldername(name))[1]
);
