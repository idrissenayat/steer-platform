import { createOidcAuthenticator, type IdentityDependencies, type OidcConfiguration } from '@steer/adapters/identity';
import { createApi } from './app.ts';

/** Composition boundary; CLI stays deny-all until the authoritative grant source exists. */
export function createOidcApi(configuration: OidcConfiguration, dependencies: IdentityDependencies) {
  return createApi({
    authenticate: createOidcAuthenticator(configuration, dependencies),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
}
