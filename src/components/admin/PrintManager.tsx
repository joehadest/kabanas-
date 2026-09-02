'use client';

import { FormEvent, memo, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Printer, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SAMPLE_CUSTOMER, SAMPLE_KITCHEN } from '@/lib/printing/samples';
import type {
  CustomerReceiptPayload,
  KitchenTicketPayload,
  PrintJobRecord,
  PrintJobType,
  PrintSettings,
  ThermalPrinterRecord,
} from '@/lib/printing/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { Alert, PageContainer, PageHeader, Panel } from '@/components/ui/page-layout';
import { PrintPreview } from './PrintPreview';
import { cn } from '@/lib/utils';

interface Props {
  storeId: string;
  storeName: string;
  appUrl: string;
  initialSettings: PrintSettings;
  initialPrinters: ThermalPrinterRecord[];
  initialJobs: PrintJobRecord[];
}

const JOB_LABELS: Record<PrintJobType, string> = {
  kitchen_ticket: 'Cozinha / Bar',
  customer_receipt: 'Conta do cliente',
  cash_report: 'Fechamento de caixa',
};

const STATUS_LABELS: Record<PrintJobRecord['status'], string> = {
  queued: 'Na fila',
  printing: 'Imprimindo',
  printed: 'Impresso',
  failed: 'Falhou',
};

function jobPayload(job: PrintJobRecord): KitchenTicketPayload | CustomerReceiptPayload {
  return (job.payload ?? {}) as KitchenTicketPayload | CustomerReceiptPayload;
}

const JOB_LIST_SELECT = 'id,job_type,status,error_message,created_at,printed_at,thermal_printers(name)';

const PrintJobRow = memo(function PrintJobRow({
  job,
  onPreview,
  onDelete,
}: {
  job: PrintJobRecord;
  onPreview: (job: PrintJobRecord) => void;
  onDelete: (job: PrintJobRecord) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{JOB_LABELS[job.job_type]}</p>
        <p className="text-xs text-neutral-500">{new Date(job.created_at).toLocaleString('pt-BR')}</p>
        {job.error_message && <p className="text-xs text-red-400">{job.error_message}</p>}
      </div>
      <span
        className={cn(
          'rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase',
          job.status === 'printed'
            ? 'bg-brand-400/10 text-brand-300'
            : job.status === 'failed'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-amber-500/10 text-amber-400'
        )}
      >
        {STATUS_LABELS[job.status]}
      </span>
      <Button variant="ghost" size="sm" onClick={() => onPreview(job)} className="normal-case">
        <Eye size={14} /> Prévia
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(job)}
        className="normal-case text-red-400 hover:text-red-300"
        aria-label={`Remover ${JOB_LABELS[job.job_type]}`}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
});

export function PrintManager({
  storeId,
  storeName,
  appUrl,
  initialSettings,
  initialPrinters,
  initialJobs,
}: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [settings, setSettings] = useState(initialSettings);
  const [printers, setPrinters] = useState(initialPrinters);
  const [jobs, setJobs] = useState(initialJobs);
  const [savingSettings, setSavingSettings] = useState(false);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [previewType, setPreviewType] = useState<'kitchen_ticket' | 'customer_receipt'>('kitchen_ticket');
  const [previewJob, setPreviewJob] = useState<PrintJobRecord | null>(null);
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const [jobToDelete, setJobToDelete] = useState<PrintJobRecord | null>(null);
  const [clearQueueOpen, setClearQueueOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  const queuedCount = useMemo(() => jobs.filter((job) => job.status === 'queued' || job.status === 'printing').length, [jobs]);

  const previewPayload = useMemo(() => {
    if (previewJob) return jobPayload(previewJob);
    return previewType === 'kitchen_ticket' ? { ...SAMPLE_KITCHEN, tab: 'Mesa demo' } : { ...SAMPLE_CUSTOMER, store_name: storeName };
  }, [previewJob, previewType, storeName]);

  const checkAgent = useCallback(async () => {
    const base = settings.print_agent_url.replace(/\/$/, '');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      await fetch(`${base}/health`, { signal: controller.signal, mode: 'cors' });
      clearTimeout(timeout);
      setAgentOnline(true);
    } catch {
      setAgentOnline(false);
    }
  }, [settings.print_agent_url]);

  useEffect(() => {
    void checkAgent();
    const interval = setInterval(() => void checkAgent(), 15000);
    return () => clearInterval(interval);
  }, [checkAgent]);

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setSavingSettings(true);
    const { error } = await createClient()
      .from('store_settings')
      .update({
        auto_print_kitchen: settings.auto_print_kitchen,
        auto_print_customer: settings.auto_print_customer,
        print_agent_url: settings.print_agent_url.trim() || 'http://127.0.0.1:9100',
        print_agent_secret: settings.print_agent_secret,
      })
      .eq('id', storeId);
    setSavingSettings(false);
    if (error) {
      showToast('Não foi possível salvar as configurações.', 'error');
      return;
    }
    showToast('Configurações de impressão salvas.', 'success');
  };

  const generateSecret = () => {
    const secret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    setSettings((prev) => ({ ...prev, print_agent_secret: secret }));
    showToast('Novo token gerado. Salve e configure no agente .exe.', 'info');
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copiado.`, 'success');
    } catch {
      showToast('Não foi possível copiar.', 'error');
    }
  };

  const refreshJobs = async () => {
    const { data, error } = await createClient()
      .from('print_jobs')
      .select(JOB_LIST_SELECT)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) {
      showToast('Não foi possível atualizar a fila.', 'error');
      return;
    }
    setJobs((data as PrintJobRecord[]) ?? []);
  };

  const openPreview = useCallback(
    async (job: PrintJobRecord) => {
      if (job.payload) {
        setPreviewJob(job);
        return;
      }
      setLoadingPreviewId(job.id);
      const { data, error } = await createClient().from('print_jobs').select('payload').eq('id', job.id).single();
      setLoadingPreviewId(null);
      if (error || !data?.payload) {
        showToast('Não foi possível carregar a prévia.', 'error');
        return;
      }
      setPreviewJob({ ...job, payload: data.payload as PrintJobRecord['payload'] });
    },
    [showToast]
  );

  const requestDeleteJob = useCallback((job: PrintJobRecord) => {
    startTransition(() => setJobToDelete(job));
  }, []);

  const requestClearQueue = useCallback(() => {
    startTransition(() => setClearQueueOpen(true));
  }, []);

  const removeJob = async (job: PrintJobRecord) => {
    setDeleting(true);
    const { error } = await createClient().from('print_jobs').delete().eq('id', job.id).eq('store_id', storeId);
    setDeleting(false);
    if (error) {
      showToast('Não foi possível remover o job da fila.', 'error');
      return;
    }
    setJobs((prev) => prev.filter((item) => item.id !== job.id));
    if (previewJob?.id === job.id) setPreviewJob(null);
    setJobToDelete(null);
    showToast('Job removido da fila.', 'success');
  };

  const clearPendingQueue = async () => {
    setDeleting(true);
    const pendingIds = jobs.filter((job) => job.status === 'queued' || job.status === 'printing').map((job) => job.id);
    if (!pendingIds.length) {
      setDeleting(false);
      setClearQueueOpen(false);
      return;
    }
    const { error } = await createClient().from('print_jobs').delete().eq('store_id', storeId).in('id', pendingIds);
    setDeleting(false);
    if (error) {
      showToast('Não foi possível limpar a fila.', 'error');
      return;
    }
    setJobs((prev) => prev.filter((job) => job.status !== 'queued' && job.status !== 'printing'));
    setClearQueueOpen(false);
    showToast(`${pendingIds.length} job(s) removido(s) da fila.`, 'success');
  };

  const addPrinter = async () => {
    const { data, error } = await createClient()
      .from('thermal_printers')
      .insert({
        store_id: storeId,
        name: 'Impressora cozinha',
        connection_type: 'local_agent',
        purpose: 'kitchen',
        paper_width: 80,
        is_active: true,
      })
      .select('*')
      .single();
    if (error || !data) {
      showToast('Não foi possível adicionar impressora.', 'error');
      return;
    }
    setPrinters((prev) => [...prev, data as ThermalPrinterRecord]);
    showToast('Impressora adicionada.', 'success');
  };

  const apiPollUrl = `${appUrl}/api/print-agent/jobs?store_id=${storeId}`;

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Impressão térmica"
        title="Impressão"
        description="Ficha de cozinha e conta do cliente. O navegador não imprime sozinho — use o Kabanas Print Agent (.exe) no caixa."
        action={
          <Button variant="secondary" size="md" onClick={() => void refreshJobs()} className="normal-case">
            <RefreshCw size={16} />
            Atualizar fila
          </Button>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel title="Impressão automática" eyebrow="PDV" noPadding>
            <form onSubmit={saveSettings} className="space-y-4 p-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3">
                <input
                  type="checkbox"
                  checked={settings.auto_print_kitchen}
                  onChange={(e) => setSettings((s) => ({ ...s, auto_print_kitchen: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">Cozinha automática</span>
                  <span className="text-xs text-neutral-500">
                    Enfileira ficha de cozinha ao lançar cada item no PDV (requer agente rodando).
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3">
                <input
                  type="checkbox"
                  checked={settings.auto_print_customer}
                  onChange={(e) => setSettings((s) => ({ ...s, auto_print_customer: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">Conta do cliente automática</span>
                  <span className="text-xs text-neutral-500">
                    Enfileira a conta ao fechar a comanda no PDV.
                  </span>
                </span>
              </label>

              <FieldGroup label="URL do agente local">
                <Input
                  value={settings.print_agent_url}
                  onChange={(e) => setSettings((s) => ({ ...s, print_agent_url: e.target.value }))}
                  placeholder="http://127.0.0.1:9100"
                />
              </FieldGroup>

              <div className="flex items-center gap-2 text-sm">
                {agentOnline === true && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-brand-300">
                    <Wifi size={16} /> Agente online
                  </span>
                )}
                {agentOnline === false && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-400">
                    <WifiOff size={16} /> Agente offline — instale e inicie o .exe no caixa
                  </span>
                )}
                <button type="button" onClick={() => void checkAgent()} className="text-xs text-neutral-500 underline">
                  Testar conexão
                </button>
              </div>

              <FieldGroup label="Token do agente (Bearer)">
                <div className="flex gap-2">
                  <Input
                    value={settings.print_agent_secret ?? ''}
                    onChange={(e) => setSettings((s) => ({ ...s, print_agent_secret: e.target.value }))}
                    placeholder="Gere um token e cole no agente"
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="secondary" size="md" onClick={generateSecret} className="shrink-0 normal-case">
                    Gerar
                  </Button>
                </div>
              </FieldGroup>

              <Alert variant="info">
                O agente consulta <code className="text-xs">{apiPollUrl}</code> a cada poucos segundos com o header{' '}
                <code className="text-xs">Authorization: Bearer &lt;token&gt;</code>. Veja a pasta{' '}
                <code className="text-xs">print-agent/</code> no projeto.
              </Alert>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyText(apiPollUrl, 'URL da API')}>
                  <Copy size={14} /> URL polling
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(settings.print_agent_secret ?? '', 'Token')}
                  disabled={!settings.print_agent_secret}
                >
                  <Copy size={14} /> Token
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void copyText(storeId, 'Store ID')}>
                  <Copy size={14} /> Store ID
                </Button>
              </div>

              <Button type="submit" variant="brand" size="md" disabled={savingSettings} className="normal-case">
                {savingSettings ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </form>
          </Panel>

          <Panel
            title="Impressoras"
            eyebrow="Destinos"
            noPadding
            action={
              <Button variant="secondary" size="sm" onClick={() => void addPrinter()} className="normal-case">
                <Printer size={14} /> Adicionar
              </Button>
            }
          >
            {printers.length ? (
              <div className="divide-y divide-border">
                {printers.map((printer) => (
                  <div key={printer.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="font-semibold text-ink">{printer.name}</p>
                      <p className="text-xs text-neutral-500">
                        {printer.purpose === 'kitchen' ? 'Cozinha' : printer.purpose === 'bar' ? 'Bar' : 'Caixa'} ·{' '}
                        {printer.paper_width}mm · {printer.connection_type}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase',
                        printer.is_active ? 'bg-brand-400/10 text-brand-300' : 'bg-neutral-800 text-neutral-500'
                      )}
                    >
                      {printer.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-6 text-sm text-neutral-500">Nenhuma impressora cadastrada. O agente pode usar a impressora padrão do Windows.</p>
            )}
          </Panel>

          <Panel
            title="Fila de impressão"
            eyebrow="Últimos jobs"
            noPadding
            action={
              queuedCount > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestClearQueue}
                  className="normal-case text-red-300 hover:border-red-400/50 hover:text-red-200"
                >
                  <Trash2 size={14} /> Limpar pendentes ({queuedCount})
                </Button>
              ) : undefined
            }
          >
            {jobs.length ? (
              <div className="divide-y divide-border">
                {jobs.map((job) => (
                  <PrintJobRow key={job.id} job={job} onPreview={(item) => void openPreview(item)} onDelete={requestDeleteJob} />
                ))}
              </div>
            ) : (
              <p className="p-6 text-sm text-neutral-500">
                Fila vazia. Use Imprimir cozinha / Imprimir conta no PDV ou ative a impressão automática.
              </p>
            )}
          </Panel>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Prévia térmica" eyebrow="Visualização" noPadding>
            <div className="space-y-4 p-5">
              {!previewJob && (
                <div className="flex gap-1 rounded-xl border border-border bg-black/40 p-1">
                  {(['kitchen_ticket', 'customer_receipt'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPreviewType(type)}
                      className={cn(
                        'flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wide',
                        previewType === type ? 'bg-brand-600 text-white' : 'text-neutral-400'
                      )}
                    >
                      {type === 'kitchen_ticket' ? 'Cozinha' : 'Cliente'}
                    </button>
                  ))}
                </div>
              )}
              {previewJob && (
                <button
                  type="button"
                  onClick={() => setPreviewJob(null)}
                  className="text-xs font-bold text-brand-300 hover:underline"
                >
                  ← Voltar aos exemplos
                </button>
              )}
              <FieldGroup label="Largura do papel">
                <Select value={String(paperWidth)} onChange={(e) => setPaperWidth(Number(e.target.value) as 58 | 80)}>
                  <option value="80">80 mm (padrão)</option>
                  <option value="58">58 mm</option>
                </Select>
              </FieldGroup>
              <PrintPreview jobType={previewJob?.job_type ?? previewType} payload={previewPayload} paperWidth={paperWidth} />
              <p className="text-center text-[10px] text-neutral-500">
                A prévia é aproximada. O agente envia ESC/POS para a impressora física.
              </p>
            </div>
          </Panel>
        </aside>
      </div>

      {previewJob && (
        <Modal
          open
          onClose={() => setPreviewJob(null)}
          title={JOB_LABELS[previewJob.job_type]}
          size="sm"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" onClick={() => setPreviewJob(null)} className="normal-case">
                Fechar
              </Button>
            </ModalFooter>
          }
        >
          <PrintPreview jobType={previewJob.job_type} payload={jobPayload(previewJob)} paperWidth={paperWidth} />
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(jobToDelete)}
        title="Remover da fila"
        description={
          jobToDelete ? (
            <>
              Remover <strong className="text-ink">{JOB_LABELS[jobToDelete.job_type]}</strong> de{' '}
              {new Date(jobToDelete.created_at).toLocaleString('pt-BR')}?{' '}
              {jobToDelete.status === 'queued' || jobToDelete.status === 'printing'
                ? 'O agente não imprimirá este pedido.'
                : 'O registro será apagado do histórico.'}
            </>
          ) : null
        }
        confirmLabel="Remover"
        confirming={deleting}
        destructive
        onCancel={() => setJobToDelete(null)}
        onConfirm={() => jobToDelete && void removeJob(jobToDelete)}
      />

      <ConfirmDialog
        open={clearQueueOpen}
        title="Limpar fila pendente"
        description={
          <>
            Remover <strong className="text-ink">{queuedCount}</strong> job(s) aguardando impressão? Jobs já impressos ou com
            falha permanecem na lista.
          </>
        }
        confirmLabel="Limpar pendentes"
        confirming={deleting}
        destructive
        onCancel={() => setClearQueueOpen(false)}
        onConfirm={() => void clearPendingQueue()}
      />

      {loadingPreviewId && (
        <p className="sr-only" role="status">
          Carregando prévia...
        </p>
      )}

      <FloatingToast toast={toast} onClose={clearToast} />
    </PageContainer>
  );
}
