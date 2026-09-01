'use client';

import { FormEvent, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, parseDecimal } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter } from '@/components/ui/modal';
import { ShowMoreToggle, useLimitedList } from '@/components/ui/collapsible-list';
import { PageContainer, PageHeader, Panel } from '@/components/ui/page-layout';

interface Props {
  storeId: string;
  categories: { id: string; name: string }[];
  expenses: {
    id: string;
    description: string;
    amount: number;
    due_date: string;
    paid_at: string | null;
    recurrence: string;
    expense_type: string;
    expense_categories: { name: string } | { name: string }[] | null;
  }[];
}

export function ExpenseManager({ storeId, categories, expenses: initialExpenses }: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [expenses, setExpenses] = useState(initialExpenses);
  const expensesList = useLimitedList(expenses);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [type, setType] = useState('variable');
  const [recurrence, setRecurrence] = useState('once');
  const [pendingDelete, setPendingDelete] = useState<Props['expenses'][number] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = parseDecimal(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      showToast('Informe descrição e valor válido.', 'error');
      return;
    }
    const { data, error } = await createClient()
      .from('expenses')
      .insert({
        store_id: storeId,
        category_id: categoryId || null,
        description: description.trim(),
        amount: value,
        due_date: dueDate,
        expense_type: type,
        recurrence,
      })
      .select('*, expense_categories(name)')
      .single();
    if (error || !data) {
      showToast('Não foi possível salvar a despesa.', 'error');
      return;
    }
    setExpenses((previous) => [data, ...previous]);
    setDescription('');
    setAmount('');
    showToast('Despesa adicionada à agenda.', 'success');
  };

  const pay = async (id: string) => {
    const { error } = await createClient().from('expenses').update({ paid_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      showToast('Não foi possível marcar como paga.', 'error');
      return;
    }
    setExpenses((previous) =>
      previous.map((expense) =>
        expense.id === id ? { ...expense, paid_at: new Date().toISOString() } : expense
      )
    );
    showToast('Despesa marcada como paga.', 'success');
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await createClient().from('expenses').delete().eq('id', pendingDelete.id);
    setDeleting(false);
    if (error) {
      showToast('Não foi possível excluir a despesa.', 'error');
      return;
    }
    setExpenses((previous) => previous.filter((item) => item.id !== pendingDelete.id));
    setPendingDelete(null);
    showToast('Despesa removida.', 'success');
  };

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader eyebrow="Contas a pagar" title="Despesas sob controle" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Nova despesa" noPadding>
          <form onSubmit={submit} className="space-y-4 p-5">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Aluguel da loja" />
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor em R$" inputMode="decimal" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="variable">Variável</option>
                <option value="fixed">Fixa</option>
              </Select>
              <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                <option value="once">Única</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </Select>
            </div>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
            <FieldGroup label="Vencimento">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FieldGroup>
            <Button type="submit" variant="primary" size="lg" fullWidth>
              Adicionar despesa
            </Button>
          </form>
        </Panel>

        <Panel title="Agenda financeira" noPadding>
          {expenses.length ? (
            <>
              <div className="divide-y divide-border">
                {expensesList.visible.map((expense) => (
                  <div key={expense.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-white/5 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{expense.description}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {(Array.isArray(expense.expense_categories)
                          ? expense.expense_categories[0]?.name
                          : expense.expense_categories?.name) || 'Sem categoria'} · vence em{' '}
                        {new Date(`${expense.due_date}T12:00:00`).toLocaleDateString('pt-BR')} ·{' '}
                        {expense.recurrence === 'monthly' ? 'mensal' : expense.recurrence === 'weekly' ? 'semanal' : 'única'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-red-400">{formatCurrency(expense.amount)}</p>
                      {expense.paid_at ? (
                        <span className="inline-block rounded-lg bg-brand-400/10 px-2 py-0.5 text-xs font-bold text-brand-300">Paga</span>
                      ) : (
                        <button
                          onClick={() => pay(expense.id)}
                          className="mt-1 text-xs font-bold text-brand-300 underline-offset-2 hover:underline"
                        >
                          Marcar como paga
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      title="Excluir despesa"
                      onClick={() => setPendingDelete(expense)}
                      className="shrink-0 rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <ShowMoreToggle
                hiddenCount={expensesList.hiddenCount}
                showingAll={expensesList.showAll}
                onToggle={expensesList.toggle}
                className="mx-4 mb-4"
              />
            </>
          ) : (
            <p className="p-7 text-sm text-neutral-500">Nenhuma despesa cadastrada.</p>
          )}
        </Panel>
      </div>

      {pendingDelete && (
        <Modal
          onClose={() => setPendingDelete(null)}
          title="Excluir despesa"
          subtitle={pendingDelete.description}
          description="Essa ação não pode ser desfeita."
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setPendingDelete(null)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="danger" size="md" onClick={remove} disabled={deleting} className="normal-case">
                {deleting ? 'Excluindo...' : 'Excluir despesa'}
              </Button>
            </ModalFooter>
          }
        >
          <ModalAlert variant="warning">A despesa será removida permanentemente da agenda.</ModalAlert>
        </Modal>
      )}

      <FloatingToast toast={toast} onClose={clearToast} />
    </PageContainer>
  );
}
