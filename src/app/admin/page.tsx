import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils/format';

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const storeSlug = process.env.NEXT_PUBLIC_STORE_SLUG ?? 'kabanas';

  const { data: store } = await supabase.from('store_settings').select('id').eq('slug', storeSlug).single();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const [{ data: todayOrders }, { data: monthOrders }] = await Promise.all([
    supabase
      .from('orders')
      .select('total, status')
      .eq('store_id', store.id)
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('orders')
      .select('total, status')
      .eq('store_id', store.id)
      .gte('created_at', monthStart.toISOString()),
  ]);

  const validToday = (todayOrders ?? []).filter((o) => o.status !== 'cancelled');
  const validMonth = (monthOrders ?? []).filter((o) => o.status !== 'cancelled');

  const salesToday = validToday.reduce((sum, o) => sum + Number(o.total), 0);
  const salesMonth = validMonth.reduce((sum, o) => sum + Number(o.total), 0);
  const avgTicket = validMonth.length > 0 ? salesMonth / validMonth.length : 0;

  const metrics = [
    { label: 'Vendas hoje', value: formatCurrency(salesToday) },
    { label: 'Pedidos hoje', value: String(validToday.length) },
    { label: 'Vendas no mês', value: formatCurrency(salesMonth) },
    { label: 'Ticket médio (mês)', value: formatCurrency(avgTicket) },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">Painel de controle</p>
          <h1 className="mt-2 font-serif text-3xl font-bold leading-none text-[#1c1d1a]">Visao geral</h1>
        </div>
        <p className="hidden text-sm text-neutral-500 sm:block">Acompanhe o pulso da sua operação.</p>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden border border-[#d8d4c9] bg-[#d8d4c9] sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, idx) => (
          <div
            key={m.label}
            style={{ animationDelay: `${idx * 60}ms` }}
            className="bg-[#faf9f5] p-5 animate-fade-in-up transition-colors hover:bg-brand-50"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">{m.label}</p>
            <p className="mt-3 font-serif text-3xl font-bold leading-none text-[#1c1d1a]">{m.value}</p>
            <span className="mt-4 block h-1 w-10 bg-brand-400" />
          </div>
        ))}
      </div>
    </div>
  );
}
