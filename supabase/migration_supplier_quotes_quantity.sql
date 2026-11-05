-- Cotação: quantidade comprada (opcional) junto com o preço anotado.

alter table purchase_quotes
  add column if not exists quantity numeric(12, 3) check (quantity is null or quantity > 0);
