-- Troco em pagamentos de comanda (PDV)
alter table tab_payments add column if not exists amount_received numeric(10, 2);
alter table tab_payments add column if not exists change_amount numeric(10, 2);

comment on column tab_payments.amount_received is 'Valor em espécie entregue pelo cliente (dinheiro)';
comment on column tab_payments.change_amount is 'Troco devolvido ao cliente';
