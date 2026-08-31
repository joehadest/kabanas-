import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { GUEST_ID_COOKIE, GUEST_ID_MAX_AGE } from '@/lib/guest/constants';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isStaffRoute = path.startsWith('/painel') || path.startsWith('/admin');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    console.error('Supabase environment variables are not configured.');

    if (isStaffRoute) {
      const redirectUrl = new URL('/entrar', request.url);
      redirectUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
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

  let user = null;

  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (error) {
    console.error('Unable to validate the Supabase session in middleware.', error);

    if (isStaffRoute) {
      const redirectUrl = new URL('/entrar', request.url);
      redirectUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(redirectUrl);
    }
  }

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
