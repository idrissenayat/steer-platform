import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import type { ArtifactReader } from '@steer/adapters/github';
import type { BrowserSessionConfiguration, BrowserSessionStore } from '@steer/adapters/browser-session';
import type { IdentityDependencies } from '@steer/adapters/identity';
import { createBrowserApi } from './browser.ts';
import { Hono } from 'hono';
import { createRequestBoundary } from './request-boundary.ts';
import type { ToolServices } from '@steer/tool-registry';
import type { SessionBriefWriterFactory } from './request-writer.ts';

/** Trusted startup composition, never populated from a request or token claim. */
export function createGitBackedBrowserApi(configuration: BrowserSessionConfiguration,
  dependencies: Pick<IdentityDependencies, 'fetch' | 'now'> & {
    reader: ArtifactReader; authorizationPath: string; store: BrowserSessionStore; services?: ToolServices; createBriefWriter?: SessionBriefWriterFactory;
  }) {
  // Explicit fields prevent even an untyped caller from overriding the authority resolver.
  const authorization = createGitAuthorizationResolver(dependencies.reader, dependencies.authorizationPath);
  const browser = createBrowserApi(configuration, {
    store: dependencies.store,
    resolveAuthorization: authorization,
    ...(dependencies.services ? { services: dependencies.services } : {}),
    ...(dependencies.createBriefWriter ? { createBriefWriter: dependencies.createBriefWriter } : {}),
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
  const boundary = createRequestBoundary((request) => browser.fetch(request));
  return Object.assign(new Hono().all('*', (context) => authorization.withinRequest(() => boundary(context.req.raw))),
    { close: authorization.close });
}
