#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { formatJob } from './format.mjs';

const require = createRequire(import.meta.url);
const { printRaw } = require('../electron/printers.cjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadConfig() {
  const configPath = path.join(rootDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error('Crie config.json a partir de config.example.json');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const config = loadConfig();
const required = ['appUrl', 'storeId', 'agentSecret'];
for (const key of required) {
  if (!config[key]) {
    console.error(`config.json: campo obrigatório "${key}" ausente`);
    process.exit(1);
  }
}

const listenPort = config.listenPort ?? 9100;
const pollIntervalMs = config.pollIntervalMs ?? 4000;
const jobsUrl = `${config.appUrl.replace(/\/$/, '')}/api/print-agent/jobs?store_id=${config.storeId}`;

let polling = false;
let pollTimer = null;

async function api(pathname, options = {}) {
  const url = `${config.appUrl.replace(/\/$/, '')}${pathname}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.agentSecret}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text}`);
  }
  return response.json();
}

function printerForJob(job) {
  if (job.job_type === 'kitchen_ticket') {
    return config.kitchenPrinter || config.defaultPrinter;
  }
  return config.customerPrinter || config.defaultPrinter;
}

async function printToWindows(printerName, data) {
  if (!printerName) {
    // Preview: mostra o conteúdo sem os bytes de comando ESC/POS.
    const preview = data
      .toString('latin1')
      .replace(/\x1b[@Eta GM!]?.|\x1d[V!]?../g, '')
      .replace(/[^\S\r\n]+$/gm, '');
    console.log('[print preview]\n', preview);
    return;
  }
  await printRaw(printerName, data);
}

async function processJob(job) {
  const printer = printerForJob(job);
  const data = formatJob(job);
  console.log(`[job ${job.id}] ${job.job_type} -> ${printer || 'console'}`);
  await api(`/api/print-agent/jobs/${job.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'printing' }),
  });
  try {
    await printToWindows(printer, data);
    await api(`/api/print-agent/jobs/${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'printed' }),
    });
  } catch (error) {
    await api(`/api/print-agent/jobs/${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'failed', error_message: String(error.message || error) }),
    });
    throw error;
  }
}

async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const { jobs } = await api(`/api/print-agent/jobs?store_id=${config.storeId}&limit=5`);
    for (const job of jobs || []) {
      await processJob(job);
    }
  } catch (error) {
    console.error('[poll]', error.message || error);
  } finally {
    polling = false;
  }
}

function schedulePoll(delay = pollIntervalMs) {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    await pollOnce();
    schedulePoll();
  }, delay);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, agent: 'kabanas-print-agent', polled_at: new Date().toISOString() }));
    return;
  }

  if (req.url === '/wake' && req.method === 'POST') {
    void pollOnce();
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`Kabanas Print Agent em http://127.0.0.1:${listenPort}`);
  console.log(`Polling: ${jobsUrl}`);
  void pollOnce();
  schedulePoll();
});
