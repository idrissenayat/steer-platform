import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ProcessFixtureConfiguration } from './process-worker.fixture.ts';

export async function startProcessWorker(configuration: ProcessFixtureConfiguration) {
  const child = fork(fileURLToPath(new URL('./process-worker.fixture.ts', import.meta.url)), [], {
    execPath: process.execPath, execArgv: [], serialization: 'advanced',
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', TMPDIR: process.env.TMPDIR ?? '/tmp', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let stopped: unknown; let outputBytes = 0;
  const bounded = (chunk: Buffer) => { outputBytes += chunk.length; if (outputBytes > 65536) child.kill('SIGKILL'); };
  child.stdout?.on('data', bounded); child.stderr?.on('data', bounded);
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Synthetic worker startup timed out.')), 20000);
    child.once('error', () => { clearTimeout(timeout); reject(new Error('Synthetic worker process failed.')); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Synthetic worker exited before ready.')); });
    child.on('message', (raw) => {
      const message = raw as { type?: string; pid?: number };
      if (message.type === 'ready') { clearTimeout(timeout); assert.equal(message.pid, child.pid); resolve(); }
      if (message.type === 'stopped') stopped = message;
      if (message.type === 'failed') { clearTimeout(timeout); reject(new Error('Synthetic worker initialization failed.')); }
    });
  });
  const stop = async (signal: 'SIGTERM' | 'SIGKILL') => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    const timeout = setTimeout(() => child.kill('SIGKILL'), 15000);
    try { const result = await exited; assert.ok(outputBytes <= 65536); return { ...result, stopped }; }
    finally { clearTimeout(timeout); }
  };
  try { child.send(configuration); await ready; }
  catch (error) { await stop('SIGKILL'); throw error; }
  return { pid: child.pid!, stop };
}
