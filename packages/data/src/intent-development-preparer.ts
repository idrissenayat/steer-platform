import { intentDevelopmentPrepareInputSchema, intentDevelopmentPrepareOutputSchema,
  type IntentDevelopmentPreparer, type IntentDevelopmentPrepareInput, type IntentDevelopmentPrepareOutput } from '@steer/tool-registry/intent-development-prepare-contracts';
import { buildIntentEvidenceEnvelope, intentEvidenceInputSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { resolveDevelopmentScopeReview, revalidateDevelopmentScopeReview } from './development-scope-review.ts';
import { createDraftRevisionStore } from './draft-revisions.ts';
import { createIntentOperationStore, intentOperationConfigurationSchema } from './intent-operations.ts';
import { createDevelopmentOriginalStore, developmentRecordsConfigurationSchema } from './development-originals.ts';
import { describeDevelopmentOriginal, developmentOriginalSchema, developmentOriginalHash as hash, freezeOriginal as freeze,
  type DevelopmentOriginal } from './development-original-contracts.ts';

type Records = Parameters<typeof createDevelopmentOriginalStore>[2];
const unavailable = () => new Error('Development preparation is unavailable.');
class Conflict extends Error {}

/** Uninstalled preparation/admission, not generation. Fixed execution/profile
 * bytes include the original expiry; retry must never renew them. Evidence and
 * approval services are mandatory trusted ports, not request attestations. */
export function createIntentDevelopmentPreparer(pools: Parameters<typeof createDevelopmentOriginalStore>[0], rawConfiguration: unknown,
  rawProfiles: unknown, deps: { records: Records;
    requireScopeReview?: boolean;
    evidenceFor(input: Readonly<IntentDevelopmentPrepareInput>, revalidate: () => Promise<void>): Promise<unknown>;
    authorizePreparation(original: Readonly<DevelopmentOriginal>): Promise<void>;
  }) {
  const execution = freeze(intentOperationConfigurationSchema.parse(rawConfiguration));
  if (execution.action !== 'develop') throw unavailable();
  const { action: _action, expiresAt: _expiry, budget: _budget, ...recordsConfig } = execution;
  const config = freeze(developmentRecordsConfigurationSchema.parse(recordsConfig));
  const profiles = freeze(developmentOriginalSchema.shape.profiles.parse(rawProfiles)), r = deps.records;
  if ([r?.authorize, r?.authorizeOriginal, r?.authorizeOperation, r?.authorizeDraft, r?.keyForDraft, deps.evidenceFor, deps.authorizePreparation]
    .some(v => typeof v !== 'function')) throw unavailable();
  const scope = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository, configurationRevision: config.configurationRevision });
  let closed = false, active = 0; const children = new Set<{ close(): void }>();
  return {
    scope,
    async prepare(raw, revalidate) {
      const input = intentDevelopmentPrepareInputSchema.parse(raw);
      if (deps.requireScopeReview && !input.scopeReview) throw unavailable();
      if (closed || active >= 4 || typeof revalidate !== 'function' || (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => input[k] !== scope[k])) throw unavailable();
      active++;
      let finished = false, settled = false, pending = 0, released = false, effectPossible = false, timer: ReturnType<typeof setTimeout> | undefined;
      let reference: IntentDevelopmentPrepareOutput['reference'] = null, coverage: IntentDevelopmentPrepareOutput['coverage'] = null;
      const owned: { close(): void }[] = [];
      const release = () => { if (settled && !pending && !released) { released = true; active--; } };
      const guard = () => { if (finished || closed) throw unavailable(); };
      const track = async <T>(work: Promise<T>) => { pending++; try { return await work; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await track(Promise.resolve().then(revalidate)) !== undefined) throw unavailable(); guard(); };
      const checked = async <T>(work: () => Promise<T>) => { await current(); const value = await track(Promise.resolve().then(work)); await current(); return value; };
      const authority = async (work: () => Promise<void>) => { if (await checked(work) !== undefined) throw unavailable(); };
      const scopedPools = { drafts: { connect: () => { guard(); return track(pools.drafts.connect()); } },
        execution: { connect: () => { guard(); return track(pools.execution.connect()); } } };
      const own = <T extends { close(): void }>(store: T) => { owned.push(store); children.add(store); return store; };
      const output = (outcome: IntentDevelopmentPrepareOutput['outcome']) => freeze(intentDevelopmentPrepareOutputSchema.parse({
        ...input, kind: 'steer-development-prepare/v1', outcome, reference: ['prepared', 'unknown'].includes(outcome) ? reference : null, coverage,
        originalPreserved: outcome === 'prepared', readyToRequestStart: outcome === 'prepared', semanticReviewComplete: false,
        authoritativeClearance: false, executionAuthorized: false, documentsReady: false, savedToGit: false, gateSigned: false,
      }));
      const work = Promise.resolve().then(async () => {
        await current();
        const sourceAuthority: Records['authorizeDraft'] = async c => {
          if (c.action !== 'read' || c.draftId !== input.draftId) throw unavailable(); await authority(() => r.authorizeDraft(c));
        };
        const historicalKey: Records['keyForDraft'] = (ref, keyId) => {
          if (ref.draftId !== input.draftId || keyId === null) throw unavailable(); return checked(() => r.keyForDraft(ref, keyId));
        };
        const drafts = own(createDraftRevisionStore(scopedPools.drafts, config, { authorize: sourceAuthority, keyForDraft: historicalKey }));
        const read = async () => {
          const found = await drafts.read({ draftId: input.draftId, revision: input.revision }); guard();
          if (found.latestRevision !== input.revision || found.reference.revisionDigest !== input.revisionDigest || found.reference.scopeInputDigest !== input.scopeInputDigest) throw new Conflict();
          return found;
        };
        const source = await read();
        const evidence = intentEvidenceInputSchema.parse(await checked(() => deps.evidenceFor(freeze(input), current)));
        const envelope = await buildIntentEvidenceEnvelope(evidence); guard();
        if ((['organizationId', 'productId', 'repository', 'branch'] as const).some(k => evidence[k] !== config[k])
          || evidence.scopeInputDigest !== input.scopeInputDigest || envelope.sourceSnapshotDigest !== input.sourceSnapshotDigest) throw new Conflict();
        const { gaps: _gaps, ...summary } = { ...envelope.coverage, gapCount: envelope.coverage.gaps.length }; coverage = summary;
        if (!envelope.coverage.complete) { await read(); await current(); return output('scope-incomplete'); }
        const scopeReview = input.scopeReview ? await checked(() => resolveDevelopmentScopeReview(input.scopeReview!, evidence,
          { ...input, subject: config.subject }, r.scopeReview, current)) : undefined;
        const described = await describeDevelopmentOriginal({ kind: 'steer-development-original/v1', configuration: execution,
          source: { draftId: input.draftId, revision: input.revision, sourceRevision: source.reference.sourceRevision,
            revisionDigest: input.revisionDigest, scopeInputDigest: input.scopeInputDigest, content: source.content }, evidence,
          direction: { choice: input.choice, scopeInputDigest: input.scopeInputDigest, sourceSnapshotDigest: input.sourceSnapshotDigest,
            ...(scopeReview ? { scopeReview } : {}) }, profiles });
        const original = described.original, submission = freeze({ draftId: input.draftId, draftRevision: input.revision, inputDigest: described.inputDigest });
        const recheck = async () => {
          await current(); if (hash(await read()) !== hash(source)) throw new Conflict();
          const fresh = intentEvidenceInputSchema.parse(await checked(() => deps.evidenceFor(freeze(input), current)));
          if (hash(fresh) !== hash(evidence)) throw new Conflict();
          await authority(() => deps.authorizePreparation(original));
          await checked(() => revalidateDevelopmentScopeReview(original, r.scopeReview, current));
          if (hash(await read()) !== hash(source)) throw new Conflict();
          const final = intentEvidenceInputSchema.parse(await checked(() => deps.evidenceFor(freeze(input), current)));
          if (hash(final) !== hash(evidence)) throw new Conflict();
          await current();
        };
        const secured: Records = {
          ...(r.scopeReview ? { scopeReview: r.scopeReview } : {}),
          authorize: async c => { if (!reference || hash(c.target) !== hash(reference)) throw unavailable(); await authority(() => r.authorize(c)); },
          authorizeOriginal: async c => { if (hash(c.original) !== hash(original)) throw unavailable(); await authority(() => r.authorizeOriginal(c)); },
          authorizeOperation: async c => { if (hash(c.request) !== hash(submission) && (!reference || hash(c.request) !== hash(reference))) throw unavailable(); await authority(() => r.authorizeOperation(c)); },
          authorizeDraft: sourceAuthority,
          keyForDraft: (ref, keyId) => { if (ref.draftId !== input.draftId) throw unavailable(); return checked(() => r.keyForDraft(ref, keyId)); },
        };
        const operations = own(createIntentOperationStore(scopedPools.execution, execution, { authorize: secured.authorizeOperation, verifyCheckpoint: async () => { throw unavailable(); } }));
        await recheck(); effectPossible = true;
        const admitted = await operations.create(submission); guard();
        if (admitted.outcome !== 'ok') return output(admitted.outcome);
        reference = freeze({ operationId: admitted.value.operationId, inputDigest: described.inputDigest });
        await recheck(); const originals = own(createDevelopmentOriginalStore(scopedPools, config, secured));
        const preserved = await originals.put({ ...reference, original }); guard();
        if (preserved.outcome !== 'stored') return output(preserved.outcome);
        const recovered = await originals.read(reference); guard();
        if (hash(recovered.original) !== hash(original) || recovered.latestDraftRevision !== input.revision || recovered.operationExpired) throw unavailable();
        await recheck(); return output('prepared');
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch (error) { return output(effectPossible ? 'unknown' : error instanceof Conflict ? 'conflict' : 'unavailable'); }
      finally { finished = true; if (timer) clearTimeout(timer); for (const child of owned) { child.close(); children.delete(child); } }
    },
    close() { closed = true; children.forEach(child => child.close()); },
  } satisfies IntentDevelopmentPreparer & { close(): void };
}
