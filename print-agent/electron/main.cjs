const os = require('node:os');
const path = require('node:path');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  shell,
  nativeImage,
} = require('electron');
const { PrintAgent } = require('./agent.cjs');
const { loadConfig, saveConfig, isSetupComplete, DEFAULT_APP_URL } = require('./config-store.cjs');
const { listWindowsPrinters, printRaw } = require('./printers.cjs');
const { formatTestPage } = require('./format.cjs');
const { Updater } = require('./updater.cjs');

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const UPDATE_RECHECK_ON_SHOW_MS = 30 * 60 * 1000;
// O instalador reabre o programa com --updated depois de uma atualização silenciosa.
const justUpdated = process.argv.includes('--updated');

const agent = new PrintAgent({ version: app.getVersion() });
const updater = new Updater({
  currentVersion: app.getVersion(),
  getFeedUrl: () => `${(loadConfig().appUrl || DEFAULT_APP_URL).replace(/\/$/, '')}/api/print-agent/latest`,
  downloadDir: path.join(os.tmpdir(), 'kabanas-impressao-update'),
  logPath: path.join(os.tmpdir(), 'kabanas-impressao-update.log'),
});
let mainWindow = null;
let tray = null;
let isQuitting = false;
let notifiedUpdateVersion = null;

const ADMIN_PRINT_URL = `${DEFAULT_APP_URL}/admin/impressao`;

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function getUiPath(file) {
  return path.join(__dirname, '..', 'ui', file);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 440,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Kabanas Impressão',
    backgroundColor: '#0a0a0a',
    icon: getUiPath('assets/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(getUiPath('index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('show', () => {
    const { checkedAt } = updater.getState();
    if (!checkedAt || Date.now() - new Date(checkedAt).getTime() > UPDATE_RECHECK_ON_SHOW_MS) {
      void updater.check();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function buildTrayMenu() {
  const update = updater.getState();
  const updateItems =
    update.status === 'available' || update.status === 'error'
      ? [{ label: `Atualizar para a versão ${update.latestVersion}`, click: showMainWindow }, { type: 'separator' }]
      : [];

  return Menu.buildFromTemplate([
    ...updateItems,
    {
      label: 'Abrir Kabanas Impressão',
      click: showMainWindow,
    },
    {
      label: 'Abrir painel web',
      click: () => shell.openExternal(ADMIN_PRINT_URL),
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
    { type: 'separator' },
    { label: `Versão ${app.getVersion()}`, enabled: false },
  ]);
}

function refreshTray() {
  if (!tray || tray.isDestroyed()) return;
  const update = updater.getState();
  tray.setToolTip(
    update.status === 'available'
      ? `Kabanas Impressão — atualização ${update.latestVersion} disponível`
      : 'Kabanas Impressão'
  );
  tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  const icon = nativeImage.createFromPath(getUiPath('assets/tray.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  refreshTray();
  tray.on('double-click', showMainWindow);
  tray.on('balloon-click', showMainWindow);
}

async function applyLoginItem(config) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(config.startWithWindows),
    path: process.execPath,
    args: [],
  });
}

async function startAgentFromConfig() {
  const config = loadConfig();
  if (!isSetupComplete(config)) return;
  await agent.start(config);
}

function broadcastStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent-status', agent.getStatus());
  }
}

agent.on('status', broadcastStatus);

updater.on('state', (state) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-state', state);
  }
  refreshTray();
  if (state.status === 'available' && state.latestVersion !== notifiedUpdateVersion && tray && !tray.isDestroyed()) {
    notifiedUpdateVersion = state.latestVersion;
    tray.displayBalloon({
      iconType: 'info',
      title: 'Atualização disponível',
      content: `Versão ${state.latestVersion} do Kabanas Impressão. Clique aqui e depois em "Atualizar agora".`,
    });
  }
});

async function installUpdate() {
  if (!app.isPackaged || process.platform !== 'win32') {
    return { ok: false, error: 'A atualização automática só funciona no programa instalado no Windows.' };
  }
  let agentStopped = false;
  const result = await updater.install({
    // Termina a impressão em andamento antes de o instalador fechar o programa.
    beforeLaunch: async () => {
      agentStopped = true;
      await agent.stop();
    },
  });
  if (result.ok) {
    // O instalador também fecharia o programa; sair já libera os arquivos mais cedo.
    setTimeout(() => {
      isQuitting = true;
      app.quit();
    }, 300);
  } else if (agentStopped) {
    await startAgentFromConfig();
  }
  return result;
}

function registerIpc() {
  ipcMain.handle('get-config', () => {
    const config = loadConfig();
    return {
      ...config,
      agentSecret: config.agentSecret ? '••••••••' + config.agentSecret.slice(-6) : '',
      agentSecretSet: Boolean(config.agentSecret),
      adminUrl: ADMIN_PRINT_URL,
      setupComplete: isSetupComplete(config),
    };
  });

  ipcMain.handle('save-config', async (_event, partial) => {
    const current = loadConfig();
    const nextPartial = { ...partial };
    if (nextPartial.agentSecret?.startsWith('••••')) {
      delete nextPartial.agentSecret;
    }
    const saved = saveConfig(nextPartial);
    await applyLoginItem(saved);
    await agent.stop();
    if (isSetupComplete(saved)) {
      await agent.start(saved);
    }
    return { ok: true, setupComplete: isSetupComplete(saved) };
  });

  ipcMain.handle('get-status', () => agent.getStatus());

  ipcMain.handle('list-printers', async () => {
    try {
      return { printers: await listWindowsPrinters() };
    } catch (error) {
      return { printers: [], error: String(error.message || error) };
    }
  });

  ipcMain.handle('test-print', async (_event, { printer }) => {
    await printRaw(printer, formatTestPage());
    return { ok: true };
  });

  ipcMain.handle('open-admin', () => {
    shell.openExternal(ADMIN_PRINT_URL);
    return { ok: true };
  });

  ipcMain.handle('open-external', (_event, url) => {
    shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('get-app-info', () => ({ version: app.getVersion(), justUpdated }));
  ipcMain.handle('get-update-state', () => updater.getState());
  ipcMain.handle('check-update', () => updater.check());
  ipcMain.handle('install-update', () => installUpdate());
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  app.whenReady().then(async () => {
    registerIpc();
    createWindow();
    createTray();
    const config = loadConfig();
    await applyLoginItem(config);
    await startAgentFromConfig();
    broadcastStatus();
    // A janela já verifica ao aparecer; isto cobre o caso de ela abrir escondida.
    setTimeout(() => {
      if (!updater.getState().checkedAt) void updater.check();
    }, 8000);
    setInterval(() => void updater.check(), UPDATE_CHECK_INTERVAL_MS);
  });

  app.on('before-quit', async () => {
    isQuitting = true;
    await agent.stop();
  });

  app.on('window-all-closed', (event) => {
    event.preventDefault();
  });
}
