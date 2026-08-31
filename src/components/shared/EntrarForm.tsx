'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { StoreLogo } from '@/components/shared/StoreLogo';

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

  const name = storeName || 'Kabanas Delivery';
  const redirectTo = searchParams.get('redirect') || '/';
  const isStaffRedirect = redirectTo.startsWith('/painel') || redirectTo.startsWith('/admin');
  const linkError = searchParams.get('error');

  // Equipe: e-mail e senha (contas criadas manualmente pelo admin no Supabase).
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

  // Cliente (opcional): link mágico por e-mail — não faz sentido pedir senha
  // de alguém que só quer salvar endereços/acompanhar pedidos.
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
    <div className="min-h-screen flex items-center justify-center px-6 bg-neutral-900">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-panel animate-scale-in">
        <StoreLogo logoUrl={logoUrl} name={name} size="md" className="mb-4" />
        <h1 className="text-lg font-bold text-neutral-900 mb-1">Entrar no {name}</h1>
        {isStaffRedirect && (
          <p className="mb-4 text-sm text-neutral-500">
            Acesso restrito à equipe. Entre com o e-mail e senha cadastrados pelo administrador.
          </p>
        )}
        {linkError && <p className="mb-4 text-sm text-red-500 bg-red-50 rounded-xl p-3 animate-fade-in">{linkError}</p>}

        {isStaffRedirect ? (
          <form onSubmit={handleStaffSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 transition-colors"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 transition-colors"
            />
            {error && <p className="text-xs text-red-500 animate-fade-in">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-brand-500 text-neutral-900 font-bold text-sm hover:bg-brand-400 hover:shadow-glow active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : sent ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-xl p-3 animate-fade-in">
            Link enviado para <strong>{email}</strong>. Confira sua caixa de entrada.
          </p>
        ) : (
          <form onSubmit={handleCustomerSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 transition-colors"
            />
            {error && <p className="text-xs text-red-500 animate-fade-in">{error}</p>}
            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-brand-500 text-neutral-900 font-bold text-sm hover:bg-brand-400 hover:shadow-glow active:scale-[0.98] transition-all"
            >
              Enviar link de acesso
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
