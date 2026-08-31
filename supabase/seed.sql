-- =====================================================================
-- SEED — dados de exemplo para desenvolvimento local.
-- Rode depois de supabase/schema.sql. Seguro para rodar mais de uma vez
-- (limpa os dados de exemplo antes de reinserir).
-- =====================================================================

delete from products where store_id in (select id from store_settings where slug = 'kabanas');
delete from categories where store_id in (select id from store_settings where slug = 'kabanas');
delete from store_settings where slug = 'kabanas';

-- ---------------------------------------------------------------------
-- LOJA
-- ---------------------------------------------------------------------
insert into store_settings (
  name, slug, tagline, phone, address_city, address_state,
  delivery_fee_type, delivery_fee_fixed, min_order_value
) values (
  'Kabanas Delivery', 'kabanas', 'Sabor de verdade, entregue rápido.', '(11) 99999-9999', 'São Paulo', 'SP',
  'fixed', 6.90, 20.00
);

-- ---------------------------------------------------------------------
-- CATEGORIAS + PRODUTOS
-- ---------------------------------------------------------------------
do $$
declare
  v_store_id uuid;
  v_cat_lanches uuid;
  v_cat_bebidas uuid;
  v_cat_sobremesas uuid;
  v_product_id uuid;
  v_group_id uuid;
begin
  select id into v_store_id from store_settings where slug = 'kabanas';

  insert into categories (store_id, name, sort_order) values (v_store_id, 'Lanches', 1) returning id into v_cat_lanches;
  insert into categories (store_id, name, sort_order) values (v_store_id, 'Bebidas', 2) returning id into v_cat_bebidas;
  insert into categories (store_id, name, sort_order) values (v_store_id, 'Sobremesas', 3) returning id into v_cat_sobremesas;

  -- Produto com grupo de adicionais (demonstra a UI de customização)
  insert into products (store_id, category_id, name, description, price, sort_order)
  values (v_store_id, v_cat_lanches, 'X-Kabana Clássico', 'Pão brioche, blend 150g, queijo, alface e tomate.', 24.90, 1)
  returning id into v_product_id;

  insert into product_option_groups (product_id, name, is_required, min_select, max_select, sort_order)
  values (v_product_id, 'Adicionais', false, 0, 3, 1)
  returning id into v_group_id;

  insert into product_options (group_id, name, price, sort_order) values
    (v_group_id, 'Bacon extra', 5.00, 1),
    (v_group_id, 'Queijo extra', 4.00, 2),
    (v_group_id, 'Ovo', 3.00, 3);

  insert into products (store_id, category_id, name, description, price, sort_order) values
    (v_store_id, v_cat_lanches, 'X-Salada', 'Pão, hambúrguer 120g, queijo, alface, tomate e maionese.', 19.90, 2),
    (v_store_id, v_cat_lanches, 'X-Bacon', 'Pão, hambúrguer 150g, bacon crocante e queijo cheddar.', 26.90, 3),
    (v_store_id, v_cat_bebidas, 'Refrigerante Lata 350ml', 'Coca-Cola, Guaraná ou Fanta.', 6.00, 1),
    (v_store_id, v_cat_bebidas, 'Suco Natural 500ml', 'Laranja, limão ou maracujá.', 9.00, 2),
    (v_store_id, v_cat_sobremesas, 'Petit Gâteau', 'Bolinho de chocolate com sorvete de creme.', 15.90, 1);
end $$;
