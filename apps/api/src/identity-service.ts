import type { BrowserSessionConfiguration, BrowserSessionStore } from '@steer/adapters/browser-session';
import type { ArtifactReader } from '@steer/adapters/github';
import type { IdentityDependencies } from '@steer/adapters/identity';
import { createGitBackedBrowserApi } from './git-browser.ts';
import type { ToolServices } from '@steer/tool-registry';

export interface ManagedIdentitySessions {
  readonly binding: Readonly<{ issuer: string; clientId: string; redirectUri: string }>;
  readonly store: BrowserSessionStore;
  /** Close admission and await cleanup of only this service's owned session resources. */
  shutdown(): Promise<void>;
}

/** Explicit lifecycle composition, not an environment loader or readiness approval. */
export function createIdentityService(configuration: BrowserSessionConfiguration,
  dependencies: Pick<IdentityDependencies, 'fetch' | 'now'> & {
    reader: ArtifactReader; authorizationPath: string; sessions: ManagedIdentitySessions; services?: ToolServices;
  }) {
  const sessions = dependencies.sessions;
  if (!sessions || typeof sessions.shutdown !== 'function' || !sessions.binding ||
      sessions.binding.issuer !== configuration.issuer || sessions.binding.clientId !== configuration.clientId ||
      sessions.binding.redirectUri !== configuration.redirectUri) throw new Error('Invalid identity service resource binding.');
  const app = createGitBackedBrowserApi(configuration, { reader: dependencies.reader,
    authorizationPath: dependencies.authorizationPath, store: sessions.store,
    ...(dependencies.services ? { services: dependencies.services } : {}),
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
  const stopResources = sessions.shutdown.bind(sessions);
  let state: 'running' | 'draining' | 'stopped' | 'failed' = 'running';
  let activeRequests = 0; let shutdown: Promise<void> | undefined;
  let drained: (() => void) | undefined;
  const unavailable = () => Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is not accepting requests.' } }, {
    status: 503, headers: { 'cache-control': 'no-store', 'retry-after': '1', 'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff' },
  });
  return {
    async fetch(request: Request): Promise<Response> {
      if (state !== 'running') return unavailable();
      activeRequests++;
      try { return await app.fetch(request); }
      finally { activeRequests--; if (activeRequests === 0) drained?.(); }
    },
    // Internal operational status only. Running does not mean Phase 1 or health/ready passed.
    status: () => ({ state, activeRequests }),
    shutdown(): Promise<void> {
      if (shutdown) return shutdown;
      state = 'draining';
      const requests = activeRequests === 0 ? Promise.resolve() : new Promise<void>((resolve) => { drained = resolve; });
      // Stop resource admission now; its owned active leases retain their explicit drain policy.
      const resources = Promise.resolve().then(stopResources);
      shutdown = Promise.allSettled([requests, resources]).then((results) => {
        drained = undefined;
        if (results.some((result) => result.status === 'rejected')) {
          state = 'failed'; throw new Error('Identity service shutdown failed.');
        }
        state = 'stopped';
      });
      return shutdown;
    },
  };
}
