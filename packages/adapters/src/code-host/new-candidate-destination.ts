import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateSavePreviewInputSchema, candidateSaveDestinationSchema,
  type CandidateSavePreviewInput, type CandidateSaveDestination } from '@steer/tool-registry/candidate-save-preview-contracts';
import { verifyCandidateSaveReview, type CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import { candidateProposalScopeSchema } from '@steer/tool-registry/candidate-proposal-contracts';
import { verifyScopeInventory } from './scope-inventory.ts';
import type { ArtifactSnapshot, CorpusRepositoryReader } from './github.ts';

const destination = candidateSaveDestinationSchema.shape;
export const newCandidateDestinationConfigurationSchema = candidateProposalScopeSchema.extend({ configurationRevision: z.string().min(1).max(200) });
const contextSchema = newCandidateDestinationConfigurationSchema.omit({ itemIds: true }).extend({
  itemId: destination.itemId, expectedHead: destination.expectedHead, treeSha: destination.expectedHead,
  requestDigest: destination.authorityDigest, reviewDigest: destination.authorityDigest,
  relationship: destination.relationship,
});
export const newCandidateDestinationAuthoritySchema = contextSchema.extend({
  kind: z.literal('steer-new-candidate-destination-authority/v1'), lifecycle: z.literal('absent-item'),
  permissionsRevision: z.string().min(1).max(200), evidenceDigest: destination.authorityDigest,
  evaluatedAt: z.iso.datetime(), validThrough: z.iso.datetime(),
});
type Context = z.infer<typeof contextSchema>;
export interface NewCandidateDestinationAuthority {
  /** Current subject, repository inventory access and target product assignment.
   * The fixed configuration and a matching digest do not establish this grant. */
  authorize(input: Readonly<CandidateSavePreviewInput>): Promise<void>;
  authorizeSource(reference: Readonly<{ organizationId: string; subject: string; productId: string; repository: string; branch: string; revision: string; path: string }>): Promise<void>;
  /** Must independently verify current lifecycle/admissibility, inventory scope,
   * current grants and any exact related target under governed evidence. No
   * browser assertions or constant test-like fallback may implement this port.
   * This is preview authority, NOT consent, write authorization or a gate. */
  verify(context: Readonly<Context>, input: Readonly<CandidateSavePreviewInput>, review: Readonly<CandidateSaveReviewOutput>): Promise<unknown>;
}
const sourceSchema = z.strictObject({ organizationId: z.string(), repositoryId: z.number().int().positive().safe(), revision: destination.expectedHead,
  path: z.string().min(1).max(500), content: z.string().min(1).max(131072).refine(v => !/[\uD800-\uDFFF]/u.test(v)),
  blobSha: destination.expectedHead, contentDigest: destination.authorityDigest });
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const fail = () => new Error('New candidate destination is unavailable or changed. No save authority was established.');

/** Uninstalled new-distinct/new-linked destination port for the real preview
 * composer. It verifies physical Git evidence AND requires independent current
 * lifecycle authority. Existing-item revisions/amendments fail closed here.
 * No item allocation, write API, operation, SQL, model or credential storage. */
export function createNewCandidateSaveDestination(reader: CorpusRepositoryReader, rawConfiguration: unknown, authority: NewCandidateDestinationAuthority) {
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
        || input.proposalId !== null || !['new-distinct', 'new-linked'].includes(input.choice.action)
        || (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => input[k] !== scope[k])) throw fail();
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
      try {
        await check(); const { reviewDigest, generation: _generation, itemId, proposalId: _proposal, ...reviewInput } = input;
        const review = await bounded(() => verifyCandidateSaveReview(reviewInput, rawReview));
        if (review.subject !== scope.subject || review.branch !== scope.branch || review.reviewDigest !== reviewDigest) throw fail();
        const head = destination.expectedHead.parse(await bounded(() => reader.readHead())); await check();
        if (head !== review.expectedHead) throw fail();
        const inventory = freeze(verifyScopeInventory(await bounded(() => reader.readScopeInventory(head)))); await check();
        if (inventory.organizationId !== scope.organizationId || inventory.repositoryId !== binding.repositoryId || inventory.revision !== head) throw fail();
        const root = `items/${itemId}`, entries = new Map(inventory.entries.map(e => [e.path, e]));
        if (inventory.entries.some(e => e.path === root || e.path.startsWith(`${root}/`))) throw fail();
        let relationship: CandidateSaveDestination['relationship'] = null;
        const observed: Array<{ path: string; blobSha: string; contentDigest: string }> = [];
        const sources: Array<Parameters<NewCandidateDestinationAuthority['authorizeSource']>[0]> = [];
        if (input.choice.action === 'new-linked') {
          const target = input.choice.target, targetId = /^items\/([0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*)\/BRIEF\.md$/.exec(target.path)?.[1];
          if (!targetId || targetId === itemId || !itemIds.includes(targetId) || target.revision !== head) throw fail();
          const entry = entries.get(target.path); if (entry?.type !== 'blob' || entry.mode !== '100644') throw fail();
          const reference = freeze({ organizationId: scope.organizationId, subject: scope.subject, productId: scope.productId,
            repository: scope.repository, branch: scope.branch, revision: head, path: target.path });
          if (await bounded(() => authority.authorizeSource(reference)) !== undefined) throw fail(); await check();
          const file: ArtifactSnapshot = sourceSchema.parse(await bounded(() => reader.readArtifact(target.path, head)));
          const bytes = Buffer.from(file.content, 'utf8');
          if (file.organizationId !== scope.organizationId || file.repositoryId !== binding.repositoryId || file.revision !== head || file.path !== target.path
            || bytes.length > 131072 || !file.content.trim() || file.blobSha !== entry.objectSha
            || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== file.blobSha
            || createHash('sha256').update(bytes).digest('hex') !== file.contentDigest || file.contentDigest !== target.contentDigest) throw fail();
          if (await bounded(() => authority.authorizeSource(reference)) !== undefined) throw fail(); await check();
          relationship = { itemId: targetId, revision: head }; sources.push(reference);
          observed.push({ path: file.path, blobSha: file.blobSha, contentDigest: file.contentDigest });
        }
        const context = freeze(contextSchema.parse({ ...scope, itemId, expectedHead: head, treeSha: inventory.treeSha, requestDigest: hash(input), reviewDigest, relationship }));
        const verify = async () => {
          await check(); const start = performance.now(), proof = newCandidateDestinationAuthoritySchema.parse(await bounded(() => authority.verify(context, input, review)));
          await check(); const now = Date.now(), evaluated = Date.parse(proof.evaluatedAt), expires = Date.parse(proof.validThrough);
          if ((Object.keys(context) as Array<keyof Context>).some(k => JSON.stringify(proof[k]) !== JSON.stringify(context[k]))
            || evaluated > now || expires <= now || expires <= evaluated || expires - evaluated > 300000) throw fail();
          const { evaluatedAt: _evaluated, validThrough: _expires, ...stable } = proof;
          return { stable, deadline: start + expires - now };
        };
        const first = await verify();
        for (const source of sources) { if (await bounded(() => authority.authorizeSource(source)) !== undefined) throw fail(); await check(); }
        if (destination.expectedHead.parse(await bounded(() => reader.readHead())) !== head) throw fail();
        const final = await verify();
        if (hash(first.stable) !== hash(final.stable) || performance.now() >= Math.min(first.deadline, final.deadline)) throw fail();
        // Recheck head after policy I/O as well: policy verification cannot hide
        // a moved branch behind a still-valid immutable source snapshot.
        if (destination.expectedHead.parse(await bounded(() => reader.readHead())) !== head) throw fail(); await check();
        for (const source of sources) if (await bounded(() => authority.authorizeSource(source)) !== undefined) throw fail();
        if (await bounded(current) !== undefined || performance.now() >= Math.min(first.deadline, final.deadline)) throw fail(); guard();
        return freeze(candidateSaveDestinationSchema.parse({ organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository,
          branch: scope.branch, itemId, expectedHead: head, purpose: 'new-candidate', previousBundleDigest: null, amendment: null,
          relationship, lifecycle: 'absent-item', authorityDigest: hash(['steer-new-candidate-destination/v1', config, first.stable, observed]) }));
      } catch { throw fail(); }
      finally { finished = true; release(); }
    },
    close() { lifetime.abort(); },
  };
}
