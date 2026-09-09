import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateSavePreviewInputSchema, candidateSaveDestinationSchema, reviewedItemBriefTarget,
  type CandidateSavePreviewInput, type CandidateSaveDestination } from '@steer/tool-registry/candidate-save-preview-contracts';
import { verifyCandidateSaveReview, type CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import { candidateProposalScopeSchema } from '@steer/tool-registry/candidate-proposal-contracts';
import { verifyScopeInventory } from './scope-inventory.ts';
import type { ArtifactSnapshot, CorpusRepositoryReader } from './github.ts';
import { createCandidateBundleReader } from './candidate-bundle-reader.ts';

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
   * current grants and any exact related target under governed evidence, including
   * whether a versioned target is the current pre-pull candidate. No
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
      let priorReader:ReturnType<typeof createCandidateBundleReader>|undefined;
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
          const target = input.choice.target, selectedTarget=reviewedItemBriefTarget(target.path), targetId=selectedTarget?.itemId;
          if (!targetId || targetId === itemId || !itemIds.includes(targetId) || target.revision !== head) throw fail();
          const read=async(path:string,revision:string):Promise<ArtifactSnapshot>=>{
            const entry=entries.get(path);
            if(revision!==head||!path.startsWith(`items/${targetId}/`)||entry?.type!=='blob'||entry.mode!=='100644')throw fail();
            const reference=freeze({organizationId:scope.organizationId,subject:scope.subject,productId:scope.productId,
              repository:scope.repository,branch:scope.branch,revision:head,path});
            if(await bounded(()=>authority.authorizeSource(reference))!==undefined)throw fail();await check();
            const file=sourceSchema.parse(await bounded(()=>reader.readArtifact(path,head))),bytes=Buffer.from(file.content,'utf8');
            if(file.organizationId!==scope.organizationId||file.repositoryId!==binding.repositoryId||file.revision!==head||file.path!==path
              ||bytes.length>131072||!file.content.trim()||file.blobSha!==entry.objectSha
              ||createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==file.blobSha
              ||createHash('sha256').update(bytes).digest('hex')!==file.contentDigest)throw fail();
            if(await bounded(()=>authority.authorizeSource(reference))!==undefined)throw fail();await check();
            sources.push(reference);observed.push({path:file.path,blobSha:file.blobSha,contentDigest:file.contentDigest});return file;
          };
          const file=await read(target.path,head);if(file.contentDigest!==target.contentDigest)throw fail();
          if(selectedTarget!.bundleId){
            priorReader=createCandidateBundleReader({binding,readHead:()=>reader.readHead(),readArtifact:read},
              {organizationId:scope.organizationId,productId:scope.productId,repository:scope.repository,branch:scope.branch,itemIds},check);
            const prior=await bounded(()=>priorReader!.readPointer({organizationId:scope.organizationId,productId:scope.productId,
              repository:scope.repository,branch:scope.branch,itemId:targetId,revision:head,proposalId:null}));
            if(prior.manifest.purpose==='amendment'||prior.sources.documents.brief?.path!==target.path)throw fail();
          }
          relationship = { itemId: targetId, revision: head };
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
      finally { priorReader?.close(); finished = true; release(); }
    },
    close() { lifetime.abort(); },
  };
}
