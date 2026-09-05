import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import type { ArtifactReader } from '@steer/adapters/github';
import type { BrowserSessionConfiguration, BrowserSessionStore } from '@steer/adapters/browser-session';
import type { IdentityDependencies } from '@steer/adapters/identity';
import { createBrowserApi } from './browser.ts';
import { Hono } from 'hono';
import { createRequestBoundary } from './request-boundary.ts';
import type { ToolServices } from '@steer/tool-registry';

/** Trusted startup composition, never populated from a request or token claim. */
export function createGitBackedBrowserApi(configuration: BrowserSessionConfiguration,
  dependencies: Pick<IdentityDependencies, 'fetch' | 'now'> & {
    reader: ArtifactReader; authorizationPath: string; store: BrowserSessionStore; services?: ToolServices;
  }) {
  // Explicit fields prevent even an untyped caller from overriding the authority resolver.
  const browser = createBrowserApi(configuration, {
    store: dependencies.store,
    resolveAuthorization: createGitAuthorizationResolver(dependencies.reader, dependencies.authorizationPath),
    ...(dependencies.services ? { services: dependencies.services } : {}),
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
  const boundary = createRequestBoundary((request) => browser.fetch(request));
  return new Hono().all('*', (context) => boundary(context.req.raw));
}
