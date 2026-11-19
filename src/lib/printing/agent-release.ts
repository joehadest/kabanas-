/**
 * Publicação do instalador do Kabanas Impressão (agente do caixa).
 *
 * O `.exe` fica nos Releases do GitHub deste repositório (público, sem limite
 * de tamanho prático e com URL estável). Cada versão é um release com a tag
 * `print-agent-vX.Y.Z` e o arquivo `KabanasImpressao-Setup-X.Y.Z.exe` anexado.
 * A rota `/api/print-agent/latest` escolhe o release mais novo e o agente
 * instalado no caixa consulta essa rota para se atualizar.
 */
export const PRINT_AGENT_RELEASES_REPO = 'joehadest/kabanas-';
export const PRINT_AGENT_TAG_PREFIX = 'print-agent-v';
export const PRINT_AGENT_INSTALLER_PATTERN = /^KabanasImpressao-Setup-.+\.exe$/i;

/** Primeira versão que informa a versão no /health e se atualiza sozinha. */
export const PRINT_AGENT_SELF_UPDATE_SINCE = '1.2.0';

export interface PrintAgentRelease {
  version: string;
  url: string;
  size: number | null;
  sha256: string | null;
  published_at: string | null;
  notes: string | null;
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
  digest?: string | null;
  state?: string;
}

export interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  body?: string | null;
  assets?: GitHubReleaseAsset[];
}

function parseVersion(version: string): number[] | null {
  const match = String(version ?? '')
    .trim()
    .replace(/^v/i, '')
    .match(/^\d+(?:\.\d+)*/);
  return match ? match[0].split('.').map(Number) : null;
}

/** Compara versões numéricas (1.10.0 > 1.9.3). Retorna <0, 0 ou >0. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a) ?? [0];
  const pb = parseVersion(b) ?? [0];
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isValidVersion(version: string): boolean {
  return parseVersion(version) !== null;
}

/** Escolhe o release publicado mais novo do agente que tenha o instalador anexado. */
export function pickLatestRelease(releases: GitHubRelease[]): PrintAgentRelease | null {
  let best: PrintAgentRelease | null = null;

  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    if (!release.tag_name?.startsWith(PRINT_AGENT_TAG_PREFIX)) continue;
    const version = release.tag_name.slice(PRINT_AGENT_TAG_PREFIX.length);
    if (!isValidVersion(version)) continue;

    const asset = release.assets?.find(
      (item) => PRINT_AGENT_INSTALLER_PATTERN.test(item.name) && (!item.state || item.state === 'uploaded')
    );
    if (!asset?.browser_download_url) continue;

    const sha256 = asset.digest?.startsWith('sha256:') ? asset.digest.slice('sha256:'.length).toLowerCase() : null;
    const candidate: PrintAgentRelease = {
      version,
      url: asset.browser_download_url,
      size: typeof asset.size === 'number' && asset.size > 0 ? asset.size : null,
      sha256: sha256 && /^[a-f0-9]{64}$/.test(sha256) ? sha256 : null,
      published_at: release.published_at ?? null,
      notes: release.body?.trim().slice(0, 600) || null,
    };

    if (!best || compareVersions(candidate.version, best.version) > 0) best = candidate;
  }

  return best;
}
