import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PainelShell } from '@/components/admin/PainelShell';

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/entrar?redirect=/painel/pedidos');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'restaurant')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1c1d1a] px-6 text-center">
        <div className="max-w-sm">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">Acesso restrito</p>
          <h1 className="mb-2 font-serif text-2xl font-bold text-white">Esta conta não tem permissão de operador</h1>
          <p className="text-sm text-neutral-400">
            {user.email} está logado, mas sem o papel de admin/operador. Peça para um administrador liberar seu acesso.
          </p>
        </div>
      </div>
    );
  }

  return <PainelShell userEmail={user.email ?? ''}>{children}</PainelShell>;
}
