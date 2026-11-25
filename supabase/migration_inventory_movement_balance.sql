-- Saldo do item logo depois de cada movimentação, para o histórico do Inventário.
--
-- Só acrescenta informação: a conta do estoque continua a mesma de
-- migration_inventory.sql. Movimentações antigas ficam com o saldo em branco,
-- porque não dá para recalcular com certeza (o estoque para em zero e a
-- quantidade podia ser editada direto no item).

alter table inventory_movements add column if not exists quantity_after numeric(12, 3);

-- Cancelar uma comanda com vários itens grava várias movimentações na mesma
-- transação: com now() todas teriam a mesma hora e a ordem se perderia.
alter table inventory_movements alter column created_at set default clock_timestamp();

create or replace function apply_inventory_movement()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  new_quantity numeric(12, 3);
begin
  update inventory_items
  set quantity = greatest(0, quantity + new.quantity_change),
      average_cost = case when new.movement_type = 'entry' and new.unit_cost is not null and new.unit_cost >= 0 then new.unit_cost else average_cost end,
      updated_at = now()
  where id = new.inventory_item_id
  returning quantity into new_quantity;

  update inventory_movements set quantity_after = new_quantity where id = new.id;
  return new;
end;
$$;
