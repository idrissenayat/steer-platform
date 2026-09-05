import type { ProjectionConsumerPort } from '@steer/tool-registry/projection-consumer';
import { createReadTransport } from './read-transport.ts';

export function createProjectionTransport(origin: string, transport: typeof fetch = globalThis.fetch) {
  const reader = createReadTransport(origin, transport);
  const port: ProjectionConsumerPort = { snapshot: (scope) => reader.request('projection.snapshot.read', scope),
    changes: (input) => reader.request('projection.changes.read', input) };
  return { port, close: reader.close };
}
