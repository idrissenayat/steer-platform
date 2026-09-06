import { briefSaveReferenceSchema, briefWriteAuthoritySchema, artifactProjectionInputSchema, type BriefCreateRequest } from '@steer/tool-registry';
import { authorizationRecordSchema, type VerifiedIdentityContext } from '../identity/oidc.ts';
import { createGitWriteMembershipVerifier } from '../identity/write-membership.ts';
import { createGitHubReader, CodeHostError, type GitHubBinding } from './github.ts';
import { githubBriefConfigurationSchema } from './github-brief-store.ts';
import { createRequestBoundGitHubBriefWriter } from './github-brief-writer.ts';

/** Factory for trusted per-request composition. Current Git membership is verified
 * here, not delegated to a formatted gate-proof result. The mandatory gate verifier
 * must independently verify complete source/provider/historical-human/qualification/
 * policy evidence. No actual verifier, runtime installation or write permission is
 * provided by this factory. Owners must close each invocation, including failures. */
export function createGitHubBriefWriterFactory(binding: GitHubBinding, rawConfiguration: unknown, dependencies: {
  issuer: string; authorizationPath: string;
  verifyGateAuthority: (request: Readonly<BriefCreateRequest>, context: Readonly<VerifiedIdentityContext>) => Promise<unknown>;
  fetch: typeof globalThis.fetch; appJwt: () => Promise<string>; now?: () => Date;
}) {
  const configuration = githubBriefConfigurationSchema.parse(rawConfiguration);
  const issuer = authorizationRecordSchema.shape.issuer.parse(dependencies.issuer);
  const authorizationPath = artifactProjectionInputSchema.shape.path.parse(dependencies.authorizationPath);
  const sourceBinding = Object.freeze({ ...binding });
  if (typeof dependencies.verifyGateAuthority !== 'function' || typeof dependencies.fetch !== 'function' ||
    typeof dependencies.appJwt !== 'function' || configuration.organizationId !== binding.organizationId ||
    configuration.repository !== `github:${binding.repositoryId}` || configuration.branch !== binding.branch ||
    configuration.paths.includes(authorizationPath)) throw new CodeHostError();
  Object.freeze(configuration.paths); Object.freeze(configuration);
  return (authenticate: () => Promise<unknown>) => {
    if (typeof authenticate !== 'function') throw new CodeHostError();
    let closed = false, verifying = false;
    const open = () => { if (closed) throw new CodeHostError(); };
    const reading = () => { open(); if (!verifying) throw new CodeHostError(); };
    const current = async () => { open(); const result = await authenticate(); open(); return result; };
    const reader = createGitHubReader(sourceBinding, {
      fetch: (input, init) => { reading(); return dependencies.fetch(input, init); },
      appJwt: () => { reading(); return dependencies.appJwt(); }, ...(dependencies.now ? { now: dependencies.now } : {}),
    });
    const membership = createGitWriteMembershipVerifier(reader, {
      organizationId: configuration.organizationId, repository: configuration.repository, branch: configuration.branch,
      paths: configuration.paths, issuer, authorizationPath,
    }, { authenticate: current, ...(dependencies.now ? { now: dependencies.now } : {}) });
    const writer = createRequestBoundGitHubBriefWriter(sourceBinding, configuration, {
      issuer, authenticate: current, fetch: dependencies.fetch, appJwt: dependencies.appJwt,
      ...(dependencies.now ? { now: dependencies.now } : {}),
      verifyAuthority: async (request, context) => {
        open(); if (verifying) throw new CodeHostError(); verifying = true;
        try {
          const input = { ...Object.fromEntries(Object.keys(briefSaveReferenceSchema.shape).map((key) =>
            [key, request[key as keyof BriefCreateRequest]])), expectedHead: request.expectedHead, requestDigest: request.requestDigest };
          const before = await membership(input);
          if (before.issuer !== context.issuer || before.sessionBinding !== context.sessionBinding ||
            before.sessionEstablishedAt !== context.establishedAt) throw new CodeHostError();
          const proof = briefWriteAuthoritySchema.parse(await dependencies.verifyGateAuthority(request, context));
          const now = (dependencies.now?.() ?? new Date()).getTime(), evaluated = Date.parse(proof.evaluatedAt), expires = Date.parse(proof.validThrough);
          if (!Number.isFinite(now) || evaluated > now || now - evaluated > 5000 || expires <= now || expires <= evaluated ||
            expires - evaluated > 30000 || expires > Date.parse(context.principal.expiresAt)) throw new CodeHostError();
          const after = await membership(input); reading();
          if (after.sessionBinding !== before.sessionBinding || after.sessionEstablishedAt !== before.sessionEstablishedAt ||
            after.authorizationDigest !== before.authorizationDigest || after.authorizationBlobSha !== before.authorizationBlobSha ||
            proof.authorizationRevision !== after.authorizationRevision) throw new CodeHostError();
          // A fresh second membership read supersedes the first membership lease;
          // it cannot extend the separately verified gate lease or session expiry.
          return Object.freeze({ ...proof, validThrough: new Date(Math.min(Date.parse(proof.validThrough), Date.parse(after.validThrough))).toISOString() });
        } finally { verifying = false; }
      },
    });
    return { configuration: writer.configuration, inspect: writer.inspect, verifyWriteAuthority: writer.verifyWriteAuthority,
      compareAndCreate: writer.compareAndCreate, close: () => { closed = true; writer.close(); } };
  };
}
