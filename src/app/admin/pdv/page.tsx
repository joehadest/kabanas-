import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { TablePOS } from '@/components/admin/TablePOS';

export const revalidate = 0;

const OPEN_TAB_STATUSES = new Set(['open', 'payment', 'attention']);

const TABLES_SELECT_BASE =
  'id,name,seats,area_id,dining_areas(name),tabs(id,status,identifier,customer_name,waiter_name,guest_count,service_rate,cover_charge,discount_amount,tab_items(id,product_name,quantity,unit_price,unit_cost,tax_rate,notes,status),tab_payments(id,amount,payment_method_id,payment_methods(name,fee_rate)))';

const TABLES_SELECT_WITH_CHANGE =
  'id,name,seats,area_id,dining_areas(name),tabs(id,status,identifier,customer_name,waiter_name,guest_count,service_rate,cover_charge,discount_amount,tab_items(id,product_name,quantity,unit_price,unit_cost,tax_rate,notes,status),tab_payments(id,amount,amount_received,change_amount,payment_method_id,payment_methods(name,fee_rate)))';

function migrationHint(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('dining_tables') || lower.includes('dining_areas') || lower.includes('tabs')) {
    return 'supabase/migration_pos_and_printing.sql';
  }
  if (lower.includes('amount_received') || lower.includes('change_amount')) {
    return 'supabase/migration_tab_payment_change.sql';
  }
  if (lower.includes('cash_sessions')) {
    return 'supabase/migration_cash_management.sql';
  }
  if (lower.includes('default_service_rate') || lower.includes('default_cover_charge')) {
    return 'supabase/migration_restaurant_defaults.sql';
  }
  if (lower.includes('auto_print') || lower.includes('print_agent')) {
    return 'supabase/migration_print_settings.sql';
  }
  return null;
}

async function fetchDiningTables(supabase: Awaited<ReturnType<typeof createClient>>, storeId: string) {
  const withChange = await supabase
    .from('dining_tables')
    .select(TABLES_SELECT_WITH_CHANGE)
    .eq('store_id', storeId)
    .order('name');

  if (!withChange.error) {
    return withChange;
  }

  const missingChangeColumns =
    withChange.error.message.includes('amount_received') || withChange.error.message.includes('change_amount');

  if (missingChangeColumns) {
    return supabase.from('dining_tables').select(TABLES_SELECT_BASE).eq('store_id', storeId).order('name');
  }

  return withChange;
}

export default async function PDVPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6">Empresa não configurada.</p>;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: tables, error: tablesError }, { data: areas }, { data: products }, { data: payments }, { data: categories }, { data: recentSales }, { data: cashSession }, { data: storeDefaults }] =
    await Promise.all([
      fetchDiningTables(supabase, store.id),
      supabase.from('dining_areas').select('id,name').eq('store_id', store.id).order('sort_order'),
      supabase
        .from('products')
        .select('id,name,price,cost_price,packaging_cost,other_variable_cost,tax_rate,category_id,image_url,is_available')
        .eq('store_id', store.id)
        .eq('is_active', true)
        .order('name'),
      supabase.from('payment_methods').select('id,name,fee_rate').eq('store_id', store.id).eq('is_active', true),
      supabase.from('categories').select('id,name').eq('store_id', store.id).order('sort_order'),
      supabase
        .from('sales')
        .select('id,total_amount,total_cost,payment_fee,tax_amount,net_profit,occurred_at,notes,sale_items(product_name,quantity)')
        .eq('store_id', store.id)
        .order('occurred_at', { ascending: false })
        .limit(30),
      user
        ? supabase
            .from('cash_sessions')
            .select('id,terminal_name')
            .eq('store_id', store.id)
            .eq('operator_id', user.id)
            .eq('status', 'open')
            .eq('is_voided', false)
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('store_settings')
        .select('name,default_service_rate,default_cover_charge,auto_print_kitchen,auto_print_customer,print_agent_url')
        .eq('id', store.id)
        .single(),
    ]);

  if (tablesError) {
    const hint = migrationHint(tablesError.message);
    return (
      <div className="space-y-2 p-6 text-sm text-neutral-500">
        <p className="font-semibold text-red-400">Não foi possível carregar o PDV.</p>
        <p className="text-neutral-400">{tablesError.message}</p>
        {hint && (
          <p>
            Execute <code>{hint}</code> no SQL Editor do Supabase e atualize a página.
          </p>
        )}
        {!hint && (
          <p>
            Se as tabelas do PDV ainda não existem, execute também{' '}
            <code>supabase/migration_pos_and_printing.sql</code>.
          </p>
        )}
      </div>
    );
  }

  return (
    <TablePOS
      storeId={store.id}
      storeName={storeDefaults?.name ?? store.name}
      areas={areas ?? []}
      tables={(tables ?? []).map((table) => ({
        ...table,
        tabs: (table.tabs ?? []).filter((tab) => OPEN_TAB_STATUSES.has(tab.status)),
      }))}
      products={products ?? []}
      categories={categories ?? []}
      payments={payments ?? []}
      recentSales={(recentSales ?? []).map((sale) => ({
        ...sale,
        sale_items: Array.isArray(sale.sale_items) ? sale.sale_items : [],
      }))}
      cashSession={cashSession}
      defaultServiceRate={Number(storeDefaults?.default_service_rate ?? 10)}
      defaultCoverCharge={Number(storeDefaults?.default_cover_charge ?? 0)}
      printSettings={{
        auto_print_kitchen: Boolean(storeDefaults?.auto_print_kitchen),
        auto_print_customer: Boolean(storeDefaults?.auto_print_customer),
        print_agent_url: storeDefaults?.print_agent_url ?? 'http://127.0.0.1:9100',
      }}
    />
  );
}
