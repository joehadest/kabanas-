import { Suspense } from 'react';
import { getActiveStore } from '@/lib/data/get-store';
import { EntrarForm } from '@/components/shared/EntrarForm';

export default async function EntrarPage() {
  const store = await getActiveStore();

  return (
    <Suspense>
      <EntrarForm storeName={store?.name} logoUrl={store?.logo_url} />
    </Suspense>
  );
}
