import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { PrintManager } from '@/components/admin/PrintManager';
import type { PrintJobRecord, PrintSettings, ThermalPrinterRecord } from '@/lib/printing/types';

export const revalidate = 0;

export default async function ImpressaoPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6">Empresa não configurada.</p>;

  const supabase = await createClient();

  const [{ data: storeRow, error: settingsError }, { data: printers }, { data: jobs }] = await Promise.all([
    supabase
      .from('store_settings')
      .select('name,auto_print_kitchen,auto_print_customer,print_agent_url,print_agent_secret')
      .eq('id', store.id)
      .single(),
    supabase
      .from('thermal_printers')
      .select('id,name,connection_type,endpoint,paper_width,purpose,is_active')
      .eq('store_id', store.id)
      .order('name'),
    supabase
      .from('print_jobs')
      .select('id,job_type,status,error_message,created_at,printed_at,thermal_printers(name)')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  if (settingsError?.message?.includes('auto_print') || settingsError?.message?.includes('print_agent')) {
    return (
      <div className="space-y-2 p-6 text-sm text-neutral-500">
        <p className="font-semibold text-red-400">Migração de impressão pendente.</p>
        <p>
          Execute <code>supabase/migration_print_settings.sql</code> no SQL Editor do Supabase e atualize a página.
        </p>
      </div>
    );
  }

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (host.includes('localhost') ? `${protocol}://${host}` : 'https://kabanasbeer.webpulseservicos.com');

  const settings: PrintSettings = {
    auto_print_kitchen: Boolean(storeRow?.auto_print_kitchen),
    auto_print_customer: Boolean(storeRow?.auto_print_customer),
    print_agent_url: storeRow?.print_agent_url ?? 'http://127.0.0.1:9100',
    print_agent_secret: storeRow?.print_agent_secret ?? null,
  };

  return (
    <PrintManager
      storeId={store.id}
      storeName={storeRow?.name ?? store.name}
      appUrl={appUrl.replace(/\/$/, '')}
      initialSettings={settings}
      initialPrinters={(printers as ThermalPrinterRecord[]) ?? []}
      initialJobs={(jobs as PrintJobRecord[]) ?? []}
    />
  );
}
