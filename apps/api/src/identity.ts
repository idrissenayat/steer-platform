import { createOidcAuthenticator, createOidcContextAuthenticator, type IdentityDependencies, type OidcConfiguration } from '@steer/adapters/identity';
import { createApi } from './app.ts';
import { createMcpEndpoint } from './mcp.ts';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import type { ArtifactReader } from '@steer/adapters/github';
import type { ToolServices } from '@steer/tool-registry';
import type { SessionBriefWriterFactory } from './request-writer.ts';

/** Composition boundary; CLI stays deny-all until the authoritative grant source exists. */
export function createOidcApi(configuration: OidcConfiguration, dependencies: IdentityDependencies) {
  return createApi({
    authenticate: createOidcAuthenticator(configuration, dependencies),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
}

/** Remote-agent transport uses the existing OIDC verifier and fixed Git authority, never caller grants. */
export function createGitBackedMcpEndpoint(publicOrigin: string, configuration: OidcConfiguration,
  dependencies: Pick<IdentityDependencies, 'fetch' | 'now'> & { reader: ArtifactReader; authorizationPath: string; services?: ToolServices; createBriefWriter?: SessionBriefWriterFactory }) {
  const authenticateContext = createOidcContextAuthenticator(configuration, {
      resolveAuthorization: createGitAuthorizationResolver(dependencies.reader, dependencies.authorizationPath),
      ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}), ...(dependencies.now ? { now: dependencies.now } : {}),
    });
  return createMcpEndpoint(publicOrigin, {
    authenticate: async (request) => (await authenticateContext(request))?.principal ?? null,
    ...(dependencies.createBriefWriter ? { createBriefWriter: (request: Request) => dependencies.createBriefWriter!(() => authenticateContext(request)) } : {}),
    ...(dependencies.services ? { services: dependencies.services } : {}), ...(dependencies.now ? { now: dependencies.now } : {}),
  });
}
