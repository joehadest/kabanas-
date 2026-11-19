const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

// Só instaladores publicados nos Releases do repositório podem ser executados,
// mesmo que a rota de versão do site devolva outro endereço.
const RELEASE_DOWNLOAD_PREFIX = 'https://github.com/joehadest/kabanas-/releases/download/';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// Parâmetros do Inno Setup: sem telas, sem botão Cancelar, fecha o app aberto.
// O próprio instalador reabre o programa ao terminar (ver [Run] em build/installer.iss).
const INSTALLER_ARGS = ['/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOCANCEL', '/CLOSEAPPLICATIONS'];

function parseVersion(version) {
  const match = String(version ?? '')
    .trim()
    .replace(/^v/i, '')
    .match(/^\d+(?:\.\d+)*/);
  return match ? match[0].split('.').map(Number) : null;
}

function compareVersions(a, b) {
  const pa = parseVersion(a) ?? [0];
  const pb = parseVersion(b) ?? [0];
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isNewerVersion(candidate, current) {
  return parseVersion(candidate) !== null && compareVersions(candidate, current) > 0;
}

/** Aceita releases do GitHub do projeto; com o site rodando no próprio PC, aceita a mesma origem (testes). */
function isAllowedDownloadUrl(url, feedUrl) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:' && parsed.href.startsWith(RELEASE_DOWNLOAD_PREFIX)) return true;
  try {
    const feed = new URL(feedUrl);
    return LOOPBACK_HOSTS.has(feed.hostname) && parsed.origin === feed.origin;
  } catch {
    return false;
  }
}

function parseRelease(data) {
  if (!data || typeof data !== 'object') return null;
  const version = typeof data.version === 'string' ? data.version.trim() : '';
  const url = typeof data.url === 'string' ? data.url.trim() : '';
  if (!parseVersion(version) || !url) return null;
  return {
    version,
    url,
    size: Number.isFinite(data.size) && data.size > 0 ? data.size : null,
    sha256: typeof data.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(data.sha256) ? data.sha256.toLowerCase() : null,
  };
}

async function downloadInstaller({ url, version, destDir, expectedSize, expectedSha256, fetchImpl = fetch, onProgress }) {
  // Pasta exclusiva do atualizador: apaga instaladores de tentativas anteriores.
  await fs.promises.rm(destDir, { recursive: true, force: true });
  await fs.promises.mkdir(destDir, { recursive: true });
  const safeVersion = String(version).replace(/[^0-9A-Za-z.-]/g, '');
  const finalPath = path.join(destDir, `KabanasImpressao-Setup-${safeVersion}.exe`);
  const partPath = `${finalPath}.part`;

  const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error(`Download falhou (HTTP ${response.status})`);

  const total = Number(response.headers.get('content-length')) || expectedSize || 0;
  const hash = crypto.createHash('sha256');
  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      hash.update(chunk);
      onProgress?.({ received, total });
      callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(partPath));
    if (expectedSize && received !== expectedSize) {
      throw new Error('Download incompleto. Verifique a internet e tente de novo.');
    }
    if (expectedSha256 && hash.digest('hex') !== expectedSha256) {
      throw new Error('O arquivo baixado está corrompido. Tente de novo.');
    }
    const handle = await fs.promises.open(partPath, 'r');
    const header = Buffer.alloc(2);
    await handle.read(header, 0, 2, 0);
    await handle.close();
    if (header.toString('latin1') !== 'MZ') throw new Error('O arquivo baixado não é um instalador válido.');
    await fs.promises.rename(partPath, finalPath);
    return finalPath;
  } catch (error) {
    await fs.promises.rm(partPath, { force: true });
    throw error;
  }
}

function launchInstaller(installerPath, { logPath, spawnImpl = spawn } = {}) {
  const args = logPath ? [...INSTALLER_ARGS, `/LOG=${logPath}`] : [...INSTALLER_ARGS];
  return new Promise((resolve, reject) => {
    const child = spawnImpl(installerPath, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(child.pid);
    });
  });
}

function friendlyError(error) {
  const message = String(error?.message || error || '');
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|aborted|timeout/i.test(message)) {
    return 'Sem conexão com a internet. Verifique e tente de novo.';
  }
  return message || 'Erro desconhecido.';
}

/**
 * Consulta a rota de versão do site, baixa o instalador novo e o executa em modo silencioso.
 * Não depende do Electron para poder ser testado com `node --test`.
 */
class Updater extends EventEmitter {
  constructor({ currentVersion, getFeedUrl, downloadDir, logPath, fetchImpl = fetch, spawnImpl = spawn }) {
    super();
    this.currentVersion = currentVersion;
    this.getFeedUrl = getFeedUrl;
    this.downloadDir = downloadDir;
    this.logPath = logPath;
    this.fetchImpl = fetchImpl;
    this.spawnImpl = spawnImpl;
    this.release = null;
    this.checking = null;
    this.state = {
      status: 'idle',
      currentVersion,
      latestVersion: null,
      progress: null,
      error: null,
      checkError: null,
      checkedAt: null,
    };
  }

  getState() {
    return { ...this.state };
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.getState());
  }

  isBusy() {
    return this.state.status === 'downloading' || this.state.status === 'installing';
  }

  check() {
    if (this.isBusy()) return Promise.resolve(this.getState());
    if (!this.checking) {
      this.checking = this.runCheck().finally(() => {
        this.checking = null;
      });
    }
    return this.checking;
  }

  async runCheck() {
    const feedUrl = this.getFeedUrl();
    const hadRelease = Boolean(this.release);
    if (!hadRelease) this.setState({ status: 'checking' });
    try {
      const response = await this.fetchImpl(feedUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 404) {
        this.release = null;
        this.setState({ status: 'up-to-date', latestVersion: null, checkError: null, checkedAt: new Date().toISOString() });
        return this.getState();
      }
      if (!response.ok) throw new Error(`Servidor respondeu ${response.status}`);
      const release = parseRelease(await response.json());
      if (!release) throw new Error('Resposta inválida do servidor de atualização.');
      if (!isAllowedDownloadUrl(release.url, feedUrl)) {
        throw new Error('Endereço do instalador não autorizado.');
      }

      const checkedAt = new Date().toISOString();
      if (isNewerVersion(release.version, this.currentVersion)) {
        const keepError = this.state.status === 'error' && this.release?.version === release.version;
        this.release = release;
        this.setState({
          status: keepError ? 'error' : 'available',
          latestVersion: release.version,
          checkError: null,
          checkedAt,
        });
      } else {
        this.release = null;
        this.setState({ status: 'up-to-date', latestVersion: release.version, error: null, checkError: null, checkedAt });
      }
    } catch (error) {
      if (!this.isBusy()) {
        // Uma falha de rede não esconde uma atualização já encontrada antes.
        this.setState({
          status: this.release ? this.state.status : 'idle',
          checkError: friendlyError(error),
          checkedAt: new Date().toISOString(),
        });
      }
    }
    return this.getState();
  }

  /**
   * Baixa e executa o instalador. `beforeLaunch` roda depois do download e antes
   * de abrir o instalador (para parar a fila de impressão com segurança).
   */
  async install({ beforeLaunch } = {}) {
    if (this.isBusy()) return { ok: false, error: 'A atualização já está em andamento.' };
    const release = this.release;
    if (!release) return { ok: false, error: 'Nenhuma atualização disponível.' };

    this.setState({ status: 'downloading', progress: 0, error: null });
    try {
      let lastPercent = 0;
      const installerPath = await downloadInstaller({
        url: release.url,
        version: release.version,
        destDir: this.downloadDir,
        expectedSize: release.size,
        expectedSha256: release.sha256,
        fetchImpl: this.fetchImpl,
        onProgress: ({ received, total }) => {
          if (!total) return;
          const percent = Math.min(100, Math.floor((received / total) * 100));
          if (percent !== lastPercent) {
            lastPercent = percent;
            this.setState({ progress: percent });
          }
        },
      });

      this.setState({ status: 'installing', progress: 100 });
      if (beforeLaunch) await beforeLaunch();
      await launchInstaller(installerPath, { logPath: this.logPath, spawnImpl: this.spawnImpl });
      return { ok: true, version: release.version };
    } catch (error) {
      const message = friendlyError(error);
      this.setState({ status: 'error', progress: null, error: message });
      return { ok: false, error: message };
    }
  }
}

module.exports = {
  Updater,
  compareVersions,
  isNewerVersion,
  isAllowedDownloadUrl,
  parseRelease,
  downloadInstaller,
  launchInstaller,
  INSTALLER_ARGS,
  RELEASE_DOWNLOAD_PREFIX,
};
