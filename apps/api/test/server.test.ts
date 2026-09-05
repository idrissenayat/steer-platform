import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, connect } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('default local server enforces parser byte limits and remains unready/unauthenticated', { timeout: 15000 }, async () => {
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const address = reservation.address(); assert.ok(address && typeof address !== 'string'); const port = address.port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/server.ts', import.meta.url))], {
    env: { ...process.env, STEER_API_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Synthetic server startup timeout.')), 5000);
      child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      child.once('error', () => { clearTimeout(timer); reject(new Error('Synthetic server startup failed.')); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Synthetic server exited early.')); });
    });
    const origin = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${origin}/health/live`)).status, 200);
    assert.equal((await fetch(`${origin}/health/ready`)).status, 503);
    assert.equal((await fetch(`${origin}/v1/tools/session.context`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${origin}/auth/login`, { method: 'POST' })).status, 404);
    const response = await new Promise<string>((resolve, reject) => {
      const socket = connect(port, '127.0.0.1'); let received = '';
      socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('Synthetic socket timeout.')); });
      socket.on('error', () => reject(new Error('Synthetic socket failed.')));
      socket.on('data', (chunk: Buffer) => { received += chunk.toString(); if (received.includes('\r\n')) { socket.destroy(); resolve(received); } });
      socket.on('connect', () => socket.write(`GET /health/live HTTP/1.1\r\nHost: localhost\r\nX-Oversized: ${'x'.repeat(17000)}\r\nConnection: close\r\n\r\n`));
    });
    assert.match(response, /^HTTP\/1\.1 431 /);
    const slow = await new Promise<string>((resolve, reject) => {
      const socket = connect(port, '127.0.0.1'); let received = '';
      socket.setTimeout(8000, () => { socket.destroy(); reject(new Error('Synthetic slow-header deadline failed.')); });
      socket.on('error', () => reject(new Error('Synthetic slow-header socket failed.')));
      socket.on('data', (chunk: Buffer) => { received += chunk.toString(); if (received.includes('\r\n')) { socket.destroy(); resolve(received); } });
      socket.on('connect', () => socket.write('GET /health/live HTTP/1.1\r\nHost:'));
    });
    assert.match(slow, /^HTTP\/1\.1 408 /);
  } finally { child.kill('SIGTERM'); await exited; }
});
