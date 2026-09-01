-- Padrões de mesa/comanda na loja. Execute após migration_pos_and_printing.sql.

alter table store_settings add column if not exists default_service_rate numeric(5, 2) not null default 10 check (default_service_rate >= 0);
alter table store_settings add column if not exists default_cover_charge numeric(10, 2) not null default 0 check (default_cover_charge >= 0);

comment on column store_settings.default_service_rate is 'Taxa de serviço (%) aplicada ao abrir novas comandas.';
comment on column store_settings.default_cover_charge is 'Couvert por pessoa (R$) sugerido ao abrir novas comandas.';
