import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { CheckoutForm } from '@/components/customer/CheckoutForm';
import { GUEST_ID_COOKIE } from '@/lib/guest/constants';
import type { Address } from '@/lib/types/database';

export default async function CheckoutPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Login é opcional (só via botão no header). Sem conta, o pedido é
  // amarrado ao guest_id do cookie — o middleware garante que ele existe.
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value ?? null;

  const store = await getActiveStore();
  if (!store) redirect('/');

  // RLS já filtra pelo dono certo (auth.uid() se logado, guest_id se visitante).
  const { data: addresses } = await supabase.from('addresses').select('*').order('is_default', { ascending: false }).returns<Address[]>();

  return <CheckoutForm store={store} addresses={addresses ?? []} userId={user?.id ?? null} guestId={guestId} />;
}
