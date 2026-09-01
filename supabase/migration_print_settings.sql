-- Configurações de impressão automática e agente local (Kabanas Print Agent)

alter table store_settings add column if not exists auto_print_kitchen boolean not null default false;
alter table store_settings add column if not exists auto_print_customer boolean not null default false;
alter table store_settings add column if not exists print_agent_url text not null default 'http://127.0.0.1:9100';
alter table store_settings add column if not exists print_agent_secret text;

comment on column store_settings.auto_print_kitchen is 'Envia ficha de cozinha à fila ao lançar item no PDV';
comment on column store_settings.auto_print_customer is 'Envia conta do cliente à fila ao fechar comanda';
comment on column store_settings.print_agent_url is 'URL do agente local (wake/health)';
comment on column store_settings.print_agent_secret is 'Token Bearer para o agente .exe buscar a fila';

-- Índice para o agente buscar jobs pendentes por loja
create index if not exists idx_print_jobs_store_queued on print_jobs(store_id, status, created_at)
  where status = 'queued';
