import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateSavePreviewInputSchema, candidateSaveDestinationSchema, candidateProposalContinuitySchema,
  type CandidateSavePreviewInput, type CandidateSaveDestination } from '@steer/tool-registry/candidate-save-preview-contracts';
import { verifyCandidateSaveReview, type CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import { newCandidateDestinationConfigurationSchema } from './new-candidate-destination.ts';
import { createCandidateBundleReader } from './candidate-bundle-reader.ts';
import { verifyScopeInventory } from './scope-inventory.ts';
import { describeAmendmentTargetSurface } from './amendment-target-surface.ts';
import type { CorpusRepositoryReader } from './github.ts';

const destination = candidateSaveDestinationSchema.shape;
const source = z.strictObject({ path: z.string().min(1).max(500), blobSha: destination.expectedHead, contentDigest: destination.authorityDigest });
const contextSchema = newCandidateDestinationConfigurationSchema.omit({ itemIds: true }).extend({
  itemId: destination.itemId, expectedHead: destination.expectedHead, treeSha: destination.expectedHead, rootTreeSha: destination.expectedHead,
  requestDigest: destination.authorityDigest, reviewDigest: destination.authorityDigest, brief: source,
  proposalContinuity: candidateProposalContinuitySchema.optional(),
});
export const existingCandidateDestinationAuthoritySchema = contextSchema.extend({
  kind: z.literal('steer-existing-candidate-destination-authority/v1'),
  lifecycle: z.enum(['candidate-not-pulled', 'existing-target-proposal-only']), relationship: destination.relationship,
  permissionsRevision: z.string().min(1).max(200), evidenceDigest: destination.authorityDigest,
  evaluatedAt: z.iso.datetime(), validThrough: z.iso.datetime(),
  proposalContinuation: z.literal('eligible-unchanged-target').optional(),
});
export interface ExistingCandidateDestinationAuthority {
  authorize(input: Readonly<CandidateSavePreviewInput>): Promise<void>;
  authorizeSource(reference: Readonly<{ organizationId: string; subject: string; productId: string; repository: string; branch: string; revision: string; path: string }>): Promise<void>;
  /** Trusted current governed lifecycle/product/source evidence, not a browser
   * flag or inference from CANDIDATE.json presence. A candidate relationship must
   * also remain permitted. A selected proposal additionally requires independently
   * verified target lineage, current proposal openness/eligibility and a current
   * decision that changes outside the compared item surface do not invalidate the
   * original target. Return proposalContinuation only after those checks. Physical
   * equality alone is insufficient. This is preview eligibility, never writing. */
  verify(context: Readonly<z.infer<typeof contextSchema>>, input: Readonly<CandidateSavePreviewInput>, review: Readonly<CandidateSaveReviewOutput>): Promise<unknown>;
}
const artifactSchema = source.extend({ organizationId: z.string(), repositoryId: z.number().int().positive().safe(), revision: destination.expectedHead,
  content: z.string().min(1).max(131072).refine(v => !/[\uD800-\uDFFF]/u.test(v)),
});
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const fail = () => new Error('Existing candidate destination is unavailable or changed. No save authority was established.');
const proposalIdFor = (value: string) => `${value.slice(0, 8)}-${value.slice(8, 12)}-8${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;

/** Explicit, uninstalled existing-item preview port. Supports a verified pre-pull
 * revision, first amendment or explicitly selected unchanged-target continuation.
 * Never falls back to creating another proposal, or infers lifecycle from files. */
export function createExistingCandidateSaveDestination(reader: CorpusRepositoryReader, rawConfiguration: unknown, authority: ExistingCandidateDestinationAuthority) {
  const config = freeze(newCandidateDestinationConfigurationSchema.parse(rawConfiguration)), binding = freeze({ ...reader.binding });
  const { itemIds, ...scopeFields } = config, scope = freeze(scopeFields);
  const bindingValid = () => hash(reader.binding) === hash(binding) && binding.organizationId === scope.organizationId
    && binding.branch === scope.branch && `github:${binding.repositoryId}` === scope.repository;
  if (!bindingValid() || [reader.readHead, reader.readScopeInventory, reader.readArtifact, authority.authorize, authority.authorizeSource, authority.verify].some(v => typeof v !== 'function')) throw fail();
  let active = 0; const lifetime = new AbortController();
  return { scope,
    async resolve(raw: CandidateSavePreviewInput, rawReview: CandidateSaveReviewOutput, current: () => Promise<void>): Promise<CandidateSaveDestination> {
      const input = freeze(candidateSavePreviewInputSchema.parse(raw));
      if (lifetime.signal.aborted || active >= 4 || typeof current !== 'function' || !bindingValid() || !itemIds.includes(input.itemId)
        || input.choice.action !== 'extend-existing'
        || input.choice.target.path !== `items/${input.itemId}/BRIEF.md`
        || (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => input[k] !== scope[k])) throw fail();
      const target = input.choice.target;
      active++; let finished = false, pending = 0, released = false;
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(30000)]), started = Date.now();
      const release = () => { if (finished && !pending && !released) { released = true; active--; } };
      const guard = () => { signal.throwIfAborted(); if (finished || !bindingValid() || Date.now() < started) throw fail(); };
      const bounded = async <T>(run: () => Promise<T>): Promise<T> => {
        guard(); pending++; let abort = () => {};
        const task = Promise.resolve().then(() => { guard(); return run(); });
        void task.finally(() => { pending--; release(); }).catch(() => {});
        try { return await Promise.race([task, new Promise<never>((_, reject) => {
          abort = () => reject(fail()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
        })]); } finally { signal.removeEventListener('abort', abort); }
      };
      const check = async () => {
        if (await bounded(current) !== undefined || await bounded(() => authority.authorize(input)) !== undefined || await bounded(current) !== undefined) throw fail(); guard();
      };
      let priorReader: ReturnType<typeof createCandidateBundleReader> | undefined;
      try {
        await check(); const { reviewDigest, generation: _generation, itemId, proposalId: _proposal, ...reviewInput } = input;
        const review = await bounded(() => verifyCandidateSaveReview(reviewInput, rawReview));
        if (review.subject !== scope.subject || review.branch !== scope.branch || review.reviewDigest !== reviewDigest) throw fail();
        const head = destination.expectedHead.parse(await bounded(() => reader.readHead())); await check();
        if (head !== review.expectedHead || head !== target.revision) throw fail();
        const inventory = freeze(verifyScopeInventory(await bounded(() => reader.readScopeInventory(head)))); await check();
        if (inventory.organizationId !== scope.organizationId || inventory.repositoryId !== binding.repositoryId || inventory.revision !== head) throw fail();
        const root = `items/${itemId}`, entries = new Map(inventory.entries.map(e => [e.path, e])), rootEntry = entries.get(root);
        if (rootEntry?.type !== 'tree' || rootEntry.mode !== '040000') throw fail();
        const observed = new Map<string, z.infer<typeof source>>(), sources = new Map<string, ReturnType<typeof sourceReference>>();
        const inventories = new Map([[head, entries]]);
        function sourceReference(path: string, revision = head) { return freeze({ organizationId: scope.organizationId, subject: scope.subject, productId: scope.productId,
          repository: scope.repository, branch: scope.branch, revision, path }); }
        const sourceCheck = async (path: string, revision = head) => {
          const reference = sourceReference(path, revision);
          if (await bounded(() => authority.authorizeSource(reference)) !== undefined) throw fail(); await check();
          sources.set(JSON.stringify([revision, path]), reference);
        };
        const read = async (path: string, revision: string) => {
          if (!path.startsWith(`${root}/`)) throw fail();
          const entry = inventories.get(revision)?.get(path); if (entry?.type !== 'blob' || entry.mode !== '100644') throw fail();
          await sourceCheck(path, revision);
          const file = artifactSchema.parse(await bounded(() => reader.readArtifact(path, revision))), bytes = Buffer.from(file.content, 'utf8');
          if (file.organizationId !== scope.organizationId || file.repositoryId !== binding.repositoryId || file.revision !== revision || file.path !== path
            || bytes.length > 131072 || !file.content.trim() || file.blobSha !== entry.objectSha
            || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== file.blobSha
            || createHash('sha256').update(bytes).digest('hex') !== file.contentDigest) throw fail();
          await sourceCheck(path, revision);
          const metadata = source.parse({ path, blobSha: file.blobSha, contentDigest: file.contentDigest });
          const key = JSON.stringify([revision, path]);
          if (observed.has(key) && hash(observed.get(key)) !== hash(metadata)) throw fail(); observed.set(key, metadata);
          return file;
        };
        const brief = await read(target.path, head); if (brief.contentDigest !== target.contentDigest) throw fail();
        const openPrior = async (proposalId: string | null) => {
          priorReader ??= createCandidateBundleReader({ binding, readHead: () => reader.readHead(), readArtifact: read }, {
            organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository, branch: scope.branch, itemIds,
          }, check);
          return bounded(() => priorReader!.readPointer({ organizationId: scope.organizationId, productId: scope.productId,
            repository: scope.repository, branch: scope.branch, itemId, revision: head, proposalId }));
        };
        let selectedPrior: Awaited<ReturnType<typeof openPrior>> | null = null;
        let proposalContinuity: CandidateSaveDestination['proposalContinuity'];
        if (input.proposalId !== null) {
          selectedPrior = await openPrior(input.proposalId);
          const originalTarget = selectedPrior.manifest.target;
          if (selectedPrior.manifest.purpose !== 'amendment' || !originalTarget || originalTarget.itemId !== itemId) throw fail();
          const historical = originalTarget.revision === head ? inventory : freeze(verifyScopeInventory(await bounded(() => reader.readScopeInventory(originalTarget.revision))));
          await check();
          if (historical.organizationId !== scope.organizationId || historical.repositoryId !== binding.repositoryId || historical.revision !== originalTarget.revision) throw fail();
          inventories.set(originalTarget.revision, new Map(historical.entries.map(e => [e.path, e])));
          const originalSurface = describeAmendmentTargetSurface(historical, itemId), reviewedSurface = describeAmendmentTargetSurface(inventory, itemId);
          for (const path of originalSurface.paths) await sourceCheck(path, originalTarget.revision);
          for (const path of reviewedSurface.paths) await sourceCheck(path);
          const originalBrief = await read(target.path, originalTarget.revision);
          if (originalBrief.contentDigest !== brief.contentDigest || originalSurface.digest !== reviewedSurface.digest) throw fail();
          proposalContinuity = freeze(candidateProposalContinuitySchema.parse({ kind: 'steer-proposal-continuity/v1', proposalId: input.proposalId,
            targetRevision: originalTarget.revision, reviewedRevision: head, targetRootTreeSha: originalSurface.rootTreeSha, reviewedRootTreeSha: reviewedSurface.rootTreeSha,
            targetSurfaceDigest: originalSurface.digest, reviewedSurfaceDigest: reviewedSurface.digest, briefContentDigest: brief.contentDigest,
            pointerDigest: selectedPrior.pointer.contentDigest, manifestDigest: selectedPrior.reference.manifestDigest }));
        }
        const context = freeze(contextSchema.parse({ ...scope, itemId, expectedHead: head, treeSha: inventory.treeSha, rootTreeSha: rootEntry.objectSha,
          requestDigest: hash(input), reviewDigest, brief: observed.get(JSON.stringify([head, target.path])), ...(proposalContinuity ? { proposalContinuity } : {}) }));
        const verify = async () => {
          await check(); const start = performance.now(), proof = existingCandidateDestinationAuthoritySchema.parse(await bounded(() => authority.verify(context, input, review)));
          await check(); const now = Date.now(), evaluated = Date.parse(proof.evaluatedAt), expires = Date.parse(proof.validThrough);
          if ((Object.keys(context) as Array<keyof typeof context>).some(k => JSON.stringify(proof[k]) !== JSON.stringify(context[k]))
            || evaluated > now || expires <= now || expires <= evaluated || expires - evaluated > 300000) throw fail();
          const { evaluatedAt: _evaluated, validThrough: _expires, ...stable } = proof;
          return { stable, deadline: start + expires - now };
        };
        const first = await verify();
        let previousBundleDigest: string | null = null, amendment: CandidateSaveDestination['amendment'] = null;
        const relationship = first.stable.relationship, lifecycle = first.stable.lifecycle;
        if (relationship && (relationship.itemId === itemId || !itemIds.includes(relationship.itemId))) throw fail();
        if (selectedPrior) {
          if (lifecycle !== 'existing-target-proposal-only' || relationship !== null || first.stable.proposalContinuation !== 'eligible-unchanged-target') throw fail();
          previousBundleDigest = selectedPrior.reference.manifestDigest;
          amendment = { proposalId: input.proposalId!, target: selectedPrior.manifest.target!, parentProposalDigest: selectedPrior.pointer.contentDigest };
        } else if (first.stable.proposalContinuation !== undefined) throw fail();
        else if (lifecycle === 'candidate-not-pulled') {
          const prior = await openPrior(null);
          if (prior.manifest.purpose === 'amendment' || hash(prior.manifest.relationship) !== hash(relationship)) throw fail();
          previousBundleDigest = prior.reference.manifestDigest;
        } else {
          if (relationship !== null) throw fail();
          // A deterministic proposal identity is reproducible, not a reservation.
          const proposalId = proposalIdFor(hash(['steer-first-amendment-destination/v1', config, input, head]));
          const path = `${root}/proposals/${proposalId}.json`, parent = entries.get(`${root}/proposals`);
          if ((parent && (parent.type !== 'tree' || parent.mode !== '040000')) || entries.has(path)
            || inventory.entries.some(e => e.path.startsWith(`${path}/`))) throw fail();
          amendment = { proposalId, target: { itemId, revision: head }, parentProposalDigest: null };
        }
        for (const source of sources.values()) await sourceCheck(source.path, source.revision);
        if (destination.expectedHead.parse(await bounded(() => reader.readHead())) !== head) throw fail();
        const final = await verify();
        if (hash(first.stable) !== hash(final.stable) || performance.now() >= Math.min(first.deadline, final.deadline)) throw fail();
        if (destination.expectedHead.parse(await bounded(() => reader.readHead())) !== head) throw fail(); await check();
        for (const source of sources.values()) await sourceCheck(source.path, source.revision);
        if (await bounded(current) !== undefined || performance.now() >= Math.min(first.deadline, final.deadline)) throw fail(); guard();
        return freeze(candidateSaveDestinationSchema.parse({ organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository,
          branch: scope.branch, itemId, expectedHead: head, purpose: amendment ? 'amendment' : 'candidate-revision', previousBundleDigest, amendment,
          relationship, lifecycle, ...(proposalContinuity ? { proposalContinuity } : {}),
          authorityDigest: hash(['steer-existing-candidate-destination/v2', config, first.stable, [...observed.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)]) }));
      } catch { throw fail(); }
      finally { priorReader?.close(); finished = true; release(); }
    },
    close() { lifetime.abort(); },
  };
}
