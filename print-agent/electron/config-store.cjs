const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULT_APP_URL = 'https://kabanasbeer.webpulseservicos.com';

const DEFAULT_CONFIG = {
  appUrl: DEFAULT_APP_URL,
  storeId: '',
  agentSecret: '',
  listenPort: 9100,
  pollIntervalMs: 4000,
  kitchenPrinter: '',
  customerPrinter: '',
  startWithWindows: true,
  setupComplete: false,
};

function getConfigDir() {
  return path.join(app.getPath('userData'), 'data');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function ensureDir() {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadConfig() {
  ensureDir();
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(partial) {
  ensureDir();
  const current = loadConfig();
  const next = { ...current, ...partial };
  if (next.storeId && next.agentSecret) {
    next.setupComplete = true;
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function isSetupComplete(config) {
  return Boolean(config?.setupComplete && config?.storeId?.trim() && config?.agentSecret?.trim());
}

module.exports = {
  DEFAULT_APP_URL,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  isSetupComplete,
  getConfigPath,
};
