import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateBundleReferenceSchema, candidatePointerReferenceSchema,
  candidateBundleManifestSchema, candidateBundlePointerSchema, type CandidateBundleReference,
} from '@steer/tool-registry/candidate-bundle-contracts';
import { intentDocumentDraftsSchema } from '@steer/tool-registry/intent-revision-contracts';
import type { ArtifactReader } from './github.ts';
import { repositoryReadCovers } from './repository-read-authority.ts';

const configuration = candidateBundleReferenceSchema.pick({ organizationId: true, productId: true, repository: true, branch: true }).extend({
  itemIds: z.array(candidateBundleReferenceSchema.shape.itemId).min(1).max(100).refine(values => new Set(values).size === values.length),
});
const artifact = z.strictObject({
  organizationId: configuration.shape.organizationId, repositoryId: z.number().int().positive().safe(),
  revision: candidateBundleReferenceSchema.shape.revision, path: z.string().max(500),
  content: z.string().max(131072).refine(value => !/[\uD800-\uDFFF]/u.test(value)),
  contentDigest: candidateBundleReferenceSchema.shape.manifestDigest, blobSha: candidateBundleReferenceSchema.shape.revision,
});
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
export class CandidateBundleReadError extends Error {
  constructor() { super('The candidate bundle could not be verified at the requested revision.'); }
}

/**
 * Disabled/uninstalled composition primitive. The supplied ArtifactReader must
 * resolve regular Git blobs at the requested commit (including mode/tree checks).
 * Trusted authorize() must check current identity AND exact scope/read grants;
 * neither configuration nor a request-supplied callback is authorization.
 * No latest-head fallback, writes, cache, draft persistence or gate assertions.
 */
export function createCandidateBundleReader(reader: ArtifactReader, rawConfiguration: unknown,
  authorize: (reference: Readonly<z.infer<typeof candidatePointerReferenceSchema> | CandidateBundleReference>) => Promise<void>) {
  const config = configuration.safeParse(rawConfiguration);
  if (!config.success || typeof authorize !== 'function' || typeof reader.readArtifact !== 'function'
    || reader.binding.organizationId !== config.data.organizationId || reader.binding.branch !== config.data.branch
    || `github:${reader.binding.repositoryId}` !== config.data.repository) throw new CandidateBundleReadError();
  const settings = freeze(config.data), repositoryId = reader.binding.repositoryId;
  const lifetime = new AbortController();
  let activeOperations = 0;
  function scope(ref: z.infer<typeof candidatePointerReferenceSchema> | CandidateBundleReference) {
    if (ref.organizationId !== settings.organizationId || ref.productId !== settings.productId
      || ref.repository !== settings.repository || ref.branch !== settings.branch || !settings.itemIds.includes(ref.itemId)) throw new CandidateBundleReadError();
  }
  function operation(ref: z.infer<typeof candidatePointerReferenceSchema> | CandidateBundleReference, current?: () => Promise<void>) {
    scope(ref); freeze(ref);
    if (lifetime.signal.aborted || activeOperations >= 4) throw new CandidateBundleReadError();
    activeOperations++;
    let pending = 0, finished = false, released = false;
    const release = () => { if (finished && pending === 0 && !released) { released = true; activeOperations--; } };
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]);
    async function bounded<T>(work: () => Promise<T>): Promise<T> {
      signal.throwIfAborted();
      let listener: () => void = () => {};
      pending++;
      const task = Promise.resolve().then(() => { signal.throwIfAborted(); return work(); });
      // A timed-out dependency retains its admission slot until it actually ends.
      void task.finally(() => { pending--; release(); }).catch(() => {});
      try {
        return await Promise.race([task, new Promise<never>((_, reject) => {
          listener = () => reject(new CandidateBundleReadError()); signal.addEventListener('abort', listener, { once: true });
          if (signal.aborted) listener();
        })]);
      } finally { signal.removeEventListener('abort', listener); }
    }
    const check = async () => {
      if (current && await bounded(current) !== undefined) throw new CandidateBundleReadError();
      if (await bounded(() => authorize(ref)) !== undefined) throw new CandidateBundleReadError();
      if (current && await bounded(current) !== undefined) throw new CandidateBundleReadError();
      signal.throwIfAborted();
    };
    const read = async (path: string, expectedDigest?: string) => {
      // A privately constructed catalog read already invokes this exact bound
      // authorizer. An independent current caller always keeps the full path.
      const method = reader.readArtifact, covered = !current && repositoryReadCovers(method, authorize);
      if (!covered) await check();
      const result = artifact.parse(await bounded(() => Reflect.apply(method, reader, [path, ref.revision])));
      signal.throwIfAborted();
      if (!covered) await check();
      const bytes = Buffer.from(result.content, 'utf8');
      const blobSha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (result.organizationId !== ref.organizationId || result.repositoryId !== repositoryId
        || result.revision !== ref.revision || result.path !== path || bytes.length > 131072
        || hash(bytes) !== result.contentDigest || blobSha !== result.blobSha
        || (expectedDigest !== undefined && result.contentDigest !== expectedDigest)) throw new CandidateBundleReadError();
      return result;
    };
    const bundle = async (selected: CandidateBundleReference) => {
      const root = `items/${selected.itemId}`;
      const manifestFile = await read(`${root}/candidates/${selected.bundleId}/MANIFEST.json`, selected.manifestDigest);
      if (Buffer.byteLength(manifestFile.content) > 32000) throw new CandidateBundleReadError();
      const manifest = candidateBundleManifestSchema.parse(JSON.parse(manifestFile.content));
      for (const key of ['organizationId', 'productId', 'repository', 'itemId', 'bundleId'] as const) {
        if (manifest[key] !== selected[key]) throw new CandidateBundleReadError();
      }
      const documents = { brief: '', spec: '', exam: '' };
      const documentSources: Record<string, { path: string; contentDigest: string; blobSha: string }> = {};
      for (const name of ['brief', 'spec', 'exam'] as const) {
        const source = manifest.documents[name];
        const file = await read(`${root}/${source.path}`, source.contentDigest);
        documents[name] = file.content;
        documentSources[name] = { path: file.path, contentDigest: file.contentDigest, blobSha: file.blobSha };
      }
      intentDocumentDraftsSchema.parse(documents);
      if (Object.values(documents).some(content => !content.trim())) throw new CandidateBundleReadError();
      await check();
      return freeze({ kind: 'steer-candidate-bundle-content/v1' as const,
        reference: { ...selected }, manifest, manifestContent: manifestFile.content, documents, verification: 'exact-commit-bytes' as const,
        sources: { manifest: { path: manifestFile.path, contentDigest: manifestFile.contentDigest, blobSha: manifestFile.blobSha }, documents: documentSources },
        executionAuthorized: false as const });
    };
    return { read, bundle, check, finish: () => { finished = true; release(); } };
  }
  return {
    reopen: async (raw: unknown, current?: () => Promise<void>) => {
      try {
        const ref = candidateBundleReferenceSchema.parse(raw), io = operation(ref, current);
        try { return await io.bundle(ref); } finally { io.finish(); }
      }
      catch { throw new CandidateBundleReadError(); }
    },
    readPointer: async (raw: unknown) => {
      try {
        const ref = candidatePointerReferenceSchema.parse(raw), io = operation(ref);
        try {
          const path = ref.proposalId ? `items/${ref.itemId}/proposals/${ref.proposalId}.json` : `items/${ref.itemId}/CANDIDATE.json`;
          const file = await io.read(path);
          if (Buffer.byteLength(file.content) > 8000) throw new CandidateBundleReadError();
          const pointer = candidateBundlePointerSchema.parse(JSON.parse(file.content));
          if (pointer.itemId !== ref.itemId || Boolean(pointer.proposalTarget) !== Boolean(ref.proposalId)) throw new CandidateBundleReadError();
          const { proposalId: _proposalId, ...home } = ref;
          const bundle = await io.bundle({ ...home, bundleId: pointer.bundleId, manifestDigest: pointer.manifestDigest });
          if (JSON.stringify(pointer.proposalTarget) !== JSON.stringify(bundle.manifest.target)
            || (ref.proposalId !== null && Boolean(pointer.parentProposalDigest) !== Boolean(bundle.manifest.previousBundleDigest))) throw new CandidateBundleReadError();
          // A candidate pointer cannot hide an out-of-band change to its root Brief.
          if (ref.proposalId === null) await io.read(`items/${ref.itemId}/BRIEF.md`, bundle.manifest.documents.brief.contentDigest);
          await io.check();
          return freeze({ ...bundle, pointer: { path, contentDigest: file.contentDigest, blobSha: file.blobSha, value: pointer } });
        } finally { io.finish(); }
      } catch { throw new CandidateBundleReadError(); }
    },
    close: () => lifetime.abort(),
  };
}
