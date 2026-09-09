import { z } from 'zod';
import { candidateSavePrepareInputSchema, candidateSavePrepareOutputSchema,
  type CandidateSavePreparer, type CandidateSavePrepareInput, type CandidateSavePrepareOutput } from '@steer/tool-registry/candidate-save-prepare-contracts';
import { describeCandidateSavePreview, verifyCandidateSavePreview,
  type CandidateSavePreviewer, type CandidateSavePreviewOutput } from '@steer/tool-registry/candidate-save-preview-contracts';
import { intentDraftReadOutputSchema, type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createCandidateAdmission, candidateAdmissionOptionsSchema, candidateRequestSchema } from './candidate-admission.ts';
import { createCandidateOriginalStore, candidateOriginalConfigurationSchema } from './candidate-originals.ts';
import { intentOperationConfigurationSchema } from './intent-operations.ts';
import { freezeOriginal as freeze } from './development-original-contracts.ts';
import type { DatabasePool } from './runtime-pool.ts';

const configuration = z.strictObject({ execution: intentOperationConfigurationSchema, records: candidateOriginalConfigurationSchema });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fail = () => new Error('Candidate confirmation is unavailable.');
class Conflict extends Error {}
/** Uninstalled human confirmation -> one admission -> immutable encrypted
 * original/readback. No provider writer, model, scheduler or gate signer exists
 * in this composition. A lost acknowledgement permits only exact re-preparation
 * under unchanged current authority; it never authorizes another save dispatch. */
export function createCandidateSavePreparer(pools: { execution: DatabasePool; drafts: DatabasePool }, raw: unknown, rawOptions: unknown, deps: {
  drafts: IntentDraftService; previewer: CandidateSavePreviewer;
  authorizeConfirmation(input: CandidateSavePrepareInput, preview: CandidateSavePreviewOutput): Promise<void>;
  authorizeOperation: Parameters<typeof createCandidateAdmission>[3];
  records: Omit<Parameters<typeof createCandidateOriginalStore>[2], 'verifyOriginal'>;
}) {
  const config = freeze(configuration.parse(raw)), options = freeze(candidateAdmissionOptionsSchema.parse(rawOptions));
  const { recordsPolicyDigest: _policy, ...scope } = config.records;
  if (config.execution.action !== 'candidate-save' || config.execution.budget !== null
    || (['organizationId', 'subject', 'productId', 'repository', 'branch', 'recordsPolicyDigest'] as const).some(k => config.execution[k] !== config.records[k])
    || [deps.drafts?.read, deps.previewer?.preview, deps.authorizeConfirmation, deps.authorizeOperation,
      deps.records?.authorize, deps.records?.lifecycle, deps.records?.keyForDraft].some(v => typeof v !== 'function')) throw fail();
  let active = 0, closed = false; const children = new Set<{ close(): void }>();
  return { scope: freeze(scope),
    async prepare(rawInput, revalidate) {
      const input = freeze(candidateSavePrepareInputSchema.parse(rawInput));
      const scopeChanged = () => (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => input.preview[k] !== scope[k])
        || (['organizationId', 'subject', 'productId', 'repository'] as const).some(k => deps.drafts.scope[k] !== scope[k])
        || (Object.keys(scope) as Array<keyof typeof scope>).some(k => deps.previewer.scope[k] !== scope[k]);
      if (closed || active >= 4 || typeof revalidate !== 'function' || scopeChanged()) throw fail();
      active++; let finished = false, settled = false, pending = 0, released = false, effectPossible = false;
      let timer: ReturnType<typeof setTimeout> | undefined, reference: CandidateSavePrepareOutput['reference'] = null;
      const owned: { close(): void }[] = [];
      const release = () => { if (settled && !pending && !released) { released = true; active--; } };
      const guard = () => { if (closed || finished || scopeChanged()) throw fail(); };
      const track = async <T>(task: Promise<T>) => { pending++; try { return await task; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await track(Promise.resolve().then(revalidate)) !== undefined) throw fail(); guard(); };
      const checked = async <T>(task: () => Promise<T>) => { await current(); const value = await track(Promise.resolve().then(task)); await current(); return value; };
      const authorize = async (task: () => Promise<void>) => { if (await checked(task) !== undefined) throw fail(); };
      const own = <T extends { close(): void }>(store: T) => { owned.push(store); children.add(store); return store; };
      const pool = (source: DatabasePool): DatabasePool => ({ connect: async () => {
        guard(); const client = await track(source.connect());
        try { guard(); return client; } catch (error) { client.release(true); throw error; }
      } });
      const output = (outcome: CandidateSavePrepareOutput['outcome']) => freeze(candidateSavePrepareOutputSchema.parse({
        kind: 'steer-candidate-save-prepare/v1', input, outcome, reference: ['prepared', 'unknown'].includes(outcome) ? reference : null,
        originalPreserved: outcome === 'prepared', readyToRequestStart: outcome === 'prepared',
        savedToGit: false, executionAuthorized: false, gateSigned: false,
      }));
      const work = Promise.resolve().then(async () => {
        const read = async () => {
          const draft = intentDraftReadOutputSchema.parse(await checked(() => deps.drafts.read({ organizationId: scope.organizationId,
            productId: scope.productId, repository: scope.repository, draftId: input.preview.draftId, revision: input.preview.revision }, current)));
          if (draft.latestRevision !== input.preview.revision || !draft.content.documents
            || (['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => draft[k] !== input.preview[k])) throw new Conflict();
          return freeze(draft);
        };
        const draft = await read();
        const preview = await verifyCandidateSavePreview(input.preview, await checked(() => deps.previewer.preview(input.preview, current)), draft.content.documents);
        if (preview.previewDigest !== input.previewDigest || !equal(preview.proposedConfirmation, input.confirmation)
          || preview.manifest.lineage.serviceCommitter !== options.serviceCommitter) throw new Conflict();
        const described = await describeCandidateSavePreview(input.preview, preview.review, draft.content.documents,
          preview.generation, preview.destination, options.serviceCommitter); guard();
        const confirmation = async () => { await authorize(() => deps.authorizeConfirmation(input, preview)); };
        const source = async () => { if (!equal(await read(), draft)) throw new Conflict(); await confirmation(); };
        const recheck = async () => {
          await source();
          const fresh = await verifyCandidateSavePreview(input.preview, await checked(() => deps.previewer.preview(input.preview, current)), draft.content.documents);
          if (!equal(fresh, preview)) throw new Conflict(); await source();
        };
        const admission = own(createCandidateAdmission(pool(pools.execution), config.execution, options,
          async context => { await confirmation(); await authorize(() => deps.authorizeOperation(context)); }));
        await source(); effectPossible = true;
        const admitted = await admission.prepare(described.submission); guard();
        if (admitted.outcome !== 'prepared') return output('unknown');
        // Admission appends its minted ID. Canonicalize schema field order before
        // comparing with the encrypted store's independently parsed request.
        const request = freeze(candidateRequestSchema.parse(admitted.request)), plan = await planCandidateBundle(request.bundle, request.confirmation); guard();
        reference = freeze({ organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository, branch: scope.branch,
          draftId: input.preview.draftId, draftRevision: input.preview.revision, operationId: request.bundle.operationId, inputDigest: plan.inputDigest });
        const target = freeze({ organizationId: scope.organizationId, operationId: reference.operationId, inputDigest: reference.inputDigest });
        const records = own(createCandidateOriginalStore(pool(pools.drafts), config.records, {
          authorize: async context => { if (!equal(context.target, target)) throw fail(); await confirmation(); await authorize(() => deps.records.authorize(context)); },
          verifyOriginal: async original => { if (!equal(original, request)) throw fail(); await checked(() => admission.verifyOriginal(original)); await source(); },
          lifecycle: ref => { if (ref.draftId !== input.preview.draftId) throw fail(); return checked(() => deps.records.lifecycle(ref)); },
          keyForDraft: (ref, keyId) => { if (ref.draftId !== input.preview.draftId) throw fail(); return checked(() => deps.records.keyForDraft(ref, keyId)); },
        }));
        await source();
        const preserved = await records.put(request); guard();
        if (preserved.outcome !== 'stored') return output('unknown');
        const original = await records.read(target); guard();
        if (!equal(original, request)) throw fail();
        await recheck(); return output('prepared');
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(fail()), 90000); })]); }
      catch (error) { return output(effectPossible ? 'unknown' : error instanceof Conflict ? 'conflict' : 'unavailable'); }
      finally { finished = true; if (timer) clearTimeout(timer); for (const child of owned) { child.close(); children.delete(child); } }
    },
    close() { closed = true; children.forEach(child => child.close()); },
  } satisfies CandidateSavePreparer & { close(): void };
}
