import { getActiveStore } from '@/lib/data/get-store';
import { HoursForm } from '@/components/admin/HoursForm';
import { PageContainer, PageHeader } from '@/components/ui/page-layout';

export const revalidate = 0;

export default async function HorariosPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        eyebrow="Funcionamento"
        title="Horários"
        description="Defina quando a loja abre e feche manualmente quando precisar."
      />
      <div className="mt-8">
        <HoursForm store={store} />
      </div>
    </PageContainer>
  );
}
