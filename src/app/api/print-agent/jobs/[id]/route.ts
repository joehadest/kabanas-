import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyAgentForJob(request: NextRequest, jobId: string) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { error: NextResponse.json({ error: 'Token ausente' }, { status: 401 }) };

  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: 'Service role não configurada no servidor' }, { status: 503 }) };
  }

  const { data: job, error: jobError } = await admin
    .from('print_jobs')
    .select('id,store_id')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return { error: NextResponse.json({ error: 'Job não encontrado' }, { status: 404 }) };
  }

  const { data: store, error: storeError } = await admin
    .from('store_settings')
    .select('print_agent_secret')
    .eq('id', job.store_id)
    .single();

  if (storeError || !store?.print_agent_secret || store.print_agent_secret !== token) {
    return { error: NextResponse.json({ error: 'Token inválido' }, { status: 403 }) };
  }

  return { admin, jobId };
}

/** Agente confirma impressão — PATCH /api/print-agent/jobs/[id] */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await context.params;
  const verified = await verifyAgentForJob(request, jobId);
  if ('error' in verified && verified.error) return verified.error;
  const { admin } = verified as { admin: NonNullable<ReturnType<typeof createAdminClient>>; jobId: string };

  let body: { status?: string; error_message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const status = body.status;
  if (status !== 'printed' && status !== 'failed' && status !== 'printing') {
    return NextResponse.json({ error: 'status deve ser printing, printed ou failed' }, { status: 400 });
  }

  const { error } = await admin
    .from('print_jobs')
    .update({
      status,
      error_message: body.error_message ?? null,
      printed_at: status === 'printed' ? new Date().toISOString() : null,
    })
    .eq('id', jobId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: jobId, status });
}
