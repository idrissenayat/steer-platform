import { z } from 'zod';
import { intentDevelopmentReadInputSchema, intentDevelopmentReadOutputSchema,
  type IntentDevelopmentReader, type IntentDevelopmentReadOutput } from '@steer/tool-registry/intent-development-read-contracts';
import { intentRoleResultSchema } from '@steer/tool-registry/intent-role-result';
import { createDevelopmentOriginalStore, developmentRecordsConfigurationSchema } from './development-originals.ts';
import { createDevelopmentResultStore } from './development-results.ts';
import { createDevelopmentObservationStore } from './development-observations.ts';
import { createIntentOperationStore } from './intent-operations.ts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';

type Records = Parameters<typeof createDevelopmentObservationStore>[2];
type Observation = Awaited<ReturnType<ReturnType<typeof createDevelopmentObservationStore>['read']>>['observation'];
export interface DevelopmentExchangeVerifier {
  verify(input: Readonly<{ role: 'architect' | 'test-agent'; request: unknown;
    requestObservation: Extract<Observation, { stage: 'request' }>;
    responseObservation: Extract<Observation, { stage: 'response' }> }>): Promise<unknown>;
}
const unavailable = () => new Error('Development read is unavailable.');

/** Uninstalled read-only API composition. SQL is the status source; Temporal
 * queries, retained execution configuration and bytes alone supply no authority.
 * No operation creation/claim, model call, budget mutation, retry or editor write.
 */
export function createIntentDevelopmentReader(pools: Parameters<typeof createDevelopmentOriginalStore>[0], rawConfiguration: unknown,
  dependencies: { records: Records; exchange: DevelopmentExchangeVerifier }) {
  const config = freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration));
  const scope = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository });
  const r = dependencies.records;
  if ([r?.authorize, r?.originals?.authorize, r?.originals?.authorizeOriginal, r?.originals?.authorizeOperation, r?.originals?.authorizeDraft,
    r?.originals?.keyForDraft, r?.results?.authorizeResult, r?.results?.authorizeOperation, r?.results?.authorizeDraft,
    r?.results?.keyForDraft, dependencies.exchange?.verify].some(v => typeof v !== 'function')) throw unavailable();
  let closed = false, running = 0;
  const children = new Set<{ close(): void }>();
  return {
    scope,
    async read(raw, revalidate) {
      const input = intentDevelopmentReadInputSchema.parse(raw);
      if (closed || running >= 4 || typeof revalidate !== 'function'
        || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])) throw unavailable();
      running++;
      const target = freeze({ operationId: input.operationId, inputDigest: input.inputDigest });
      let finished = false, settled = false, pending = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
      const owned: { close(): void }[] = [];
      const release = () => { if (settled && !pending && !released) { released = true; running--; } };
      const guard = () => { if (closed || finished) throw unavailable(); };
      const track = async <T>(work: Promise<T>): Promise<T> => { pending++; try { return await work; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await track(Promise.resolve().then(revalidate)) !== undefined) throw unavailable(); guard(); };
      const checked = async <T>(work: () => Promise<T>) => { await current(); const value = await track(Promise.resolve().then(work)); await current(); return value; };
      const authority = async (action: string, work: () => Promise<void>) => { if (action !== 'read' || await checked(work) !== undefined) throw unavailable(); };
      const operationAuthority = (original: boolean): Records['originals']['authorizeOperation'] => async context => {
        if (JSON.stringify(context.request) !== JSON.stringify(target)) throw unavailable();
        await authority('read', () => (original ? r.originals : r.results).authorizeOperation(context));
      };
      const secure: Records = {
        authorize: context => authority(context.action, () => r.authorize(context)),
        originals: {
          authorize: context => authority(context.action, () => r.originals.authorize(context)),
          authorizeOriginal: context => authority(context.action, () => r.originals.authorizeOriginal(context)),
          authorizeOperation: operationAuthority(true),
          authorizeDraft: context => authority(context.action, () => r.originals.authorizeDraft(context)),
          keyForDraft: (reference, keyId) => { if (keyId === null) throw unavailable(); return checked(() => r.originals.keyForDraft(reference, keyId)); },
        },
        results: {
          authorizeOperation: operationAuthority(false),
          authorizeResult: context => authority(context.action, () => r.results.authorizeResult(context)),
          authorizeDraft: context => authority(context.action, () => r.results.authorizeDraft(context)),
          keyForDraft: (reference, keyId) => { if (keyId === null) throw unavailable(); return checked(() => r.results.keyForDraft(reference, keyId)); },
        },
      };
      const scopedPools = { drafts: { connect: () => { guard(); return track(pools.drafts.connect()); } },
        execution: { connect: () => { guard(); return track(pools.execution.connect()); } } };
      const own = <T extends { close(): void }>(store: T): T => { owned.push(store); children.add(store); return store; };
      const work = Promise.resolve().then(async () => {
        await current();
        const originals = own(createDevelopmentOriginalStore(scopedPools, config, secure.originals));
        const original = await originals.read(target); guard();
        const source = original.original.source;
        const base = { kind: 'steer-development-read/v1' as const, ...input,
          source: { draftId: source.draftId, revision: source.revision, revisionDigest: source.revisionDigest,
            scopeInputDigest: source.scopeInputDigest, latestRevision: original.latestDraftRevision },
          savedToGit: false as const, gateSigned: false as const, executionAuthorized: false as const, retryAuthorized: false as const };
        if (original.operationExpired) { await current(); return intentDevelopmentReadOutputSchema.parse({ ...base, status: 'expired', steps: null, results: [] }); }
        const operations = own(createIntentOperationStore(scopedPools.execution, original.original.configuration, {
          authorize: secure.originals.authorizeOperation, verifyCheckpoint: async () => { throw unavailable(); },
        }));
        const results = own(createDevelopmentResultStore(scopedPools, original.original.configuration, secure.results));
        const observations = own(createDevelopmentObservationStore(scopedPools, config, secure));
        const inspect = async () => { const observed = await operations.inspect(target); guard(); if (observed.outcome !== 'ok') throw unavailable();
          if (observed.value.operation.draftId !== source.draftId || observed.value.operation.draftRevision !== source.revision) throw unavailable(); return observed.value; };
        const initial = await inspect(), captured: IntentDevelopmentReadOutput['results'] = [];
        for (const role of ['architect', 'test-agent'] as const) {
          const step = initial.steps.find(s => s.record.binding.stepId === role);
          if (step?.record.state !== 'succeeded') continue;
          const saved = await results.read({ ...target, stepId: role }); guard();
          if (saved.checkpoint.resultRef !== step.resultRef || saved.checkpoint.resultDigest !== step.record.resultDigest
            || saved.sourceDraftRevision !== source.revision || saved.sourceRevisionDigest !== source.revisionDigest || saved.result.role !== role) throw unavailable();
          const request = await observations.read({ ...target, stepId: role, stage: 'request' }); guard();
          const response = await observations.read({ ...target, stepId: role, stage: 'response' }); guard();
          if (request.observation.stage !== 'request' || response.observation.stage !== 'response'
            || response.observation.requestDigest !== request.payloadDigest || request.stepInputDigest !== step.record.binding.inputDigest
            || response.stepInputDigest !== step.record.binding.inputDigest || response.outputDigest !== hash(saved.result)) throw unavailable();
          const rendered = z.object({ request: z.unknown() }).parse(request.observation.rendered);
          const verified = intentRoleResultSchema.parse(await checked(() => dependencies.exchange.verify(freeze({ role, request: rendered.request,
            requestObservation: request.observation as Extract<Observation, { stage: 'request' }>,
            responseObservation: response.observation as Extract<Observation, { stage: 'response' }> }))));
          if (hash(verified) !== hash(saved.result)) throw unavailable();
          captured.push({ resultRef: saved.checkpoint.resultRef, resultDigest: saved.checkpoint.resultDigest, result: verified });
        }
        // A changing step set is not a coherent result snapshot. Fail, never mix
        // old Architect output with a newly observed Exam or publish stale success.
        await current(); const final = await originals.read(target); guard();
        if (hash(final.original) !== hash(original.original) || final.operationExpired || hash(await inspect()) !== hash(initial)) throw unavailable();
        base.source.latestRevision = final.latestDraftRevision;
        const steps = (['architect', 'test-agent'] as const).map(role => ({ role, state: initial.steps.find(s => s.record.binding.stepId === role)?.record.state ?? 'pending' }));
        const architect = captured.find(r => r.result.role === 'architect')?.result;
        const status = final.latestDraftRevision !== source.revision ? 'superseded'
          : steps.some(s => ['outcome-unknown', 'failed-known'].includes(s.state)) ? 'attention-required'
            : architect?.role === 'architect' && architect.output.questions.length ? 'needs-clarification'
              : captured.length === 2 ? 'candidates-ready' : 'pending';
        const output = intentDevelopmentReadOutputSchema.parse({ ...base, status, steps, results: captured }); await current(); return freeze(output);
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); for (const child of owned) { child.close(); children.delete(child); } }
    },
    close() { closed = true; for (const child of children) child.close(); },
  } satisfies IntentDevelopmentReader & { close(): void };
}
