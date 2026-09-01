-- Cardápio real Kabanas. Execute após migration_trinta_complete.sql.
-- Atualiza os itens pelo nome e não remove produtos existentes.

create extension if not exists "unaccent";

do $$
declare
  v_store_id uuid;
  v_bebidas uuid;
  v_cervejas uuid;
  v_drinks uuid;
  v_espetinhos uuid;
  v_petiscos uuid;
  v_pratos uuid;
begin
  select id into v_store_id from store_settings where slug = 'kabanas';
  if v_store_id is null then raise exception 'Loja com slug kabanas não encontrada'; end if;

  insert into categories (store_id, name, sort_order)
  select v_store_id, category_data.name, category_data.sort_order
  from (values
    ('Bebidas sem álcool', 1),
    ('Cervejas e chopp', 2),
    ('Drinks e doses', 3),
    ('Espetinhos', 4),
    ('Petiscos e porções', 5),
    ('Pratos e tábuas', 6)
  ) as category_data(name, sort_order)
  where not exists (
    select 1 from categories
    where store_id = v_store_id and upper(unaccent(name)) = upper(unaccent(category_data.name))
  );

  select id into v_bebidas from categories where store_id = v_store_id and name = 'Bebidas sem álcool';
  select id into v_cervejas from categories where store_id = v_store_id and name = 'Cervejas e chopp';
  select id into v_drinks from categories where store_id = v_store_id and name = 'Drinks e doses';
  select id into v_espetinhos from categories where store_id = v_store_id and name = 'Espetinhos';
  select id into v_petiscos from categories where store_id = v_store_id and name = 'Petiscos e porções';
  select id into v_pratos from categories where store_id = v_store_id and name = 'Pratos e tábuas';

  create temporary table menu_import (name text, price numeric(10,2), cost numeric(10,2), category_id uuid) on commit drop;
  insert into menu_import (name, price, cost, category_id) values
    ('ÁGUA COM GÁS 500ML', 4.00, 1.50, v_bebidas),
    ('ÁGUA DE COCO', 5.00, 0.00, v_bebidas),
    ('ÁGUA SEM GÁS 500ML', 3.00, 1.50, v_bebidas),
    ('AMSTEL ULTRA', 10.00, 5.00, v_cervejas),
    ('APEROL SPRITZ KABANAS', 22.90, 0.00, v_drinks),
    ('BATATA FRITA', 15.00, 7.00, v_petiscos),
    ('BOLINHA CALABRESA COM QUEIJO', 22.99, 0.00, v_petiscos),
    ('BOLINHA DE CARNE DE SOL', 28.99, 16.98, v_petiscos),
    ('BOLINHA DE FRANGO', 21.99, 12.00, v_petiscos),
    ('BOLINHA DE PERNIL SUÍNO', 28.99, 16.98, v_petiscos),
    ('BOLINHO DE 4 QUEIJOS', 27.99, 14.00, v_petiscos),
    ('CAIPIRINHA KABANAS', 12.00, 3.30, v_drinks),
    ('CARNE DE PORCO', 8.00, 3.30, v_espetinhos),
    ('CERVEJA AMSTEL 600ML', 12.99, 8.59, v_cervejas),
    ('CERVEJA CORONA ZERO', 12.99, 9.24, v_cervejas),
    ('CERVEJA HEINEKEN', 11.99, 8.58, v_cervejas),
    ('CERVEJA HEINEKEN 600ML', 15.99, 9.00, v_cervejas),
    ('CERVEJA MICHELOB LATA', 10.99, 6.27, v_cervejas),
    ('CHOPP AMSTEL', 10.99, 5.57, v_cervejas),
    ('CHOPP HEINEKEN', 12.99, 7.70, v_cervejas),
    ('CHOPP OKTOS ARTESANAL', 11.99, 6.99, v_cervejas),
    ('COCA-COLA 1 LITRO', 12.00, 8.58, v_bebidas),
    ('COCA-COLA EM LATA', 5.00, 3.25, v_bebidas),
    ('CORONA', 12.99, 9.24, v_cervejas),
    ('CORONA TROPICAL', 22.90, 6.99, v_drinks),
    ('COSTELINHA SUÍNA', 23.99, 15.00, v_petiscos),
    ('COXINHA DA ASA COM FRITAS E MOLHO DA CASA', 20.99, 12.54, v_petiscos),
    ('COXINHA DA ASA FRITA SEM FRITAS', 14.99, 10.00, v_petiscos),
    ('DOSE CAMPARI', 10.00, 0.00, v_drinks),
    ('DOSE WHISKY RED LABEL', 12.00, 8.00, v_drinks),
    ('DOSE YPIÓCA', 5.00, 2.00, v_drinks),
    ('DRINK KABANA SEM ÁLCOOL', 22.90, 14.43, v_drinks),
    ('DRINK SKOL BEATS', 22.90, 14.43, v_drinks),
    ('ESPETINHO DE CALABRESA', 8.00, 4.04, v_espetinhos),
    ('ESPETINHO DE CARNE MAMINHA', 10.00, 5.00, v_espetinhos),
    ('ESPETINHO DE CORAÇÃO DE FRANGO', 8.00, 4.83, v_espetinhos),
    ('ESPETINHO DE FRANGO', 8.00, 0.00, v_espetinhos),
    ('ESPETINHO DE PORCO', 8.00, 5.00, v_espetinhos),
    ('ESPETINHO KABANAS', 14.00, 8.00, v_espetinhos),
    ('ESPETINHO OVO COM BACON', 10.00, 4.17, v_espetinhos),
    ('ESPETINHO ROMEU E JULIETA', 10.00, 3.23, v_espetinhos),
    ('FRANGO A PASSARINHO COM FRITAS', 18.90, 11.00, v_petiscos),
    ('GUARANÁ 1 LITRO', 8.00, 4.48, v_bebidas),
    ('GUARANÁ EM LATA', 5.00, 3.00, v_bebidas),
    ('JANTINHA CARNE MAMINHA', 29.00, 19.00, v_pratos),
    ('JANTINHA FRANGO', 21.00, 10.00, v_pratos),
    ('JANTINHA MISTA', 22.00, 11.82, v_pratos),
    ('KABANAS BRISA', 21.99, 14.45, v_drinks),
    ('KABANAS RED BEATS', 19.99, 7.70, v_drinks),
    ('KABANAS RED BEATS PREMIUM', 24.99, 14.00, v_drinks),
    ('KABANAS ULTRA', 22.99, 0.00, v_drinks),
    ('MONSTER ENERGÉTICO', 20.00, 9.00, v_bebidas),
    ('PÃO DE ALHO', 6.99, 0.00, v_petiscos),
    ('PÃO DE ALHO COM CAMARÃO', 15.00, 0.00, v_petiscos),
    ('PÃO DE ALHO COM CARNE DE SOL', 9.99, 0.00, v_petiscos),
    ('PÃO DE ALHO COM CARNE GRELHADA', 12.00, 0.00, v_petiscos),
    ('PÃO DE ALHO COM CORAÇÃO E QUEIJO', 10.00, 0.00, v_petiscos),
    ('PÃO DE ALHO COM FRALDINHA', 12.00, 5.00, v_petiscos),
    ('PRAY', 12.00, 7.70, v_cervejas),
    ('QUEIJO COALHO CAICÓ COM MELAÇO', 14.00, 4.62, v_petiscos),
    ('QUEIJO COALHO GRELHADO', 10.00, 4.62, v_petiscos),
    ('RED BULL', 15.00, 10.80, v_bebidas),
    ('SKOL BEATS', 13.99, 0.00, v_cervejas),
    ('SUCO DE LARANJA OU MARACUJÁ', 9.00, 5.00, v_bebidas),
    ('SUCOS VARIADOS', 7.00, 6.00, v_bebidas),
    ('SUKITA LATA', 5.00, 3.00, v_bebidas),
    ('TÁBUA CALABRESA COM FRITAS', 27.99, 0.00, v_pratos),
    ('TÁBUA DE CAMARÃO KABANAS', 49.99, 26.70, v_pratos),
    ('TÁBUA DE CARNE KABANAS', 39.90, 25.46, v_pratos),
    ('TÁBUA DE CORAÇÃO COM FRITAS', 31.90, 0.00, v_pratos),
    ('TORRESMO', 34.90, 20.25, v_petiscos),
    ('TRIPA SUÍNA', 22.99, 15.00, v_petiscos),
    ('TULIPA FRITA COM GELEIA DE ABACAXI', 22.90, 14.00, v_petiscos),
    ('VITAMINAS', 12.00, 8.00, v_bebidas);

  update products p
  set price = m.price, cost_price = m.cost, category_id = m.category_id, is_active = true, is_available = true
  from menu_import m
  where p.store_id = v_store_id and upper(unaccent(p.name)) = upper(unaccent(m.name));

  insert into products (store_id, category_id, name, price, cost_price, stock_quantity, reorder_level, is_active, is_available, sort_order)
  select v_store_id, m.category_id, m.name, m.price, m.cost, 0, 0, true, true, row_number() over (partition by m.category_id order by m.name)
  from menu_import m
  where not exists (select 1 from products p where p.store_id = v_store_id and upper(unaccent(p.name)) = upper(unaccent(m.name)));
end $$;