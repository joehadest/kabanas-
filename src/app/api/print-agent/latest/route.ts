import { NextResponse } from 'next/server';
import {
  PRINT_AGENT_RELEASES_REPO,
  pickLatestRelease,
  type GitHubRelease,
  type PrintAgentRelease,
} from '@/lib/printing/agent-release';

export const dynamic = 'force-dynamic';

const CACHE_SECONDS = 300;

// Última resposta boa desta instância: segura limites/instabilidade da API do GitHub.
let lastGood: { release: PrintAgentRelease; at: number } | null = null;

async function fetchLatestRelease(): Promise<PrintAgentRelease | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'print-agent-update-feed',
  };
  const token = process.env.PRINT_AGENT_GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`https://api.github.com/repos/${PRINT_AGENT_RELEASES_REPO}/releases?per_page=30`, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`GitHub respondeu ${response.status}`);
  return pickLatestRelease((await response.json()) as GitHubRelease[]);
}

/**
 * Versão mais recente do Kabanas Impressão — GET /api/print-agent/latest
 * Público: o agente do caixa consulta para saber se há atualização.
 */
export async function GET() {
  let release: PrintAgentRelease | null = null;
  try {
    release = await fetchLatestRelease();
    if (release) lastGood = { release, at: Date.now() };
  } catch (error) {
    if (lastGood && Date.now() - lastGood.at < 24 * 60 * 60 * 1000) {
      release = lastGood.release;
    } else {
      return NextResponse.json(
        { error: 'Não foi possível consultar a versão mais recente', detail: String((error as Error).message || error) },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  if (!release) {
    return NextResponse.json(
      { error: 'Nenhuma versão publicada' },
      { status: 404, headers: { 'Cache-Control': `public, s-maxage=${CACHE_SECONDS}` } }
    );
  }

  return NextResponse.json(release, {
    headers: {
      'Cache-Control': `public, max-age=60, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`,
    },
  });
}
