import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';
import { GUEST_ID_COOKIE, GUEST_ID_HEADER } from '@/lib/guest/constants';

export async function createClient() {
  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: guestId ? { headers: { [GUEST_ID_HEADER]: guestId } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado a partir de um Server Component — middleware cuida do refresh de sessão
          }
        },
      },
    }
  );
}
