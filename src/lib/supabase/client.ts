import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';
import { GUEST_ID_HEADER } from '@/lib/guest/constants';
import { getGuestId } from '@/lib/guest/get-guest-id';

export function createClient() {
  const guestId = getGuestId();

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    guestId ? { global: { headers: { [GUEST_ID_HEADER]: guestId } } } : undefined
  );
}
