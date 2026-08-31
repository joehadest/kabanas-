import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Destino do link mágico (signInWithOtp). O @supabase/ssr usa PKCE: o e-mail
 * traz só um `code`, que precisa ser trocado por uma sessão de verdade aqui
 * — sem essa troca, o link "abre o site" mas nunca loga ninguém.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect_to') || '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/entrar?error=${encodeURIComponent('Link inválido ou expirado. Peça um novo.')}`);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
