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
const { listWindowsPrinters, printText } = require('./printers.cjs');
const { formatTestPage } = require('./format.cjs');

const agent = new PrintAgent();
let mainWindow = null;
let tray = null;
let isQuitting = false;

const ADMIN_PRINT_URL = `${DEFAULT_APP_URL}/admin/impressao`;

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

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(getUiPath('assets/tray.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Kabanas Impressão');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Kabanas Impressão',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
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
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
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
    await printText(printer, formatTestPage());
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
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    registerIpc();
    createWindow();
    createTray();
    const config = loadConfig();
    await applyLoginItem(config);
    await startAgentFromConfig();
    broadcastStatus();
  });

  app.on('before-quit', async () => {
    isQuitting = true;
    await agent.stop();
  });

  app.on('window-all-closed', (event) => {
    event.preventDefault();
  });
}
