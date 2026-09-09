import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateSavePreviewInputSchema, candidateSaveDestinationSchema,
  type CandidateSavePreviewInput, type CandidateSaveDestination } from '@steer/tool-registry/candidate-save-preview-contracts';
import { verifyCandidateSaveReview, type CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import { newCandidateDestinationConfigurationSchema } from './new-candidate-destination.ts';
import { createCandidateBundleReader } from './candidate-bundle-reader.ts';
import { verifyScopeInventory } from './scope-inventory.ts';
import type { CorpusRepositoryReader } from './github.ts';

const destination = candidateSaveDestinationSchema.shape;
const source = z.strictObject({ path: z.string().min(1).max(500), blobSha: destination.expectedHead, contentDigest: destination.authorityDigest });
const contextSchema = newCandidateDestinationConfigurationSchema.omit({ itemIds: true }).extend({
  itemId: destination.itemId, expectedHead: destination.expectedHead, treeSha: destination.expectedHead, rootTreeSha: destination.expectedHead,
  requestDigest: destination.authorityDigest, reviewDigest: destination.authorityDigest, brief: source,
});
export const existingCandidateDestinationAuthoritySchema = contextSchema.extend({
  kind: z.literal('steer-existing-candidate-destination-authority/v1'),
  lifecycle: z.enum(['candidate-not-pulled', 'existing-target-proposal-only']), relationship: destination.relationship,
  permissionsRevision: z.string().min(1).max(200), evidenceDigest: destination.authorityDigest,
  evaluatedAt: z.iso.datetime(), validThrough: z.iso.datetime(),
});
export interface ExistingCandidateDestinationAuthority {
  authorize(input: Readonly<CandidateSavePreviewInput>): Promise<void>;
  authorizeSource(reference: Readonly<{ organizationId: string; subject: string; productId: string; repository: string; branch: string; revision: string; path: string }>): Promise<void>;
  /** Trusted current governed lifecycle/product/source evidence, not a browser
   * flag or inference from CANDIDATE.json presence. A candidate relationship must
   * also remain permitted. This establishes preview eligibility, never writing. */
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
 * candidate revision or FIRST immutable-target amendment. Existing proposals
 * remain closed until historical-target versus current-review binding is resolved.
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
        || input.proposalId !== null || input.choice.action !== 'extend-existing'
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
        const observed = new Map<string, z.infer<typeof source>>();
        const sourceReference = (path: string) => freeze({ organizationId: scope.organizationId, subject: scope.subject, productId: scope.productId,
          repository: scope.repository, branch: scope.branch, revision: head, path });
        const sourceCheck = async (path: string) => { if (await bounded(() => authority.authorizeSource(sourceReference(path))) !== undefined) throw fail(); await check(); };
        const read = async (path: string, revision: string) => {
          if (revision !== head || !path.startsWith(`${root}/`)) throw fail();
          const entry = entries.get(path); if (entry?.type !== 'blob' || entry.mode !== '100644') throw fail();
          await sourceCheck(path);
          const file = artifactSchema.parse(await bounded(() => reader.readArtifact(path, revision))), bytes = Buffer.from(file.content, 'utf8');
          if (file.organizationId !== scope.organizationId || file.repositoryId !== binding.repositoryId || file.revision !== head || file.path !== path
            || bytes.length > 131072 || !file.content.trim() || file.blobSha !== entry.objectSha
            || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== file.blobSha
            || createHash('sha256').update(bytes).digest('hex') !== file.contentDigest) throw fail();
          await sourceCheck(path);
          const metadata = source.parse({ path, blobSha: file.blobSha, contentDigest: file.contentDigest });
          if (observed.has(path) && hash(observed.get(path)) !== hash(metadata)) throw fail(); observed.set(path, metadata);
          return file;
        };
        const brief = await read(target.path, head); if (brief.contentDigest !== target.contentDigest) throw fail();
        const context = freeze(contextSchema.parse({ ...scope, itemId, expectedHead: head, treeSha: inventory.treeSha, rootTreeSha: rootEntry.objectSha,
          requestDigest: hash(input), reviewDigest, brief: observed.get(target.path) }));
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
        if (lifecycle === 'candidate-not-pulled') {
          priorReader = createCandidateBundleReader({ binding, readHead: () => reader.readHead(), readArtifact: read }, {
            organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository, branch: scope.branch, itemIds,
          }, check);
          const prior = await bounded(() => priorReader!.readPointer({ organizationId: scope.organizationId, productId: scope.productId,
            repository: scope.repository, branch: scope.branch, itemId, revision: head, proposalId: null }));
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
        for (const path of observed.keys()) await sourceCheck(path);
        if (destination.expectedHead.parse(await bounded(() => reader.readHead())) !== head) throw fail();
        const final = await verify();
        if (hash(first.stable) !== hash(final.stable) || performance.now() >= Math.min(first.deadline, final.deadline)) throw fail();
        if (destination.expectedHead.parse(await bounded(() => reader.readHead())) !== head) throw fail(); await check();
        for (const path of observed.keys()) await sourceCheck(path);
        if (await bounded(current) !== undefined || performance.now() >= Math.min(first.deadline, final.deadline)) throw fail(); guard();
        return freeze(candidateSaveDestinationSchema.parse({ organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository,
          branch: scope.branch, itemId, expectedHead: head, purpose: amendment ? 'amendment' : 'candidate-revision', previousBundleDigest, amendment,
          relationship, lifecycle, authorityDigest: hash(['steer-existing-candidate-destination/v1', config, first.stable, [...observed.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)]) }));
      } catch { throw fail(); }
      finally { priorReader?.close(); finished = true; release(); }
    },
    close() { lifetime.abort(); },
  };
}
