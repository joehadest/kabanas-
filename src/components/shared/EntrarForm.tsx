'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { BRAND } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  storeName?: string | null;
  logoUrl?: string | null;
}

export function EntrarForm({ storeName, logoUrl }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const name = storeName || BRAND.name;
  const redirectTo = searchParams.get('redirect') || '/';
  const isStaffRedirect = redirectTo.startsWith('/painel') || redirectTo.startsWith('/admin');
  const linkError = searchParams.get('error');

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError('E-mail ou senha incorretos.');
      return;
    }
    router.push(redirectTo);
    router.refresh();
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const callbackUrl = `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Background decorativo */}
      <div className="pointer-events-none absolute inset-0 bg-kabanas-charcoal" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(212,175,55,0.18),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative w-full max-w-md animate-scale-in">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-kabanas-dark shadow-glow-lg">
          <div className="flex flex-col items-center bg-gradient-to-br from-brand-400/12 via-transparent to-transparent px-6 pt-10 pb-6">
            {logoUrl ? (
              <StoreLogo logoUrl={logoUrl} name={name} size="lg" className="mb-5 shadow-glow-lg ring-2 ring-brand-400/40" />
            ) : (
              <KabanasLogo variant="badge" size="xl" className="mb-5" />
            )}
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">{BRAND.tagline}</p>
            <h1 className="mt-2 font-display text-2xl text-white">Entrar no {name}</h1>
            {isStaffRedirect && (
              <p className="mt-2 text-center text-sm leading-relaxed text-neutral-400">
                Acesso restrito à equipe. Entre com o e-mail e senha cadastrados pelo administrador.
              </p>
            )}
          </div>

          <div className="border-t border-white/10 px-6 pb-8 pt-6">
            {linkError && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-fade-in">
                {linkError}
              </div>
            )}

            {isStaffRedirect ? (
              <form onSubmit={handleStaffSubmit} className="space-y-4">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                />
                {error && <p className="text-xs text-red-500 animate-fade-in">{error}</p>}
                <Button type="submit" variant="brand" size="lg" fullWidth disabled={submitting}>
                  {submitting ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            ) : sent ? (
              <div className="rounded-xl border border-brand-400/30 bg-brand-400/10 px-4 py-4 text-sm text-brand-300 animate-fade-in">
                Link enviado para <strong>{email}</strong>. Confira sua caixa de entrada.
              </div>
            ) : (
              <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
                {error && <p className="text-xs text-red-500 animate-fade-in">{error}</p>}
                <Button type="submit" variant="brand" size="lg" fullWidth>
                  Enviar link de acesso
                </Button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          {BRAND.name} · Gestão e delivery
        </p>
      </div>
    </div>
  );
}
