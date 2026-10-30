const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { PrintAgent } = require('../electron/agent.cjs');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function createAgent(t) {
  const agent = new PrintAgent();
  agent.config = { storeId: 'test-store', pollIntervalMs: 4000 };
  agent.running = true;
  const printed = [];
  const scheduled = [];
  agent.processJob = async (job) => { printed.push(job.id); };
  agent.schedulePoll = (delay) => { scheduled.push(delay ?? agent.config.pollIntervalMs); };
  t.after(() => agent.stop());
  return { agent, printed, scheduled };
}

test('a wake during an empty fetch immediately checks for the newly queued job', async (t) => {
  const { agent, printed, scheduled } = createAgent(t);
  const firstFetch = deferred();
  let fetchCount = 0;
  agent.api = async () => {
    fetchCount += 1;
    if (fetchCount === 1) return firstFetch.promise;
    return { jobs: fetchCount === 2 ? [{ id: 'new-job' }] : [] };
  };

  const polling = agent.pollOnce();
  const wake = agent.pollOnce();
  assert.equal(wake, polling);
  assert.equal(fetchCount, 1, 'the wake must not start a concurrent fetch');
  firstFetch.resolve({ jobs: [] });
  await polling;

  assert.deepEqual(printed, ['new-job']);
  assert.equal(fetchCount, 3);
  assert.deepEqual(scheduled, [4000], 'only wait after the queue has been drained');
});

test('a wake while printing is remembered and jobs remain sequential', async (t) => {
  const { agent, printed } = createAgent(t);
  const printing = deferred();
  const started = deferred();
  const batches = [[{ id: 'first' }], [{ id: 'second' }], []];
  agent.api = async () => ({ jobs: batches.shift() });
  agent.processJob = async (job) => {
    printed.push(job.id);
    if (job.id === 'first') {
      started.resolve();
      await printing.promise;
    }
  };

  const polling = agent.pollOnce();
  await started.promise;
  agent.pollOnce();
  agent.pollOnce();
  assert.deepEqual(printed, ['first']);
  printing.resolve();
  await polling;
  assert.deepEqual(printed, ['first', 'second']);
});

test('more than five queued jobs are drained without an idle pause between batches', async (t) => {
  const { agent, printed, scheduled } = createAgent(t);
  const batches = [
    Array.from({ length: 5 }, (_, id) => ({ id })),
    [{ id: 5 }],
    [],
  ];
  agent.api = async () => {
    assert.deepEqual(scheduled, [], 'no timer before the next batch');
    return { jobs: batches.shift() };
  };
  await agent.pollOnce();
  assert.deepEqual(printed, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(scheduled, [4000]);
});

test('an empty queue keeps the existing idle interval', async (t) => {
  const { agent, scheduled } = createAgent(t);
  let fetchCount = 0;
  agent.api = async () => { fetchCount += 1; return { jobs: [] }; };
  await agent.pollOnce();
  assert.equal(fetchCount, 1);
  assert.deepEqual(scheduled, [4000]);
  assert.equal(agent.polling, false);
});

test('a fetch failure backs off instead of immediately retrying forever', async (t) => {
  const { agent, scheduled } = createAgent(t);
  let fetchCount = 0;
  agent.api = async () => { fetchCount += 1; throw new Error('offline'); };
  await agent.pollOnce();
  assert.equal(fetchCount, 1);
  assert.deepEqual(scheduled, [4000]);
  assert.equal(agent.getStatus().online, false);
  assert.equal(agent.getStatus().lastError, 'offline');
});

test('stopping during a fetch prevents printing and rescheduling', async (t) => {
  const { agent, printed, scheduled } = createAgent(t);
  const fetching = deferred();
  agent.api = () => fetching.promise;
  const polling = agent.pollOnce();
  const stopping = agent.stop();
  fetching.resolve({ jobs: [{ id: 'must-wait-for-restart' }] });
  await Promise.all([polling, stopping]);
  assert.deepEqual(printed, []);
  assert.deepEqual(scheduled, []);
  assert.equal(agent.getStatus().online, false);
});

test('stopping waits for an in-flight print and does not start the next job', async (t) => {
  const { agent, printed, scheduled } = createAgent(t);
  const printing = deferred();
  const started = deferred();
  agent.api = async () => ({ jobs: [{ id: 'printing' }, { id: 'still-queued' }] });
  agent.processJob = async (job) => {
    printed.push(job.id);
    started.resolve();
    await printing.promise;
  };

  const polling = agent.pollOnce();
  await started.promise;
  let stopped = false;
  const stopping = agent.stop().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  printing.resolve();
  await Promise.all([polling, stopping]);
  assert.deepEqual(printed, ['printing']);
  assert.deepEqual(scheduled, []);
});

test('a print failure stops draining and preserves the normal retry interval', async (t) => {
  const { agent, printed, scheduled } = createAgent(t);
  agent.api = async () => ({ jobs: [{ id: 'failed' }, { id: 'still-queued' }] });
  agent.processJob = async (job) => {
    printed.push(job.id);
    throw new Error('printer offline');
  };
  await agent.pollOnce();
  assert.deepEqual(printed, ['failed']);
  assert.deepEqual(scheduled, [4000]);
  assert.equal(agent.getStatus().lastError, 'printer offline');
});

test('the local /wake endpoint drains the queue before the initial idle timer', async (t) => {
  const agent = new PrintAgent();
  t.after(() => agent.stop());
  const printed = [];
  let fetchCount = 0;
  agent.api = async () => ({ jobs: ++fetchCount === 1 ? [{ id: 'local-job' }] : [] });
  agent.processJob = async (job) => { printed.push(job.id); };
  await agent.start({ storeId: 'test-store', listenPort: 0, pollIntervalMs: 60000 });
  const drained = once(agent, 'status');
  const response = await fetch(`http://127.0.0.1:${agent.server.address().port}/wake`, { method: 'POST' });
  await drained;
  assert.equal(response.status, 202);
  assert.deepEqual(printed, ['local-job']);
  assert.equal(fetchCount, 2);
  assert.ok(agent.pollTimer, 'idle polling resumes after draining');
  await agent.stop();
  assert.equal(agent.pollTimer, null);
});
