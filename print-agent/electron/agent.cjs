const http = require('node:http');
const { EventEmitter } = require('node:events');
const { formatJob } = require('./format.cjs');
const { printRaw } = require('./printers.cjs');

class PrintAgent extends EventEmitter {
  constructor() {
    super();
    this.config = null;
    this.server = null;
    this.pollTimer = null;
    this.polling = false;
    this.pollPromise = null;
    this.pollRequested = false;
    this.running = false;
    this.stats = {
      printedToday: 0,
      lastPollAt: null,
      lastError: null,
      lastJobAt: null,
      online: false,
    };
  }

  getStatus() {
    return {
      ...this.stats,
      running: Boolean(this.server),
      port: this.config?.listenPort ?? 9100,
    };
  }

  async start(config) {
    await this.stop();
    this.config = config;
    const port = config.listenPort ?? 9100;

    this.server = http.createServer((req, res) => {
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
        void this.pollOnce();
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', resolve);
    });

    this.running = true;
    this.schedulePoll(500);
    this.emit('status', this.getStatus());
  }

  async stop() {
    this.running = false;
    this.pollRequested = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.server) {
      await new Promise((resolve) => this.server.close(() => resolve()));
      this.server = null;
    }
    // Finish an already-started print before restarting with another config.
    if (this.pollPromise) await this.pollPromise;
    this.stats.online = false;
    this.emit('status', this.getStatus());
  }

  async api(pathname, options = {}) {
    const base = this.config.appUrl.replace(/\/$/, '');
    const response = await fetch(`${base}${pathname}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.agentSecret}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Servidor respondeu ${response.status}: ${text.slice(0, 120)}`);
    }
    return response.json();
  }

  printerForJob(job) {
    if (job.job_type === 'kitchen_ticket') {
      return this.config.kitchenPrinter || this.config.customerPrinter;
    }
    return this.config.customerPrinter || this.config.kitchenPrinter;
  }

  async processJob(job) {
    const printer = this.printerForJob(job);
    const data = formatJob(job);
    await this.api(`/api/print-agent/jobs/${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'printing' }),
    });
    try {
      await printRaw(printer, data);
      await this.api(`/api/print-agent/jobs/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'printed' }),
      });
      this.stats.printedToday += 1;
      this.stats.lastJobAt = new Date().toISOString();
      this.stats.lastError = null;
    } catch (error) {
      await this.api(`/api/print-agent/jobs/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_message: String(error.message || error) }),
      });
      throw error;
    }
  }

  pollOnce() {
    if (!this.running || !this.config) return Promise.resolve();
    if (this.pollPromise) {
      // A /wake received during a fetch or print must not be discarded.
      this.pollRequested = true;
      return this.pollPromise;
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.polling = true;
    this.pollPromise = this.drainQueue().finally(() => {
      this.polling = false;
      this.pollPromise = null;
      this.emit('status', this.getStatus());
      if (this.running) this.schedulePoll();
    });
    return this.pollPromise;
  }

  async drainQueue() {
    try {
      let hasJobs;
      do {
        this.pollRequested = false;
        const { jobs } = await this.api(
          `/api/print-agent/jobs?store_id=${encodeURIComponent(this.config.storeId)}&limit=5`
        );
        this.stats.lastPollAt = new Date().toISOString();
        this.stats.online = true;
        this.stats.lastError = null;
        hasJobs = Boolean(jobs?.length);
        for (const job of jobs || []) {
          if (!this.running) break;
          await this.processJob(job);
        }
        // Check again immediately after printing, including the next batch.
        // Keep the normal idle interval once the queue is empty.
      } while (this.running && (hasJobs || this.pollRequested));
    } catch (error) {
      this.stats.online = false;
      this.stats.lastError = String(error.message || error);
    }
  }

  schedulePoll(delay) {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (!this.running) return;
    const interval = delay ?? this.config?.pollIntervalMs ?? 4000;
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.pollOnce();
    }, interval);
  }
}

module.exports = { PrintAgent };
