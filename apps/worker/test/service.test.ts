import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorkerService } from '../src/service.ts';

test('service starts once and drains actual worker then runtime then owned connection', async () => {
  const events: string[] = []; let finish!: () => void, drain!: () => void;
  const service = createWorkerService({ createWorker: async () => ({ run: async () => { events.push('run'); await new Promise<void>((resolve) => { finish = resolve; }); }, shutdown: () => { events.push('stop'); } }),
    runtime: { shutdown: async () => { events.push('runtime'); await new Promise<void>((resolve) => { drain = resolve; }); } },
    closeConnection: async () => { events.push('connection'); } });
  const run = service.start(); assert.equal(service.start(), run);
  await Promise.resolve();
  assert.equal(service.shutdown(), run); assert.equal(service.shutdown(), run);
  assert.deepEqual(events, ['run', 'stop']); assert.equal(service.status().state, 'stopping');
  finish(); await Promise.resolve(); await Promise.resolve(); assert.deepEqual(events, ['run', 'stop', 'runtime']);
  assert.equal(service.status().state, 'stopping'); drain(); await run;
  assert.deepEqual(events, ['run', 'stop', 'runtime', 'connection']); assert.equal(service.status().state, 'stopped');
  assert.equal(service.start(), run); assert.equal(service.shutdown(), run);
});
test('shutdown before start closes owned resources without polling and cannot later start the worker', async () => {
  let ran = false; const closed: string[] = [];
  const service = createWorkerService({ createWorker: async () => { ran = true; throw new Error(); },
    runtime: { shutdown: async () => { closed.push('runtime'); } }, closeConnection: async () => { closed.push('connection'); } });
  const stop = service.shutdown(); await stop; await service.start(); assert.equal(ran, false); assert.deepEqual(closed, ['runtime', 'connection']);
});
test('worker and runtime failure still attempt all owned cleanup and expose only a generic failure', async () => {
  const closed: string[] = [];
  const service = createWorkerService({ createWorker: async () => ({ run: async () => { throw new Error('private worker error'); }, shutdown: () => {} }),
    runtime: { shutdown: async () => { closed.push('runtime'); throw new Error('private SQL error'); } },
    closeConnection: async () => { closed.push('connection'); } });
  const run = service.start(); await assert.rejects(run, /^Error: Worker service shutdown could not be confirmed\.$/);
  assert.deepEqual(closed, ['runtime', 'connection']); assert.equal(service.status().state, 'failed'); assert.equal(service.shutdown(), run);
});
test('failed SDK stop does not claim completion while the worker remains active', async () => {
  let finish!: () => void, closed = false;
  const service = createWorkerService({ createWorker: async () => ({ run: () => new Promise<void>((resolve) => { finish = resolve; }), shutdown: () => { throw new Error('private'); } }),
    runtime: { shutdown: async () => { closed = true; } }, closeConnection: async () => {} });
  const run = service.start(); const rejected = assert.rejects(run, /could not be confirmed/); await Promise.resolve(); service.shutdown();
  await Promise.resolve(); assert.equal(closed, false); assert.equal(service.status().state, 'stopping'); finish(); await rejected;
  assert.equal(closed, true); assert.equal(service.status().state, 'failed');
});

test('stop during construction waits for the created worker to run/drain before releasing resources', async () => {
  let create!: (value: { run(): Promise<void>; shutdown(): void }) => void; let finish!: () => void;
  const events: string[] = [];
  const service = createWorkerService({ createWorker: () => new Promise((resolve) => { create = resolve; }),
    runtime: { shutdown: async () => { events.push('runtime'); } }, closeConnection: async () => { events.push('connection'); } });
  const run = service.start(); service.shutdown(); assert.equal(events.length, 0);
  create({ run: () => { events.push('run'); return new Promise<void>((resolve) => { finish = resolve; }); }, shutdown: () => { events.push('stop'); } });
  await Promise.resolve(); assert.deepEqual(events, ['run', 'stop']); finish(); await run;
  assert.deepEqual(events, ['run', 'stop', 'runtime', 'connection']);
});
