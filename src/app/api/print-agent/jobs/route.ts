import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyAgent(request: NextRequest, storeId: string) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { error: NextResponse.json({ error: 'Token ausente' }, { status: 401 }) };

  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: 'Service role não configurada no servidor' }, { status: 503 }) };
  }

  const { data: store, error } = await admin
    .from('store_settings')
    .select('id,print_agent_secret')
    .eq('id', storeId)
    .single();

  if (error || !store?.print_agent_secret || store.print_agent_secret !== token) {
    return { error: NextResponse.json({ error: 'Token inválido' }, { status: 403 }) };
  }

  return { admin };
}

/** Agente local (.exe) busca jobs pendentes — GET /api/print-agent/jobs?store_id=... */
export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get('store_id');
  if (!storeId) {
    return NextResponse.json({ error: 'store_id obrigatório' }, { status: 400 });
  }

  const verified = await verifyAgent(request, storeId);
  if ('error' in verified && verified.error) return verified.error;
  const { admin } = verified as { admin: NonNullable<ReturnType<typeof createAdminClient>> };

  const limit = Math.min(20, Number(request.nextUrl.searchParams.get('limit') || 10));

  const { data: jobs, error } = await admin
    .from('print_jobs')
    .select('id,job_type,status,payload,created_at,printer_id,thermal_printers(name,purpose,paper_width,endpoint)')
    .eq('store_id', storeId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: jobs ?? [], polled_at: new Date().toISOString() });
}
