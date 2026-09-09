import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateBundleReferenceSchema, candidatePointerReferenceSchema } from '@steer/tool-registry/candidate-bundle-contracts';
import { createCandidateBundleReader } from './candidate-bundle-reader.ts';
import type { DirectoryRepositoryReader, ArtifactSnapshot } from './github.ts';
import { bracketRepositoryRead, repositoryReadCovers } from './repository-read-authority.ts';

const referenceSchema = candidateBundleReferenceSchema.omit({ itemId: true, bundleId: true, manifestDigest: true });
const configurationSchema = referenceSchema.omit({ revision: true }).extend({
  itemIds: z.array(candidateBundleReferenceSchema.shape.itemId).min(1).max(100).refine(values => new Set(values).size === values.length),
});
const digest = candidateBundleReferenceSchema.shape.manifestDigest, oid = candidateBundleReferenceSchema.shape.revision;
const pathSchema = z.string().min(1).max(500).refine(value => !/[\\\u0000-\u001f\u007f]/u.test(value)
  && value.split('/').every(part => part !== '' && part !== '.' && part !== '..'));
const directorySchema = z.strictObject({
  organizationId: referenceSchema.shape.organizationId, repositoryId: z.number().int().positive().safe(),
  revision: oid, treeSha: oid, root: z.string().max(500),
  entries: z.array(z.strictObject({ path: pathSchema, objectSha: oid, mode: z.string(), type: z.string() })).max(1000),
});
const sourceSchema = z.strictObject({
  organizationId: referenceSchema.shape.organizationId, repositoryId: z.number().int().positive().safe(),
  revision: oid, path: z.string().max(500), contentDigest: digest, blobSha: oid,
  content: z.string().max(131072).refine(value => !/[\uD800-\uDFFF]/u.test(value)),
});
type Reference = z.infer<typeof referenceSchema>;
type Kind = 'root-scope' | 'candidate' | 'amendment';
type Gap = { itemId: string; path: string; reason: 'inventory-unavailable' | 'source-unavailable' | 'missing-root-brief'
  | 'missing-root-spec' | 'pointer-unverified' | 'malformed-proposal-path' | 'read-limit' };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const blobHash = (value: string) => createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
export class CandidateCatalogError extends Error {
  constructor() { super('The configured candidate scope catalog could not be verified.'); }
}

/**
 * Uninstalled read-only source collector. authorize() must cover current identity
 * and ALL configured item/read grants. A Git layout is not lifecycle authority:
 * roots and proposals remain separate and no current/canonical choice is inferred.
 * The consumer still needs verified lifecycle selection and full-corpus assembly.
 */
export function createCandidateScopeCatalog(reader: DirectoryRepositoryReader, rawConfiguration: unknown,
  authorize: (reference: Readonly<Reference>) => Promise<void>) {
  const parsed = configurationSchema.safeParse(rawConfiguration);
  if (!parsed.success || typeof reader.readDirectoryInventory !== 'function' || typeof authorize !== 'function'
    || reader.binding.organizationId !== parsed.data.organizationId || reader.binding.branch !== parsed.data.branch
    || `github:${reader.binding.repositoryId}` !== parsed.data.repository) throw new CandidateCatalogError();
  const config = freeze(parsed.data), lifetime = new AbortController(); let busy = false;
  async function collect(raw: unknown) {
    let finish: (() => void) | undefined;
    let bundles: ReturnType<typeof createCandidateBundleReader> | undefined;
    try {
      const ref = freeze(referenceSchema.parse(raw));
      if (lifetime.signal.aborted || busy || ref.organizationId !== config.organizationId || ref.productId !== config.productId
        || ref.repository !== config.repository || ref.branch !== config.branch) throw new CandidateCatalogError();
      busy = true; let pending = 0, finished = false, readCount = 0, readLimitReached = false;
      const release = () => { if (finished && pending === 0) busy = false; };
      finish = () => { finished = true; release(); };
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(30000)]);
      async function bounded<T>(work: () => Promise<T>): Promise<T> {
        signal.throwIfAborted(); pending++;
        const task = Promise.resolve().then(() => { signal.throwIfAborted(); return work(); });
        void task.finally(() => { pending--; release(); }).catch(() => {});
        let listener: () => void = () => {};
        try { return await Promise.race([task, new Promise<never>((_, reject) => {
          listener = () => reject(new CandidateCatalogError()); signal.addEventListener('abort', listener, { once: true });
          if (signal.aborted) listener();
        })]); } finally { signal.removeEventListener('abort', listener); }
      }
      const check = async () => {
        if (await bounded(() => authorize(ref)) !== undefined) throw new CandidateCatalogError();
        signal.throwIfAborted();
      };
      const read = async <T>(work: () => Promise<T>, covered = false) => {
        if (readCount >= 100) { readLimitReached = true; throw new CandidateCatalogError(); }
        readCount++; if (!covered) await check(); const result = await bounded(work);
        signal.throwIfAborted(); if (!covered) await check(); return result;
      };
      const readArtifact = (path: string, revision: string) => {
        const method = reader.readArtifact;
        return read(() => Reflect.apply(method, reader, [path, revision]), repositoryReadCovers(method, authorize));
      };
      // Keep the bundle-facing read genuinely bracketed by check, even when its
      // underlying corpus read covers authorize. Do not transfer a proof across
      // a callback that was skipped. Catalog bounds/admission remain independent.
      const port = { ...reader, readArtifact: bracketRepositoryRead(check, async (path: string, revision: string) => {
        if (readCount >= 100) { readLimitReached = true; throw new CandidateCatalogError(); }
        readCount++; const method = reader.readArtifact;
        return bounded(() => Reflect.apply(method, reader, [path, revision]));
      }, () => signal.throwIfAborted()) };
      bundles = createCandidateBundleReader(port, config, check);
      const documents = new Map<string, ArtifactSnapshot>();
      const groups: Array<{ itemId: string; kind: Kind; pointerPath: string | null; manifestDigest: string | null; documentPaths: string[] }> = [];
      const gaps: Gap[] = []; const inventories: Array<{ itemId: string; treeSha: string; entries: unknown[] }> = [];
      const validateSource = (snapshot: unknown, expectedPath: string, expectedBlob?: string) => {
        const source = sourceSchema.parse(snapshot);
        if (source.organizationId !== ref.organizationId || source.repositoryId !== reader.binding.repositoryId
          || source.revision !== ref.revision || source.path !== expectedPath || Buffer.byteLength(source.content) > 131072
          || source.contentDigest !== hash(source.content) || source.blobSha !== blobHash(source.content)
          || (expectedBlob !== undefined && source.blobSha !== expectedBlob) || !source.content.trim()) throw new CandidateCatalogError();
        const previous = documents.get(source.path);
        if (previous && previous.contentDigest !== source.contentDigest) throw new CandidateCatalogError();
        return source;
      };
      for (const itemId of config.itemIds) {
        const root = `items/${itemId}`;
        if (readCount >= 100) { readLimitReached = true; gaps.push({ itemId, path: root, reason: 'read-limit' }); continue; }
        let directory: z.infer<typeof directorySchema>;
        try {
          const method = reader.readDirectoryInventory;
          directory = directorySchema.parse(await read(() => Reflect.apply(method, reader, [root, ref.revision]), repositoryReadCovers(method, authorize)));
          if (directory.organizationId !== ref.organizationId || directory.repositoryId !== reader.binding.repositoryId
            || directory.revision !== ref.revision || directory.root !== root
            || new Set(directory.entries.map(entry => entry.path)).size !== directory.entries.length
            || directory.entries.some(entry => !(entry.path === root || entry.path.startsWith(`${root}/`))
              || !((entry.type === 'tree' && entry.mode === '040000') || (entry.type === 'commit' && entry.mode === '160000')
                || (entry.type === 'blob' && ['100644', '100755', '120000'].includes(entry.mode))))) throw new CandidateCatalogError();
          const listed = new Map(directory.entries.map(entry => [entry.path, entry]));
          for (const entry of directory.entries) {
            if (entry.path === root && (entry.type !== 'tree' || entry.mode !== '040000')) throw new CandidateCatalogError();
            const parts = entry.path.split('/');
            for (let index = 2; index < parts.length; index++) {
              const parent = listed.get(parts.slice(0, index).join('/'));
              if (!parent || parent.type !== 'tree' || parent.mode !== '040000') throw new CandidateCatalogError();
            }
          }
          if (inventories.some(inventory => inventory.treeSha !== directory.treeSha)) throw new CandidateCatalogError();
          inventories.push({ itemId, treeSha: directory.treeSha, entries: directory.entries });
        } catch { gaps.push({ itemId, path: root, reason: 'inventory-unavailable' }); continue; }
        const byPath = new Map(directory.entries.map(entry => [entry.path, entry]));
        const candidate = byPath.get(`${root}/CANDIDATE.json`);
        const rootPaths: string[] = [];
        for (const name of ['BRIEF', 'SPEC'] as const) {
          const path = `${root}/${name}.md`, entry = byPath.get(path);
          if (!entry) {
            if (name === 'BRIEF' || !candidate) gaps.push({ itemId, path, reason: name === 'BRIEF' ? 'missing-root-brief' : 'missing-root-spec' });
            continue;
          }
          try {
            if (entry.mode !== '100644' || entry.type !== 'blob') throw new CandidateCatalogError();
            const source = validateSource(await readArtifact(path, ref.revision), path, entry.objectSha);
            documents.set(path, source); rootPaths.push(path);
          } catch { gaps.push({ itemId, path, reason: 'source-unavailable' }); }
        }
        if (rootPaths.length) groups.push({ itemId, kind: 'root-scope', pointerPath: null, manifestDigest: null, documentPaths: rootPaths });
        const pointers: Array<{ path: string; proposalId: string | null }> = [];
        if (candidate) pointers.push({ path: candidate.path, proposalId: null });
        for (const entry of directory.entries) {
          if (!entry.path.startsWith(`${root}/proposals/`) || entry.type === 'tree') continue;
          const proposalId = entry.path.slice(`${root}/proposals/`.length).replace(/\.json$/, '');
          const selection = candidatePointerReferenceSchema.safeParse({ ...ref, itemId, proposalId });
          if (!selection.success || entry.path !== `${root}/proposals/${selection.data.proposalId}.json`) {
            gaps.push({ itemId, path: entry.path, reason: 'malformed-proposal-path' }); continue;
          }
          pointers.push({ path: entry.path, proposalId });
        }
        for (const pointer of pointers) {
          try {
            const entry = byPath.get(pointer.path)!;
            if (entry.type !== 'blob' || entry.mode !== '100644') throw new CandidateCatalogError();
            const bundle = await bundles.readPointer({ ...ref, itemId, proposalId: pointer.proposalId });
            // Pin all consumed blobs to the enumerated same-commit tree.
            const consumed = [bundle.pointer, bundle.sources.manifest, ...Object.values(bundle.sources.documents)];
            if (consumed.some(file => {
              const listed = byPath.get(file.path);
              return !listed || listed.type !== 'blob' || listed.mode !== '100644' || listed.objectSha !== file.blobSha;
            })) throw new CandidateCatalogError();
            const paths: string[] = [], staged: ArtifactSnapshot[] = [];
            for (const name of ['brief', 'spec'] as const) {
              const path = `${root}/${bundle.manifest.documents[name].path}`, content = bundle.documents[name];
              staged.push(validateSource({ organizationId: ref.organizationId, repositoryId: reader.binding.repositoryId, revision: ref.revision,
                path, content, contentDigest: bundle.manifest.documents[name].contentDigest, blobSha: blobHash(content) }, path));
              paths.push(path);
            }
            for (const source of staged) documents.set(source.path, source);
            groups.push({ itemId, kind: pointer.proposalId ? 'amendment' : 'candidate', pointerPath: pointer.path,
              manifestDigest: bundle.reference.manifestDigest, documentPaths: paths });
          } catch { gaps.push({ itemId, path: pointer.path, reason: readCount >= 100 ? 'read-limit' : 'pointer-unverified' }); }
        }
      }
      await check();
      const sorted = [...documents.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
      const inventoryDigest = hash(JSON.stringify(['steer-candidate-scope-inventory/v1', ref, inventories, groups, gaps]));
      return freeze({ kind: 'steer-candidate-scope-catalog/v1' as const, reference: ref, inventoryDigest, groups, documents: sorted,
        coverage: { scope: 'configured-items-only' as const, configuredItemCount: config.itemIds.length,
          enumeratedItemCount: inventories.length, inventoryComplete: inventories.length === config.itemIds.length,
          sourceCoverageComplete: gaps.length === 0, gaps, readLimitReached,
          lifecycleSelectionComplete: false as const },
        authoritativeClearance: false as const });
    } catch { throw new CandidateCatalogError(); }
    finally { bundles?.close(); finish?.(); }
  }
  return { collect, close: () => lifetime.abort() };
}
