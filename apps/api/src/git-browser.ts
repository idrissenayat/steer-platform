import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import type { ArtifactReader } from '@steer/adapters/github';
import type { BrowserSessionConfiguration, BrowserSessionStore } from '@steer/adapters/browser-session';
import type { IdentityDependencies } from '@steer/adapters/identity';
import { createBrowserApi } from './browser.ts';

/** Trusted startup composition, never populated from a request or token claim. */
export function createGitBackedBrowserApi(configuration: BrowserSessionConfiguration,
  dependencies: Pick<IdentityDependencies, 'fetch' | 'now'> & {
    reader: ArtifactReader; authorizationPath: string; store: BrowserSessionStore;
  }) {
  // Explicit fields prevent even an untyped caller from overriding the authority resolver.
  return createBrowserApi(configuration, {
    store: dependencies.store,
    resolveAuthorization: createGitAuthorizationResolver(dependencies.reader, dependencies.authorizationPath),
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
}
