'use client';

import { FormEvent, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, LockKeyhole, WalletCards } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';

type Session = { id: string; terminal_name: string; opening_balance: number; opened_at: string; status: 'open' | 'closed'; expected_cash: number | null; counted_cash: number | null; difference: number | null; cash_movements: { movement_type: string; amount: number; reason: string; created_at: string }[] };
interface Props { storeId: string; operatorId: string; sessions: Session[]; }

export function CashRegister({ storeId, operatorId, sessions: initialSessions }: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [terminal, setTerminal] = useState('Caixa principal');
  const [opening, setOpening] = useState('0');
  const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_out');
  const [movementAmount, setMovementAmount] = useState('');
  const [reason, setReason] = useState('');
  const [counted, setCounted] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const active = sessions.find((session) => session.status === 'open');

  const open = async (event: FormEvent) => {
    event.preventDefault();
    const { data, error } = await createClient().from('cash_sessions').insert({ store_id: storeId, operator_id: operatorId, terminal_name: terminal.trim() || 'Caixa principal', opening_balance: Number(opening) || 0 }).select('id,terminal_name,opening_balance,opened_at,status,expected_cash,counted_cash,difference,profiles(full_name),cash_movements(movement_type,amount,reason,created_at)').single();
    if (error || !data) { setMessage('Não foi possível abrir. Você já pode ter um caixa aberto neste terminal.'); return; }
    setSessions((current) => [data, ...current]); setMessage('Caixa aberto. As próximas vendas ficarão vinculadas a este turno.');
  };

  const movement = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || Number(movementAmount) <= 0 || !reason.trim()) { setMessage('Informe valor e motivo da movimentação.'); return; }
    const { data, error } = await createClient().from('cash_movements').insert({ cash_session_id: active.id, movement_type: movementType, amount: Number(movementAmount), reason: reason.trim(), created_by: operatorId }).select('movement_type,amount,reason,created_at').single();
    if (error || !data) { setMessage('Não foi possível registrar a movimentação.'); return; }
    setSessions((current) => current.map((session) => session.id === active.id ? { ...session, cash_movements: [data, ...session.cash_movements] } : session)); setMovementAmount(''); setReason(''); setMessage(movementType === 'cash_out' ? 'Sangria registrada.' : 'Suprimento registrado.');
  };

  const close = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || counted === '') return;
    const { data, error } = await createClient().rpc('close_cash_session', { session_to_close: active.id, physical_cash: Number(counted), note: null }).single();
    if (error || !data) { setMessage(error?.message || 'Não foi possível fechar o caixa.'); return; }
    const result = data as { expected_cash: number; difference: number };
    setSessions((current) => current.map((session) => session.id === active.id ? { ...session, status: 'closed', expected_cash: result.expected_cash, counted_cash: Number(counted), difference: result.difference } : session));
    setMessage(`Caixa fechado. Diferença apurada: ${formatCurrency(result.difference)}.`);
  };

  return <div className="mx-auto max-w-6xl p-4 sm:p-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">Operação de caixa</p><h1 className="mt-2 font-serif text-3xl font-bold">Abertura e fechamento</h1><p className="mt-2 text-sm text-neutral-500">Vendas só podem ser registradas com um caixa aberto.</p></div><WalletCards className="hidden text-brand-300 sm:block" size={36} /></div>{message && <p className="mt-5 border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{message}</p>}{!active ? <form onSubmit={open} className="mt-6 max-w-xl border border-border bg-surface-elevated p-5"><h2 className="font-serif text-xl font-bold">Abrir um caixa</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-neutral-400">Terminal<input value={terminal} onChange={(event) => setTerminal(event.target.value)} className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-neutral-400">Fundo de troco<input value={opening} onChange={(event) => setOpening(event.target.value)} inputMode="decimal" className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2.5 text-sm" /></label></div><button className="mt-4 inline-flex items-center gap-2 bg-brand-600 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white"><LockKeyhole size={16} /> Abrir caixa</button></form> : <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.9fr]"><section className="border border-border bg-surface-elevated p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-brand-300">Caixa aberto</p><h2 className="mt-1 font-serif text-2xl font-bold">{active.terminal_name}</h2><p className="mt-1 text-sm text-neutral-500">Aberto em {new Date(active.opened_at).toLocaleString('pt-BR')} · fundo {formatCurrency(active.opening_balance)}</p><form onSubmit={movement} className="mt-5 border-t border-border pt-5"><h3 className="font-serif text-lg font-bold">Sangria ou suprimento</h3><div className="mt-3 grid gap-3 sm:grid-cols-[9rem_1fr]"><select value={movementType} onChange={(event) => setMovementType(event.target.value as 'cash_in' | 'cash_out')} className="border border-border bg-surface-elevated px-3 py-2.5 text-sm"><option value="cash_out">Sangria</option><option value="cash_in">Suprimento</option></select><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo" className="border border-border bg-surface-elevated px-3 py-2.5 text-sm" /></div><div className="mt-3 flex gap-3"><input value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} inputMode="decimal" placeholder="Valor em R$" className="min-w-0 flex-1 border border-border bg-surface-elevated px-3 py-2.5 text-sm" /><button className="bg-brand-700 px-4 py-2 text-xs font-bold text-neutral-950">Registrar</button></div></form><div className="mt-5 divide-y divide-border border-t border-border pt-2">{active.cash_movements.length ? active.cash_movements.map((item, index) => <div key={`${item.created_at}-${index}`} className="flex justify-between py-3 text-sm"><span>{item.movement_type === 'cash_out' ? 'Sangria' : 'Suprimento'} · {item.reason}</span><strong className={item.movement_type === 'cash_out' ? 'text-red-400' : 'text-brand-300'}>{item.movement_type === 'cash_out' ? '-' : '+'}{formatCurrency(item.amount)}</strong></div>) : <p className="py-4 text-sm text-neutral-500">Nenhuma movimentação neste turno.</p>}</div></section><section className="border border-brand-400/30 bg-brand-400/10 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-brand-300">Conferência</p><h2 className="mt-1 font-serif text-2xl font-bold text-brand-300">Fechar caixa</h2><p className="mt-3 text-sm text-brand-300">Informe o dinheiro contado fisicamente. O sistema compara com fundo, vendas em dinheiro, sangrias e suprimentos.</p><form onSubmit={close} className="mt-5"><label className="text-xs font-bold text-brand-300">Dinheiro contado<input value={counted} onChange={(event) => setCounted(event.target.value)} inputMode="decimal" placeholder="R$ 0,00" className="mt-1 w-full border border-brand-400/40 bg-surface-elevated px-3 py-2.5 text-sm text-ink" /></label><button className="mt-4 inline-flex items-center gap-2 bg-brand-700 px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-950"><ArrowDownToLine size={16} /> Conferir e fechar</button></form></section></div>}<section className="mt-7 overflow-hidden border border-border bg-surface-elevated"><div className="border-b border-border p-4"><h2 className="font-serif text-xl font-bold">Histórico de caixas</h2></div>{sessions.map((session) => <div key={session.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-border p-4 text-sm"><div><p className="font-semibold">{session.terminal_name}</p><p className="mt-1 text-xs text-neutral-500">{new Date(session.opened_at).toLocaleString('pt-BR')} · {session.status === 'open' ? 'Em operação' : 'Fechado'}</p></div>{session.status === 'closed' ? <div className="text-right"><p className="text-xs text-neutral-500">Diferença</p><strong className={Number(session.difference) === 0 ? 'text-brand-300' : 'text-red-400'}>{formatCurrency(Number(session.difference))}</strong></div> : <span className="text-xs font-bold text-brand-300">ABERTO</span>}</div>)}</section></div>;
}