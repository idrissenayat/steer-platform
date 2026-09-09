import { z } from 'zod';
import { candidateProposalInputSchema, candidateProposalScopeSchema, candidateProposalOutputSchema,
  type CandidateProposalInput, type CandidateProposalReader } from '@steer/tool-registry/candidate-proposal-contracts';
import { candidateBundleReferenceSchema, candidatePointerReferenceSchema } from '@steer/tool-registry/candidate-bundle-contracts';
import { createCandidateBundleReader } from './candidate-bundle-reader.ts';
import type { DirectoryRepositoryReader } from './github.ts';

const oid = candidateBundleReferenceSchema.shape.revision;
const inventorySchema = z.strictObject({ organizationId: z.string(), repositoryId: z.number().int().positive(), revision: oid, treeSha: oid,
  root: z.string(), entries: z.array(z.strictObject({ path: z.string().max(500), objectSha: oid, type: z.string(), mode: z.string() })).max(1000) });
const fail = () => new Error('Existing proposals are unavailable at the reviewed commit. No absence or save authority was established.');
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

/** Explicit read-only, uninstalled composition. The authority port must cover
 * current subject and every item/pointer/manifest/document read, not just listing.
 * A complete Git inventory says nothing about proposal lifecycle or editability.
 * Neither document bytes nor keys are returned; no source/lifecycle fallback. */
export function createCandidateProposalReader(reader: DirectoryRepositoryReader, rawScope: unknown,
  authorize: (input: Readonly<CandidateProposalInput>, subject: string) => Promise<void>) {
  const scope = freeze(candidateProposalScopeSchema.parse(rawScope)), { subject, ...configuration } = scope;
  const bindingValid = () => reader.binding.organizationId === scope.organizationId && reader.binding.branch === scope.branch
    && `github:${reader.binding.repositoryId}` === scope.repository;
  if (!bindingValid() || typeof authorize !== 'function' || typeof reader.readDirectoryInventory !== 'function' || typeof reader.readArtifact !== 'function') throw fail();
  const lifetime = new AbortController(); let active = 0;
  return { scope,
    async list(raw, current) {
      const input = freeze(candidateProposalInputSchema.parse(raw));
      if (lifetime.signal.aborted || active >= 4 || typeof current !== 'function' || !scope.itemIds.includes(input.itemId)
        || (['organizationId', 'productId', 'repository', 'branch'] as const).some(k => input[k] !== scope[k])) throw fail();
      active++; let pending = 0, finished = false, released = false;
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(30000)]);
      const release = () => { if (finished && !pending && !released) { released = true; active--; } };
      const guard = () => { signal.throwIfAborted(); if (finished || !bindingValid()) throw fail(); };
      const bounded = async <T>(run: () => Promise<T>): Promise<T> => {
        guard(); pending++; let abort = () => {};
        const task = Promise.resolve().then(() => { guard(); return run(); });
        void task.finally(() => { pending--; release(); }).catch(() => {});
        try { return await Promise.race([task, new Promise<never>((_, reject) => {
          abort = () => reject(fail()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
        })]); } finally { signal.removeEventListener('abort', abort); }
      };
      const check = async () => {
        if (await bounded(current) !== undefined || await bounded(() => authorize(input, subject)) !== undefined || await bounded(current) !== undefined) throw fail(); guard();
      };
      let bundles: ReturnType<typeof createCandidateBundleReader> | undefined;
      try {
        bundles = createCandidateBundleReader({ ...reader, readArtifact: async (path, revision) => {
          await check(); const value = await bounded(() => reader.readArtifact(path, revision)); await check(); return value;
        } }, configuration, async () => check());
        await check(); const root = `items/${input.itemId}`;
        const inventory = inventorySchema.parse(await bounded(() => reader.readDirectoryInventory(root, input.revision))); await check();
        if (inventory.organizationId !== input.organizationId || inventory.repositoryId !== reader.binding.repositoryId
          || inventory.revision !== input.revision || inventory.root !== root) throw fail();
        const paths = new Map(inventory.entries.map(entry => [entry.path, entry]));
        if (paths.size !== inventory.entries.length) throw fail();
        for (const entry of inventory.entries) {
          if ((entry.path !== root && !entry.path.startsWith(`${root}/`)) || /[\\\u0000-\u001f\u007f]/u.test(entry.path)
            || entry.path.split('/').some(p => !p || p === '.' || p === '..')
            || !((entry.type === 'tree' && entry.mode === '040000') || (entry.type === 'commit' && entry.mode === '160000')
              || (entry.type === 'blob' && ['100644', '100755', '120000'].includes(entry.mode)))) throw fail();
          for (let n = 2; n < entry.path.split('/').length; n++) {
            const parent = paths.get(entry.path.split('/').slice(0, n).join('/'));
            if (parent?.type !== 'tree' || parent.mode !== '040000') throw fail();
          }
        }
        if (paths.has(root) && (paths.get(root)!.type !== 'tree' || paths.get(root)!.mode !== '040000')) throw fail();
        const prefix = `${root}/proposals/`, ids: string[] = [];
        const proposalRoot = paths.get(`${root}/proposals`);
        if (proposalRoot && (proposalRoot.type !== 'tree' || proposalRoot.mode !== '040000')) throw fail();
        for (const entry of inventory.entries.filter(entry => entry.path.startsWith(prefix))) {
          const id = candidatePointerReferenceSchema.shape.proposalId.unwrap().parse(entry.path.slice(prefix.length).replace(/\.json$/, ''));
          if (entry.path !== `${prefix}${id}.json` || entry.type !== 'blob' || entry.mode !== '100644') throw fail();
          ids.push(id);
        }
        ids.sort(); if (input.cursor && !ids.includes(input.cursor)) throw fail();
        const remaining = ids.filter(id => !input.cursor || id > input.cursor), selected = remaining.slice(0, 10), entries = [];
        for (const proposalId of selected) {
          const { cursor: _cursor, ...reference } = input;
          const value = await bounded(() => bundles!.readPointer({ ...reference, proposalId })); await check();
          const files = [value.pointer, value.sources.manifest, ...Object.values(value.sources.documents)];
          if (files.some(file => { const item = paths.get(file.path); return item?.mode !== '100644' || item.type !== 'blob' || item.objectSha !== file.blobSha; })
            || !value.pointer.value.proposalTarget || value.manifest.purpose !== 'amendment') throw fail();
          entries.push({ proposalId, reference: value.reference, pointerDigest: value.pointer.contentDigest, target: value.pointer.value.proposalTarget });
        }
        await check();
        return freeze(candidateProposalOutputSchema.parse({ ...input, kind: 'steer-candidate-proposals/v1', treeSha: inventory.treeSha,
          entries, nextCursor: remaining.length > 10 ? selected.at(-1)! : null, inventoryCount: ids.length, inventoryComplete: true,
          lifecycleVerified: false, executionAuthorized: false, savedToGit: false, gateSigned: false }));
      } catch { throw fail(); }
      finally { finished = true; bundles?.close(); release(); }
    },
    close() { lifetime.abort(); },
  } satisfies CandidateProposalReader & { close(): void };
}
