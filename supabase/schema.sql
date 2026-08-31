-- =====================================================================
-- KABANAS DELIVERY — SCHEMA POSTGRESQL / SUPABASE
-- =====================================================================
-- Convenções:
--   * auth.users é gerenciada pelo Supabase Auth. Criamos public.profiles
--     em relação 1:1 (id = auth.users.id) para dados de perfil/role.
--   * Todas as tabelas usam uuid como PK (gen_random_uuid()).
--   * RLS (Row Level Security) habilitado em todas as tabelas expostas
--     via API. Policies cobrem os 3 papéis: customer, restaurant, admin.
--   * store_id existe em várias tabelas para permitir evoluir de
--     "1 restaurante" para "marketplace multi-loja" sem quebrar o schema.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- RESET (dev only) — torna este arquivo seguro para rodar mais de uma vez
-- durante o desenvolvimento, sem erros de "already exists". Remova este
-- bloco (ou não o execute) depois que o projeto estiver em produção.
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists order_status_history cascade;
drop table if exists order_item_options cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists coupons cascade;
drop table if exists product_options cascade;
drop table if exists product_option_groups cascade;
drop table if exists products cascade;
drop table if exists categories cascade;
drop table if exists addresses cascade;
drop table if exists profiles cascade;
drop table if exists store_settings cascade;

drop function if exists handle_new_user() cascade;
drop function if exists log_order_status_change() cascade;
drop function if exists set_updated_at() cascade;
drop function if exists auth_role() cascade;

drop type if exists user_role cascade;
drop type if exists delivery_fee_type cascade;
drop type if exists order_status cascade;
drop type if exists payment_method cascade;
drop type if exists discount_type cascade;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type user_role as enum ('customer', 'restaurant', 'admin');
create type delivery_fee_type as enum ('fixed', 'per_km');
create type order_status as enum (
  'received',        -- Recebido
  'preparing',        -- Em Preparo
  'out_for_delivery',  -- Saiu para Entrega
  'delivered',         -- Entregue
  'cancelled'          -- Cancelado
);
create type payment_method as enum ('pix', 'card_on_delivery', 'cash');
create type discount_type as enum ('percentage', 'fixed');

-- ---------------------------------------------------------------------
-- STORE_SETTINGS — dados do estabelecimento (Painel Super Admin)
-- ---------------------------------------------------------------------
create table store_settings (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique not null,
  tagline               text,                  -- frase curta exibida na hero do site (ex: "Sabor de verdade, entregue rápido.")
  logo_url              text,
  banner_url            text,
  phone                 text,
  cnpj                  text,
  address_street        text,
  address_number        text,
  address_neighborhood  text,
  address_city          text,
  address_state         text,
  address_zip_code      text,
  address_lat           numeric(10, 7),
  address_lng           numeric(10, 7),
  opening_hours         jsonb not null default '{
    "mon": {"open": "18:00", "close": "23:00", "closed": false},
    "tue": {"open": "18:00", "close": "23:00", "closed": false},
    "wed": {"open": "18:00", "close": "23:00", "closed": false},
    "thu": {"open": "18:00", "close": "23:00", "closed": false},
    "fri": {"open": "18:00", "close": "23:30", "closed": false},
    "sat": {"open": "18:00", "close": "23:30", "closed": false},
    "sun": {"open": "18:00", "close": "22:00", "closed": true}
  }'::jsonb,
  delivery_fee_type     delivery_fee_type not null default 'fixed',
  delivery_fee_fixed    numeric(10, 2) not null default 0,
  delivery_fee_per_km   numeric(10, 2) not null default 0,
  min_order_value       numeric(10, 2) not null default 0,
  is_open_override      boolean,               -- null = segue opening_hours; true/false força aberto/fechado
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table store_settings is 'Configurações gerais do estabelecimento (Super Admin).';

-- ---------------------------------------------------------------------
-- PROFILES — extensão de auth.users com role e dados pessoais
-- ---------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null default 'customer',
  full_name     text,
  phone         text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table profiles is 'Perfil público vinculado a auth.users (1:1).';

-- Trigger: cria profile automaticamente ao registrar um novo usuário
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'customer');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- ADDRESSES — endereços do cliente
-- ---------------------------------------------------------------------
create table addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id) on delete cascade,       -- dono logado (conta real)
  guest_id      uuid,                                                 -- dono visitante (cookie kabanas_guest_id)
  label         text not null default 'Casa',        -- Casa, Trabalho, etc.
  street        text not null,
  number        text not null,
  complement    text,
  neighborhood  text not null,
  city          text not null,
  state         text not null,
  zip_code      text not null,
  lat           numeric(10, 7),
  lng           numeric(10, 7),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint addresses_owner_check check (
    (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
  )
);
create index idx_addresses_user on addresses(user_id);
create index idx_addresses_guest on addresses(guest_id);

-- ---------------------------------------------------------------------
-- CATEGORIES — categorias do cardápio
-- ---------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references store_settings(id) on delete cascade,
  name        text not null,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_categories_store on categories(store_id);

-- ---------------------------------------------------------------------
-- PRODUCTS — itens do cardápio
-- ---------------------------------------------------------------------
create table products (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references store_settings(id) on delete cascade,
  category_id   uuid references categories(id) on delete set null,
  name          text not null,
  description   text,
  price         numeric(10, 2) not null check (price >= 0),
  promo_price   numeric(10, 2) check (promo_price is null or promo_price >= 0),
  image_url     text,
  is_active     boolean not null default true,   -- visível no cardápio
  is_available  boolean not null default true,   -- em estoque agora (86'd)
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_products_store on products(store_id);
create index idx_products_category on products(category_id);
create index idx_products_name_search on products using gin (to_tsvector('portuguese', name || ' ' || coalesce(description, '')));

-- ---------------------------------------------------------------------
-- PRODUCT_OPTION_GROUPS / PRODUCT_OPTIONS — adicionais/opcionais
-- ---------------------------------------------------------------------
create table product_option_groups (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  name          text not null,          -- ex: "Escolha o tamanho", "Adicionais"
  is_required   boolean not null default false,
  min_select    integer not null default 0,
  max_select    integer not null default 1,
  sort_order    integer not null default 0
);
create index idx_option_groups_product on product_option_groups(product_id);

create table product_options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references product_option_groups(id) on delete cascade,
  name        text not null,           -- ex: "Bacon extra", "Grande"
  price       numeric(10, 2) not null default 0,
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);
create index idx_options_group on product_options(group_id);

-- ---------------------------------------------------------------------
-- COUPONS — cupons de desconto
-- ---------------------------------------------------------------------
create table coupons (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references store_settings(id) on delete cascade,
  code            text not null,
  discount_type   discount_type not null,
  discount_value  numeric(10, 2) not null check (discount_value >= 0),
  min_order_value numeric(10, 2) not null default 0,
  max_uses        integer,               -- null = ilimitado
  used_count      integer not null default 0,
  valid_from      timestamptz not null default now(),
  valid_until     timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (store_id, code)
);

-- ---------------------------------------------------------------------
-- ORDERS — pedidos
-- ---------------------------------------------------------------------
create table orders (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references store_settings(id) on delete restrict,
  user_id         uuid references profiles(id) on delete restrict,    -- dono logado (conta real)
  guest_id        uuid,                                               -- dono visitante (cookie kabanas_guest_id)
  guest_name      text,                                               -- nome de contato quando é pedido de visitante
  guest_phone     text,                                               -- telefone de contato quando é pedido de visitante
  address_id      uuid references addresses(id) on delete set null,
  status          order_status not null default 'received',
  payment_method  payment_method not null,
  change_for      numeric(10, 2),        -- "troco para R$ X" (só quando payment_method = cash)
  subtotal        numeric(10, 2) not null default 0,
  delivery_fee    numeric(10, 2) not null default 0,
  discount        numeric(10, 2) not null default 0,
  total           numeric(10, 2) not null default 0,
  coupon_id       uuid references coupons(id) on delete set null,
  notes           text,
  order_code      text not null,          -- código curto amigável, ex: #A3F91
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint orders_owner_check check (
    (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
  )
);
create index idx_orders_store on orders(store_id);
create index idx_orders_user on orders(user_id);
create index idx_orders_guest on orders(guest_id);
create index idx_orders_status on orders(store_id, status);

-- ---------------------------------------------------------------------
-- ORDER_ITEMS — itens do pedido (snapshot de nome/preço no momento da compra)
-- ---------------------------------------------------------------------
create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  product_name  text not null,
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(10, 2) not null,
  total_price   numeric(10, 2) not null,
  notes         text
);
create index idx_order_items_order on order_items(order_id);

create table order_item_options (
  id              uuid primary key default gen_random_uuid(),
  order_item_id   uuid not null references order_items(id) on delete cascade,
  option_name     text not null,
  option_price    numeric(10, 2) not null default 0
);
create index idx_order_item_options_item on order_item_options(order_item_id);

-- ---------------------------------------------------------------------
-- ORDER_STATUS_HISTORY — linha do tempo p/ acompanhamento em tempo real
-- ---------------------------------------------------------------------
create table order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  status      order_status not null,
  changed_by  uuid references profiles(id) on delete set null,
  changed_at  timestamptz not null default now()
);
create index idx_status_history_order on order_status_history(order_id);

-- Registra automaticamente a mudança de status no histórico
create or replace function log_order_status_change()
returns trigger as $$
begin
  if (tg_op = 'INSERT') or (old.status is distinct from new.status) then
    insert into order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_order_status_insert
  after insert on orders
  for each row execute function log_order_status_change();

create trigger trg_order_status_update
  before update on orders
  for each row execute function log_order_status_change();

-- ---------------------------------------------------------------------
-- updated_at genérico
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();
create trigger trg_store_settings_updated_at before update on store_settings
  for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table store_settings enable row level security;
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_option_groups enable row level security;
alter table product_options enable row level security;
alter table coupons enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_options enable row level security;
alter table order_status_history enable row level security;

-- Helper: role do usuário autenticado
-- security definer + search_path fixo: faz esta função rodar com os
-- privilégios do dono (bypassando RLS) ao consultar profiles. Sem isso,
-- a policy de profiles (que também chama auth_role()) entra em loop
-- infinito e o Postgres derruba a query com "stack depth limit exceeded".
create or replace function auth_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- Helper: guest_id do visitante sem conta, enviado pelo cliente no header
-- x-guest-id (ver src/lib/supabase/client.ts e server.ts). O Supabase/PostgREST
-- expõe os headers da requisição em request.headers — não depende do Auth.
-- Checkout sem login usa isso em vez de auth.uid() para "dono" do registro.
create or replace function requesting_guest_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.headers', true)::json->>'x-guest-id', '')::uuid
$$;

-- STORE_SETTINGS: leitura pública, escrita só admin
create policy "store_settings_select_public" on store_settings for select using (true);
create policy "store_settings_write_admin" on store_settings for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- PROFILES: usuário vê/edita o próprio; admin/restaurant veem todos
create policy "profiles_select_own_or_staff" on profiles for select
  using (id = auth.uid() or auth_role() in ('admin', 'restaurant'));
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

-- ADDRESSES: dono logado por auth.uid(), visitante por guest_id (cookie/header)
create policy "addresses_owner_all" on addresses for all
  using (user_id = auth.uid() or (user_id is null and guest_id = requesting_guest_id()))
  with check (user_id = auth.uid() or (user_id is null and guest_id = requesting_guest_id()));

-- CATEGORIES / PRODUCTS / OPTIONS: leitura pública, escrita staff
create policy "categories_select_public" on categories for select using (is_active = true or auth_role() in ('admin','restaurant'));
create policy "categories_write_staff" on categories for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));

create policy "products_select_public" on products for select using (is_active = true or auth_role() in ('admin','restaurant'));
create policy "products_write_staff" on products for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));

create policy "option_groups_select_public" on product_option_groups for select using (true);
create policy "option_groups_write_staff" on product_option_groups for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));

create policy "options_select_public" on product_options for select using (true);
create policy "options_write_staff" on product_options for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));

-- COUPONS: leitura pública (só ativos), escrita staff
create policy "coupons_select_active" on coupons for select
  using (is_active = true or auth_role() in ('admin', 'restaurant'));
create policy "coupons_write_staff" on coupons for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));

-- ORDERS: cliente logado vê/cria os próprios por auth.uid(); visitante por
-- guest_id (mesmo cookie que criou o pedido); staff vê/edita todos.
create policy "orders_select_own_or_staff" on orders for select
  using (
    auth_role() in ('admin', 'restaurant')
    or user_id = auth.uid()
    or (user_id is null and guest_id = requesting_guest_id())
  );
create policy "orders_insert_own" on orders for insert
  with check (
    user_id = auth.uid()
    or (user_id is null and guest_id = requesting_guest_id())
  );
create policy "orders_update_staff_or_owner_cancel" on orders for update
  using (
    auth_role() in ('admin', 'restaurant')
    or user_id = auth.uid()
    or (user_id is null and guest_id = requesting_guest_id())
  );

-- ORDER_ITEMS / OPTIONS / HISTORY: seguem a visibilidade do pedido pai
create policy "order_items_select" on order_items for select
  using (exists (
    select 1 from orders o where o.id = order_id and (
      o.user_id = auth.uid()
      or (o.user_id is null and o.guest_id = requesting_guest_id())
      or auth_role() in ('admin','restaurant')
    )
  ));
create policy "order_items_insert" on order_items for insert
  with check (exists (
    select 1 from orders o where o.id = order_id and (
      o.user_id = auth.uid() or (o.user_id is null and o.guest_id = requesting_guest_id())
    )
  ));

create policy "order_item_options_select" on order_item_options for select
  using (exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_id and (
      o.user_id = auth.uid()
      or (o.user_id is null and o.guest_id = requesting_guest_id())
      or auth_role() in ('admin','restaurant')
    )
  ));
create policy "order_item_options_insert" on order_item_options for insert
  with check (exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_id and (
      o.user_id = auth.uid() or (o.user_id is null and o.guest_id = requesting_guest_id())
    )
  ));

create policy "status_history_select" on order_status_history for select
  using (exists (
    select 1 from orders o where o.id = order_id and (
      o.user_id = auth.uid()
      or (o.user_id is null and o.guest_id = requesting_guest_id())
      or auth_role() in ('admin','restaurant')
    )
  ));

-- =====================================================================
-- REALTIME — habilita publicação para as tabelas usadas no tempo real
-- =====================================================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_status_history;

-- =====================================================================
-- SEED mínimo (opcional) — descomente para popular em dev
-- =====================================================================
-- insert into store_settings (name, slug, delivery_fee_type, delivery_fee_fixed, min_order_value)
-- values ('Kabanas Delivery', 'kabanas', 'fixed', 6.90, 20.00);
