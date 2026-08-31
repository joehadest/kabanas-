import { getActiveStore } from '@/lib/data/get-store';
import { HoursForm } from '@/components/admin/HoursForm';

export const revalidate = 0;

export default async function HorariosPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">Funcionamento</p>
      <h1 className="mb-7 mt-2 font-serif text-3xl font-bold leading-none text-[#1c1d1a]">Horários</h1>
      <HoursForm store={store} />
    </div>
  );
}
