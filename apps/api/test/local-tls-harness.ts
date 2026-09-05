import { createServer } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { mkdtemp, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export async function reserveLocalPort() {
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const address = socket.address();
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  if (!address || typeof address === 'string') throw new Error('Synthetic port unavailable.');
  return address.port;
}

export async function createLocalTlsHarness() {
  const directory = await mkdtemp(join(tmpdir(), 'steer-0028-'));
  const close = () => rm(directory, { recursive: true, force: true });
  try {
    const keyPath = join(directory, 'test.key'); const certPath = join(directory, 'test.crt');
    await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '1',
      '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-keyout', keyPath, '-out', certPath], { timeout: 30000 });
    await chmod(keyPath, 0o600);
    return { key: await readFile(keyPath, 'utf8'), cert: await readFile(certPath, 'utf8'), close };
  } catch { await close(); throw new Error('Synthetic TLS initialization failed.'); }
}

export function localHttpsRequest(origin: string, cert: string | undefined, path = '/', options: { method?: string; headers?: Record<string, string> } = {}) {
  return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const outgoing = httpsRequest(`${origin}${path}`, { family: 4, agent: false, ca: cert,
      servername: new URL(origin).hostname, rejectUnauthorized: true, ...options }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.once('end', () => resolve({ status: incoming.statusCode!, headers: incoming.headers, body: Buffer.concat(chunks).toString() }));
      incoming.once('error', () => reject(new Error('Synthetic HTTPS response failed.')));
    });
    outgoing.setTimeout(12000, () => outgoing.destroy(new Error('Synthetic HTTPS timeout.')));
    outgoing.once('error', () => reject(new Error('Synthetic HTTPS request failed.'))); outgoing.end();
  });
}
