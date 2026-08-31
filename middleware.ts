import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // /painel e /admin: protegidos (checagem de staff). / e /checkout: onde o
  // cookie guest_id do checkout de visitante precisa existir.
  matcher: ['/painel/:path*', '/admin/:path*', '/', '/checkout'],
};
