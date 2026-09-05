import { createServer, connect, type Socket } from 'node:net';

/** Disposable loopback fault relay. Never logs or persists protocol/credential bytes. */
export async function createPostgresRelay(port: number) {
  const sockets = new Set<Socket>(); let cutReplies = false;
  const server = createServer((downstream) => {
    const upstream = connect(port, '127.0.0.1');
    for (const socket of [downstream, upstream]) {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => { downstream.destroy(); upstream.destroy(); });
    }
    downstream.pipe(upstream);
    upstream.on('data', (bytes: Buffer) => { if (!cutReplies && !downstream.write(bytes)) upstream.pause(); });
    downstream.on('drain', () => upstream.resume());
    downstream.on('close', () => upstream.destroy()); upstream.on('close', () => downstream.destroy());
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Synthetic relay initialization failed.');
  return { port: address.port, cutReplies() { cutReplies = true; },
    async close() { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve) => server.close(() => resolve())); } };
}
