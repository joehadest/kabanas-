-- Corrige o nome da loja impresso no cupom (não é delivery).
-- Rode no SQL Editor do Supabase.

update public.store_settings
set
  name = 'Boteco Kabanas Beer',
  tagline = coalesce(nullif(trim(tagline), ''), 'Petisco, cerveja e boas histórias')
where slug = 'kabanas'
   or name ilike '%delivery%';
;
