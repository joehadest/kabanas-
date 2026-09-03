import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { MesasManager } from '@/components/admin/MesasManager';
import { PageContainer, PageHeader } from '@/components/ui/page-layout';

export const revalidate = 0;

export default async function MesasPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  const supabase = await createClient();
  const [{ data: areas }, { data: tables }] = await Promise.all([
    supabase.from('dining_areas').select('id,name').eq('store_id', store.id).order('sort_order'),
    supabase
      .from('dining_tables')
      .select('id,name,seats,area_id,is_active,sort_order,tabs(id,status)')
      .eq('store_id', store.id)
      .order('sort_order'),
  ]);

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? (host.includes('localhost') ? `${protocol}://${host}` : `https://${host}`);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Salão"
        title="Mesas"
        description="Cadastre as mesas do salão, ative ou desative conforme o uso e baixe o QR Code que fica disponível para os clientes no cardápio."
        className="mb-6"
      />
      <MesasManager
        storeId={store.id}
        storeSlug={store.slug}
        menuUrl={`${appUrl}/cardapio/${store.slug}`}
        areas={areas ?? []}
        tables={(tables ?? []).map((table) => ({ ...table, tabs: table.tabs ?? [] }))}
      />
    </PageContainer>
  );
}
