import { createHash } from 'node:crypto';
import { z } from 'zod';
import { principalSchema, briefSaveReferenceSchema, briefWriteAuthoritySchema,
  type BriefWriter, type BriefCreateRequest, type BriefSaveReference, type BriefSaveObservation, type BriefWriteAuthority, type Principal } from '@steer/tool-registry';
import { authorizationRecordSchema, type VerifiedIdentityContext } from '../identity/oidc.ts';
import { CodeHostError, type GitHubBinding } from './github.ts';
import { createGitHubBriefStore, githubBriefConfigurationSchema, githubBriefRequestSchema } from './github-brief-store.ts';

const contextSchema = z.strictObject({ issuer: authorizationRecordSchema.shape.issuer,
  establishedAt: z.iso.datetime({ precision: 3 }), sessionBinding: z.string().length(64).regex(/^[a-f0-9]{64}$/),
  principal: principalSchema.extend({ expiresAt: z.iso.datetime({ precision: 3 }) }),
});
const required = ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'];
const sameReference = (a: BriefSaveReference, b: BriefSaveReference) =>
  (Object.keys(briefSaveReferenceSchema.shape) as (keyof BriefSaveReference)[]).every((key) => a[key] === b[key]);

/** Construct per authenticated invocation; never share a request's credentials
 * through a global writer. Full source-backed authority verification is mandatory
 * and still must be supplied by trusted composition, not HTTP facts. This module
 * does not install that verifier, any runtime writer or provider permissions. */
export function createRequestBoundGitHubBriefWriter(binding: GitHubBinding, rawConfiguration: unknown, dependencies: {
  issuer: string; authenticate: () => Promise<unknown>;
  verifyAuthority: (request: Readonly<BriefCreateRequest>, context: Readonly<VerifiedIdentityContext>) => Promise<unknown>;
  fetch: typeof globalThis.fetch; appJwt: () => Promise<string>; now?: () => Date;
}): Pick<BriefWriter, 'configuration'> & {
  inspect(reference: BriefSaveReference, principal: Principal): Promise<BriefSaveObservation>;
  verifyWriteAuthority(request: BriefCreateRequest, principal: Principal): Promise<BriefWriteAuthority>;
  compareAndCreate(request: BriefCreateRequest, authority: BriefWriteAuthority): Promise<BriefSaveObservation>;
  close(): void;
} {
  const configuration = githubBriefConfigurationSchema.parse(rawConfiguration);
  const issuer = authorizationRecordSchema.shape.issuer.parse(dependencies.issuer);
  if (typeof dependencies.authenticate !== 'function' || typeof dependencies.verifyAuthority !== 'function' ||
    typeof dependencies.fetch !== 'function' || typeof dependencies.appJwt !== 'function') throw new CodeHostError();
  Object.freeze(configuration.paths); Object.freeze(configuration);
  const clock = dependencies.now ?? (() => new Date());
  let baseline: z.infer<typeof contextSchema> | undefined, closed = false, busy = false;
  let deadline = Infinity, last = -Infinity, timedOut = false;
  const time = () => {
    const now = clock().getTime();
    if (closed || timedOut || !Number.isFinite(now) || now < last || now >= deadline) throw new CodeHostError();
    last = now; return now;
  };
  const scope = (raw: BriefSaveReference) => {
    const ref = briefSaveReferenceSchema.parse(raw);
    if (ref.organizationId !== configuration.organizationId || ref.repository !== configuration.repository ||
      ref.branch !== configuration.branch || !configuration.paths.includes(ref.path)) throw new CodeHostError();
    return ref;
  };
  const capture = async (ref: BriefSaveReference, write: boolean, supplied?: Principal) => {
    time(); const context = contextSchema.parse(await dependencies.authenticate()); const now = time();
    const principal = context.principal, caller = supplied === undefined ? null : principalSchema.parse(supplied);
    if (context.issuer !== issuer || principal.type !== 'human' || principal.subject !== ref.subject || principal.organizationId !== ref.organizationId ||
      Date.parse(context.establishedAt) > now || Date.parse(context.establishedAt) >= Date.parse(principal.expiresAt) ||
      Date.parse(principal.expiresAt) <= now || (write ? required : ['intent.brief.save.status']).some((grant) => !principal.toolGrants.includes(grant)) ||
      new Set(principal.hats).size !== principal.hats.length || new Set(principal.toolGrants).size !== principal.toolGrants.length ||
      (caller && (caller.type !== 'human' || caller.subject !== principal.subject || caller.organizationId !== principal.organizationId || Date.parse(caller.expiresAt) <= now))) throw new CodeHostError();
    if (baseline && (baseline.issuer !== context.issuer || baseline.sessionBinding !== context.sessionBinding ||
      baseline.establishedAt !== context.establishedAt || baseline.principal.subject !== principal.subject ||
      baseline.principal.organizationId !== principal.organizationId || Date.parse(baseline.principal.expiresAt) <= now)) throw new CodeHostError();
    Object.freeze(principal.hats); Object.freeze(principal.toolGrants); Object.freeze(principal); Object.freeze(context);
    baseline ??= context;
    return context;
  };
  const request = (raw: BriefCreateRequest) => {
    const value = githubBriefRequestSchema.parse(raw); scope(briefSaveReferenceSchema.parse(Object.fromEntries(
      Object.keys(briefSaveReferenceSchema.shape).map((key) => [key, value[key as keyof BriefCreateRequest]]))));
    const bytes = Buffer.from(value.content, 'utf8');
    if (bytes.length > 32768 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== value.content ||
      createHash('sha256').update(bytes).digest('hex') !== value.contentDigest ||
      createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== value.contentBlobSha ||
      value.operationPath !== `.steer/authoring/operations/${value.idempotencyKey}.json`) throw new CodeHostError();
    return value;
  };
  const check = (raw: unknown, value: BriefCreateRequest, identities: readonly Principal[]) => {
    const proof = briefWriteAuthoritySchema.parse(raw), now = time();
    const evaluated = Date.parse(proof.evaluatedAt), expiry = Date.parse(proof.validThrough);
    if (!sameReference(proof, value) || proof.requestDigest !== value.requestDigest || proof.expectedHead !== value.expectedHead ||
      proof.authorizationRevision !== value.expectedHead || proof.platformRevision !== configuration.platformRevision ||
      proof.gate2DecisionDigest !== configuration.gate2DecisionDigest || evaluated > now || now - evaluated > 5000 ||
      expiry <= now || expiry <= evaluated || expiry - evaluated > 30000 ||
      identities.some((identity) => expiry > Date.parse(identity.expiresAt)) || !baseline || expiry > Date.parse(baseline.principal.expiresAt)) throw new CodeHostError();
    return Object.freeze(proof);
  };
  const authorize = async (raw: BriefCreateRequest, supplied?: Principal) => {
    const value = request(raw), before = await capture(value, true, supplied);
    const proof = await dependencies.verifyAuthority(Object.freeze({ ...value }), before);
    const after = await capture(value, true, supplied);
    return check(proof, value, [before.principal, after.principal]);
  };
  const store = createGitHubBriefStore(binding, configuration, {
    fetch: (input, init) => { time(); return dependencies.fetch(input, init); },
    appJwt: () => { time(); return dependencies.appJwt(); }, now: clock,
    // This callback is deliberately not a cached proof from the outer registry.
    // The store invokes it again after obtaining its narrow write token.
    verifyAuthority: (value) => authorize(value),
  });
  const operation = async <T>(run: () => Promise<T>) => {
    if (closed || busy) throw new CodeHostError();
    deadline = Infinity; timedOut = false; const started = time(); deadline = started + 15000; busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A timed-out dependency is not cancellable. Keep single-flight until it
    // settles, and forbid it from starting another provider request afterward.
    const work = Promise.resolve().then(run).finally(() => { busy = false; });
    try { return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { timedOut = true; reject(new CodeHostError()); }, 15000);
    })]); } finally { clearTimeout(timer); }
  };
  return {
    configuration,
    inspect: (raw, principal) => operation(async () => {
      const ref = scope(raw); await capture(ref, false, principal);
      const result = await store.inspect(ref); await capture(ref, false, principal); return result;
    }),
    verifyWriteAuthority: (raw, principal) => operation(() => authorize(raw, principal)),
    compareAndCreate: (raw, authority: BriefWriteAuthority) => operation(async () => {
      const value = request(raw), initial = await capture(value, true);
      check(authority, value, [initial.principal]);
      try {
        const result = await store.compareAndCreate(value);
        await capture(value, true); return result;
      } catch {
        // A denied/closed session after dispatch cannot imply rollback or retry.
        const reference = Object.fromEntries(Object.keys(briefSaveReferenceSchema.shape).map((key) => [key, value[key as keyof BriefCreateRequest]]));
        return { ...briefSaveReferenceSchema.parse(reference), outcome: 'unknown' as const };
      }
    }),
    close: () => { closed = true; },
  };
}
