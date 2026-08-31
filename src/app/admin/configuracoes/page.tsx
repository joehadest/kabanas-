import { getActiveStore } from '@/lib/data/get-store';
import { StoreSettingsForm } from '@/components/shared/StoreSettingsForm';

export const revalidate = 0;

export default async function ConfiguracoesPage() {
  const store = await getActiveStore();

  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">Gestao da loja</p>
      <h1 className="mb-7 mt-2 font-serif text-3xl font-bold leading-none text-[#1c1d1a]">Configurações</h1>
      <StoreSettingsForm store={store} />
    </div>
  );
}
