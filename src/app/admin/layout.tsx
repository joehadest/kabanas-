import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/entrar?redirect=/admin');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'restaurant')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center">
        <div className="max-w-md animate-scale-in rounded-3xl border border-white/10 bg-surface-elevated p-8 shadow-modal">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">Acesso restrito</p>
          <h1 className="mb-3 font-serif text-2xl font-bold text-ink">Esta conta não tem permissão de administrador</h1>
          <p className="text-sm leading-relaxed text-neutral-500">
            {user.email} está logado, mas sem o papel de admin/operador. Peça para um administrador liberar seu acesso.
          </p>
        </div>
      </div>
    );
  }

  return <AdminShell userEmail={user.email ?? ''}>{children}</AdminShell>;
}
