import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { GUEST_ID_COOKIE, GUEST_ID_MAX_AGE } from '@/lib/guest/constants';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isStaffRoute = path.startsWith('/painel') || path.startsWith('/admin');

  if (isStaffRoute && !user) {
    const redirectUrl = new URL('/entrar', request.url);
    redirectUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(redirectUrl);
  }

  // Checkout de visitante: garante um guest_id estável (cookie) mesmo sem
  // login. É enviado como header x-guest-id em toda chamada ao Supabase e
  // lido nas policies de RLS via requesting_guest_id() — ver schema.sql.
  if (!request.cookies.get(GUEST_ID_COOKIE)) {
    response.cookies.set(GUEST_ID_COOKIE, crypto.randomUUID(), {
      maxAge: GUEST_ID_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
  }

  return response;
}
