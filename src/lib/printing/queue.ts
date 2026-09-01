import { createClient } from '@/lib/supabase/client';
import type { PrintJobPayload, PrintJobType } from './types';

/** Acorda o agente local (ignora falha — o agente também faz polling). */
export async function notifyPrintAgent(agentUrl: string) {
  const base = agentUrl.replace(/\/$/, '');
  try {
    await fetch(`${base}/wake`, { method: 'POST', mode: 'no-cors', keepalive: true });
  } catch {
    // Agente offline ou CORS — polling assumirá depois
  }
}

export async function queuePrintJob(params: {
  storeId: string;
  tabId?: string | null;
  printerId?: string | null;
  jobType: PrintJobType;
  payload: PrintJobPayload;
  agentUrl?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      store_id: params.storeId,
      tab_id: params.tabId ?? null,
      printer_id: params.printerId ?? null,
      job_type: params.jobType,
      payload: params.payload,
      status: 'queued',
    })
    .select('id')
    .single();

  if (!error && params.agentUrl) {
    void notifyPrintAgent(params.agentUrl);
  }

  return { data, error };
}
