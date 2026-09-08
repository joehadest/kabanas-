-- Imagens de produtos do cardápio (upload sem URL)
-- Execute no SQL Editor do Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (cardápio do cliente)
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Staff sobe, atualiza e remove
drop policy if exists "product_images_staff_insert" on storage.objects;
create policy "product_images_staff_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.auth_role() in ('admin', 'restaurant')
  );

drop policy if exists "product_images_staff_update" on storage.objects;
create policy "product_images_staff_update"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and public.auth_role() in ('admin', 'restaurant')
  )
  with check (
    bucket_id = 'product-images'
    and public.auth_role() in ('admin', 'restaurant')
  );

drop policy if exists "product_images_staff_delete" on storage.objects;
create policy "product_images_staff_delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.auth_role() in ('admin', 'restaurant')
  );
