-- Realtime do PDV: sincroniza mapa de mesas entre garçons/admins.
-- tab_items já entra via migration_kds_sync.sql.

do $$
declare
  table_name text;
begin
  foreach table_name in array array['tabs', 'tab_payments', 'dining_tables']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table %I', table_name);
    end if;
  end loop;
end $$;
