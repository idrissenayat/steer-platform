import type { BrowserSessionConfiguration, BrowserSessionStore } from '@steer/adapters/browser-session';
import type { ArtifactReader } from '@steer/adapters/github';
import type { IdentityDependencies } from '@steer/adapters/identity';
import { createGitBackedBrowserApi } from './git-browser.ts';
import type { ToolServices } from '@steer/tool-registry';
import { createGitBackedMcpEndpoint } from './identity.ts';

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
    mcp?: { clientIds: string[] };
  }) {
  const sessions = dependencies.sessions;
  if (!sessions || typeof sessions.shutdown !== 'function' || !sessions.binding ||
      sessions.binding.issuer !== configuration.issuer || sessions.binding.clientId !== configuration.clientId ||
      sessions.binding.redirectUri !== configuration.redirectUri) throw new Error('Invalid identity service resource binding.');
  if (dependencies.mcp && (!Array.isArray(dependencies.mcp.clientIds) || !dependencies.mcp.clientIds.length || dependencies.mcp.clientIds.length > 100 ||
    new Set(dependencies.mcp.clientIds).size !== dependencies.mcp.clientIds.length ||
    dependencies.mcp.clientIds.some((id) => typeof id !== 'string' || !id.length || id.length > 200))) throw new Error('Invalid MCP client binding.');
  const mcp = dependencies.mcp ? createGitBackedMcpEndpoint(new URL(configuration.redirectUri).origin, {
    issuer: configuration.issuer, jwksUri: configuration.jwksUri, audience: configuration.audience, clientIds: [...dependencies.mcp.clientIds], maxTokenAgeSeconds: 300,
  }, { reader: dependencies.reader, authorizationPath: dependencies.authorizationPath,
    ...(dependencies.services ? { services: dependencies.services } : {}),
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}), ...(dependencies.now ? { now: dependencies.now } : {}),
  }) : undefined;
  const app = createGitBackedBrowserApi(configuration, { reader: dependencies.reader,
    authorizationPath: dependencies.authorizationPath, store: sessions.store,
    ...(dependencies.services ? { services: dependencies.services } : {}),
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
  const stopResources = sessions.shutdown.bind(sessions);
  const drainBeforeResources = Boolean(mcp || dependencies.services?.reconciliationScheduler);
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
      try { return await (mcp && new URL(request.url).pathname === '/mcp' ? mcp.fetch(request) : app.fetch(request)); }
      finally { activeRequests--; if (activeRequests === 0) drained?.(); }
    },
    // Internal operational status only. Running does not mean Phase 1 or health/ready passed.
    status: () => ({ state, activeRequests, ...(mcp ? { mcp: mcp.status() } : {}) }),
    shutdown(): Promise<void> {
      if (shutdown) return shutdown;
      state = 'draining';
      const requests = activeRequests === 0 ? Promise.resolve() : new Promise<void>((resolve) => { drained = resolve; });
      const transport = mcp?.shutdown() ?? Promise.resolve();
      // Shared MCP queries may still need their read pool and fresh authorization after I/O.
      // With MCP enabled, close both transport admissions first, drain calls, then close pools.
      // Scheduler commands also require their connection and fresh identity until the admitted call settles.
      // Preserve the eager resource-stop contract only for the original browser-only composition.
      const resources = drainBeforeResources
        ? Promise.allSettled([requests, transport]).then(stopResources) : Promise.resolve().then(stopResources);
      shutdown = Promise.allSettled([requests, transport, resources]).then((results) => {
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
