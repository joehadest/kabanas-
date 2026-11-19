const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const {
  Updater,
  compareVersions,
  isNewerVersion,
  isAllowedDownloadUrl,
  INSTALLER_ARGS,
} = require('../electron/updater.cjs');

const GITHUB_URL = 'https://github.com/joehadest/kabanas-/releases/download/print-agent-v1.2.1/KabanasImpressao-Setup-1.2.1.exe';
const FAKE_INSTALLER = Buffer.concat([Buffer.from('MZ'), crypto.randomBytes(256 * 1024)]);
const FAKE_SHA256 = crypto.createHash('sha256').update(FAKE_INSTALLER).digest('hex');

async function startServer(t, routes) {
  const server = http.createServer((req, res) => {
    const route = routes[req.url];
    if (!route) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    route(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function json(body, status = 200) {
  return (_req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
}

function fakeSpawn() {
  const calls = [];
  const spawnImpl = (file, args, options) => {
    calls.push({ file, args, options });
    const child = new EventEmitter();
    child.pid = 4242;
    child.unref = () => { child.unrefed = true; };
    setImmediate(() => child.emit('spawn'));
    return child;
  };
  return { calls, spawnImpl };
}

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kabanas-updater-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'download');
}

test('versions are compared numerically', () => {
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  assert.ok(compareVersions('v1.2.1', '1.2.0') > 0);
  assert.ok(isNewerVersion('1.2.1', '1.2.0'));
  assert.equal(isNewerVersion('1.2.0', '1.2.0'), false);
  assert.equal(isNewerVersion('1.1.9', '1.2.0'), false);
  assert.equal(isNewerVersion('abc', '1.2.0'), false);
});

test('only installers from the project GitHub releases are accepted in production', () => {
  const feed = 'https://kabanasbeer.webpulseservicos.com/api/print-agent/latest';
  assert.ok(isAllowedDownloadUrl(GITHUB_URL, feed));
  assert.equal(isAllowedDownloadUrl('http://github.com/joehadest/kabanas-/releases/download/x/a.exe', feed), false);
  assert.equal(isAllowedDownloadUrl('https://github.com/someone/else/releases/download/x/a.exe', feed), false);
  assert.equal(isAllowedDownloadUrl('https://github.com/joehadest/kabanas-/releases/download/../../../evil/a.exe', feed), false);
  assert.equal(isAllowedDownloadUrl('https://kabanasbeer.webpulseservicos.com/setup.exe', feed), false);
  assert.equal(isAllowedDownloadUrl('http://127.0.0.1:3000/setup.exe', feed), false);
  assert.equal(isAllowedDownloadUrl('not a url', feed), false);
});

test('a site running on this PC may serve the installer itself (local testing)', () => {
  const feed = 'http://127.0.0.1:3000/api/print-agent/latest';
  assert.ok(isAllowedDownloadUrl('http://127.0.0.1:3000/setup.exe', feed));
  assert.equal(isAllowedDownloadUrl('http://127.0.0.1:4000/setup.exe', feed), false);
  assert.equal(isAllowedDownloadUrl('http://example.com/setup.exe', feed), false);
});

test('a newer published version is reported as available', async (t) => {
  const base = await startServer(t, {
    '/api/print-agent/latest': json({ version: '1.2.1', url: GITHUB_URL }),
  });
  const updater = new Updater({ currentVersion: '1.2.0', getFeedUrl: () => `${base}/api/print-agent/latest` });
  const state = await updater.check();
  assert.equal(state.status, 'available');
  assert.equal(state.latestVersion, '1.2.1');
  assert.equal(state.currentVersion, '1.2.0');
});

test('the same or an older published version means up to date', async (t) => {
  let version = '1.2.0';
  const base = await startServer(t, {
    '/api/print-agent/latest': (req, res) => json({ version, url: GITHUB_URL })(req, res),
  });
  const updater = new Updater({ currentVersion: '1.2.0', getFeedUrl: () => `${base}/api/print-agent/latest` });
  assert.equal((await updater.check()).status, 'up-to-date');
  version = '1.1.2';
  assert.equal((await updater.check()).status, 'up-to-date');
});

test('no published release (404) is not an error', async (t) => {
  const base = await startServer(t, {
    '/api/print-agent/latest': json({ error: 'Nenhuma versão publicada' }, 404),
  });
  const updater = new Updater({ currentVersion: '1.2.0', getFeedUrl: () => `${base}/api/print-agent/latest` });
  const state = await updater.check();
  assert.equal(state.status, 'up-to-date');
  assert.equal(state.checkError, null);
});

test('an installer outside the allowed releases is never offered', async (t) => {
  const base = await startServer(t, {
    '/api/print-agent/latest': json({ version: '9.0.0', url: 'https://evil.example.com/setup.exe' }),
  });
  const updater = new Updater({ currentVersion: '1.2.0', getFeedUrl: () => `${base}/api/print-agent/latest` });
  const state = await updater.check();
  assert.equal(state.status, 'idle');
  assert.match(state.checkError, /não autorizado/);
});

test('a failed check keeps an update that was already found', async (t) => {
  let fail = false;
  const base = await startServer(t, {
    '/api/print-agent/latest': (req, res) =>
      fail ? json({ error: 'GitHub fora' }, 503)(req, res) : json({ version: '1.2.1', url: GITHUB_URL })(req, res),
  });
  const updater = new Updater({ currentVersion: '1.2.0', getFeedUrl: () => `${base}/api/print-agent/latest` });
  assert.equal((await updater.check()).status, 'available');
  fail = true;
  const state = await updater.check();
  assert.equal(state.status, 'available');
  assert.equal(state.latestVersion, '1.2.1');
  assert.match(state.checkError, /503/);
});

test('a check without internet stays quiet (idle) and reports the reason', async () => {
  const updater = new Updater({
    currentVersion: '1.2.0',
    getFeedUrl: () => 'https://kabanasbeer.webpulseservicos.com/api/print-agent/latest',
    fetchImpl: async () => { throw new TypeError('fetch failed'); },
  });
  const state = await updater.check();
  assert.equal(state.status, 'idle');
  assert.match(state.checkError, /internet/);
});

test('install downloads, verifies and runs the installer silently after stopping the queue', async (t) => {
  const base = await startServer(t, {
    '/setup.exe': (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': FAKE_INSTALLER.length });
      res.end(FAKE_INSTALLER);
    },
  });
  const feed = `${base}/api/print-agent/latest`;
  const downloadDir = tempDir(t);
  const { calls, spawnImpl } = fakeSpawn();
  const updater = new Updater({
    currentVersion: '1.2.0',
    getFeedUrl: () => feed,
    downloadDir,
    logPath: path.join(downloadDir, '..', 'update.log'),
    spawnImpl,
  });
  updater.release = { version: '1.2.1', url: `${base}/setup.exe`, size: FAKE_INSTALLER.length, sha256: FAKE_SHA256 };
  updater.state.status = 'available';

  const order = [];
  const states = [];
  updater.on('state', (state) => states.push(state.status));
  const result = await updater.install({
    beforeLaunch: async () => {
      order.push('stop-agent');
      assert.equal(calls.length, 0, 'the queue stops before the installer starts');
    },
  });

  assert.deepEqual(result, { ok: true, version: '1.2.1' });
  assert.deepEqual(order, ['stop-agent']);
  assert.equal(calls.length, 1);
  const expectedPath = path.join(downloadDir, 'KabanasImpressao-Setup-1.2.1.exe');
  assert.equal(calls[0].file, expectedPath);
  assert.deepEqual(fs.readFileSync(expectedPath), FAKE_INSTALLER);
  for (const flag of ['/SILENT', '/CLOSEAPPLICATIONS', '/NOCANCEL', '/SUPPRESSMSGBOXES']) {
    assert.ok(calls[0].args.includes(flag), `${flag} is passed to Inno Setup`);
  }
  assert.ok(calls[0].args.some((arg) => arg.startsWith('/LOG=')));
  assert.deepEqual(INSTALLER_ARGS.slice(0, 1), ['/SILENT']);
  assert.equal(calls[0].options.detached, true, 'the installer survives the app quitting');
  assert.equal(states[0], 'downloading');
  assert.equal(states.at(-1), 'installing');
  assert.ok(states.filter((s) => s === 'downloading').length > 1, 'download progress is reported');
});

test('a corrupted download is rejected and the installer is not run', async (t) => {
  const base = await startServer(t, {
    '/setup.exe': (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(FAKE_INSTALLER);
    },
  });
  const downloadDir = tempDir(t);
  const { calls, spawnImpl } = fakeSpawn();
  const updater = new Updater({
    currentVersion: '1.2.0',
    getFeedUrl: () => `${base}/api/print-agent/latest`,
    downloadDir,
    spawnImpl,
  });
  updater.release = { version: '1.2.1', url: `${base}/setup.exe`, size: null, sha256: 'a'.repeat(64) };
  let stopped = false;
  const result = await updater.install({ beforeLaunch: async () => { stopped = true; } });

  assert.equal(result.ok, false);
  assert.match(result.error, /corrompido/);
  assert.equal(stopped, false, 'printing keeps running when the download fails');
  assert.equal(calls.length, 0);
  assert.deepEqual(fs.readdirSync(downloadDir), [], 'the partial file is removed');
  assert.equal(updater.getState().status, 'error');
});

test('a file that is not a Windows executable is rejected', async (t) => {
  const base = await startServer(t, {
    '/setup.exe': (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>login</html>');
    },
  });
  const { calls, spawnImpl } = fakeSpawn();
  const updater = new Updater({
    currentVersion: '1.2.0',
    getFeedUrl: () => `${base}/api/print-agent/latest`,
    downloadDir: tempDir(t),
    spawnImpl,
  });
  updater.release = { version: '1.2.1', url: `${base}/setup.exe`, size: null, sha256: null };
  const result = await updater.install();
  assert.equal(result.ok, false);
  assert.match(result.error, /instalador válido/);
  assert.equal(calls.length, 0);
});

test('a failed install can be retried with the same release', async (t) => {
  let attempts = 0;
  const base = await startServer(t, {
    '/setup.exe': (_req, res) => {
      attempts += 1;
      if (attempts === 1) {
        res.writeHead(500);
        res.end('erro');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(FAKE_INSTALLER);
    },
  });
  const { calls, spawnImpl } = fakeSpawn();
  const updater = new Updater({
    currentVersion: '1.2.0',
    getFeedUrl: () => `${base}/api/print-agent/latest`,
    downloadDir: tempDir(t),
    spawnImpl,
  });
  updater.release = { version: '1.2.1', url: `${base}/setup.exe`, size: null, sha256: FAKE_SHA256 };
  const first = await updater.install();
  assert.equal(first.ok, false);
  assert.match(first.error, /HTTP 500/);
  const second = await updater.install();
  assert.equal(second.ok, true);
  assert.equal(calls.length, 1);
});
