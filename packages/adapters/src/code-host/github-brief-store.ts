import { createHash } from 'node:crypto';
import { z } from 'zod';
import { briefSaveReferenceSchema, briefSaveScopeSchema, briefWriteAuthoritySchema,
  type BriefCreateRequest, type BriefSaveReference, type BriefSaveObservation } from '@steer/tool-registry';
import { CodeHostError, type GitHubBinding } from './github.ts';

const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/);
const digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const configurationSchema = briefSaveScopeSchema.omit({ path: true }).extend({
  paths: z.array(briefSaveScopeSchema.shape.path).min(1).max(100).refine((v) => new Set(v).size === v.length),
  platformRevision: sha, gate2DecisionDigest: digest,
});
const bindingSchema = z.strictObject({ organizationId: briefSaveScopeSchema.shape.organizationId,
  installationId: z.number().int().positive().safe(), repositoryId: z.number().int().positive().safe(),
  owner: z.string().min(1).max(100).regex(/^[A-Za-z0-9-]+(?![\s\S])/),
  repository: z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+(?![\s\S])/).refine((v) => v !== '.' && v !== '..'),
  branch: briefSaveScopeSchema.shape.branch,
});
const requestSchema = briefSaveReferenceSchema.extend({ requestDigest: digest, expectedHead: sha,
  content: z.string().min(1).max(32768), contentDigest: digest, contentBlobSha: sha,
  expectedBlob: z.null(), operationPath: z.string().max(100),
});
export { configurationSchema as githubBriefConfigurationSchema, requestSchema as githubBriefRequestSchema };
const markerSchema = briefSaveReferenceSchema.extend({ version: z.literal('steer-brief-operation/v1'),
  requestDigest: digest, expectedHead: sha, contentDigest: digest, blobSha: sha,
});
const commitSchema = z.object({ sha, tree: z.object({ sha }), parents: z.array(z.object({ sha })).max(2) });
const historyCommitSchema = z.object({ sha, parents: z.array(z.object({ sha })).max(2) });
const gitPath = z.string().min(1).max(1000).refine((v) => !/[\\\u0000-\u001f\u007f]/u.test(v) &&
  v.split('/').every((p) => p !== '' && p !== '.' && p !== '..'));
const treeSchema = z.object({ sha, truncated: z.literal(false), tree: z.array(z.object({
  path: gitPath, mode: z.string(), type: z.string(), sha,
})).max(10000) });
type Tree = z.infer<typeof treeSchema>;
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const blobHash = (bytes: Uint8Array) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const operationPath = (ref: BriefSaveReference) => `.steer/authoring/operations/${ref.idempotencyKey}.json`;
const sameReference = (a: BriefSaveReference, b: BriefSaveReference) =>
  (Object.keys(briefSaveReferenceSchema.shape) as (keyof BriefSaveReference)[]).every((k) => a[k] === b[k]);

// This is a code-host primitive, deliberately NOT a complete BriefWriter. Trusted
// composition must authenticate status readers and verify the full source evidence
// in verifyAuthority. A normalized policy result or request-supplied callback is not
// authority. No production bootstrap imports or installs this adapter.
export interface GitHubBriefStore {
  inspect(reference: BriefSaveReference): Promise<BriefSaveObservation>;
  compareAndCreate(request: BriefCreateRequest): Promise<BriefSaveObservation>;
}
export function createGitHubBriefStore(rawBinding: GitHubBinding,
  rawConfiguration: z.infer<typeof configurationSchema>, dependencies: {
    fetch: typeof globalThis.fetch; appJwt: () => Promise<string>;
    verifyAuthority: (request: BriefCreateRequest) => Promise<unknown>;
    now?: () => Date;
  }): GitHubBriefStore {
  const binding = bindingSchema.parse(rawBinding), config = configurationSchema.parse(rawConfiguration);
  if (binding.organizationId !== config.organizationId || config.repository !== `github:${binding.repositoryId}` ||
      binding.branch !== config.branch || typeof dependencies.fetch !== 'function' ||
      typeof dependencies.appJwt !== 'function' || typeof dependencies.verifyAuthority !== 'function') throw new CodeHostError();
  const clock = dependencies.now ?? (() => new Date());
  const repo = `/repos/${binding.owner}/${binding.repository}`;
  const scope = (raw: BriefSaveReference) => {
    const ref = briefSaveReferenceSchema.parse(raw);
    if (ref.organizationId !== config.organizationId || ref.repository !== config.repository || ref.branch !== config.branch ||
        !config.paths.includes(ref.path)) throw new CodeHostError();
    return ref;
  };
  const io = () => {
    const total = AbortSignal.timeout(60000);
    let count = 0;
    // A hung injected transport/signer/body must not outlive the operation budget.
    const bounded = async <T>(work: Promise<T>, signal: AbortSignal): Promise<T> => {
      signal.throwIfAborted();
      let listener: () => void = () => {};
      try { return await Promise.race([work, new Promise<never>((_, reject) => {
        listener = () => reject(new CodeHostError()); signal.addEventListener('abort', listener, { once: true });
      })]); } finally { signal.removeEventListener('abort', listener); }
    };
    const request = async (path: string, token: string, body?: unknown): Promise<unknown> => {
      if (++count > 40) throw new CodeHostError();
      const signal = AbortSignal.any([total, AbortSignal.timeout(10000)]);
      signal.throwIfAborted();
      const response = await bounded(dependencies.fetch(`https://api.github.com${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store', signal,
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10', 'content-type': 'application/json', 'cache-control': 'no-cache' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }), signal);
      if (!response.ok || response.status >= 300 || !response.body) throw new CodeHostError();
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (let parts = 0; ; parts++) {
          if (parts >= 4096) throw new CodeHostError();
          const part = await bounded(reader.read(), signal);
          if (part.done) break;
          size += part.value.length; if (size > 2 * 1024 * 1024) throw new CodeHostError();
          chunks.push(part.value);
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
    };
    const token = async (level: 'read' | 'write') => {
      const now = clock().getTime(); if (!Number.isFinite(now)) throw new CodeHostError();
      const jwt = await bounded(dependencies.appJwt(), total);
      const result = z.object({ token: z.string().min(1).max(2000), expires_at: z.iso.datetime(),
        repositories: z.array(z.object({ id: z.number(), full_name: z.string() })).length(1),
        permissions: z.record(z.string(), z.string()),
      }).parse(await request(`/app/installations/${binding.installationId}/access_tokens`, jwt,
        { repository_ids: [binding.repositoryId], permissions: { contents: level } }));
      const expiry = Date.parse(result.expires_at);
      if (expiry <= now + 60000 || expiry > now + 3660000 || result.repositories[0]?.id !== binding.repositoryId ||
          result.repositories[0].full_name.toLowerCase() !== `${binding.owner}/${binding.repository}`.toLowerCase() ||
          result.permissions.contents !== level || Object.entries(result.permissions).some(([key, value]) =>
            !((key === 'contents' && value === level) || (key === 'metadata' && value === 'read')))) throw new CodeHostError();
      return result.token;
    };
    const head = async (credential: string) => {
      const result = z.object({ ref: z.literal(`refs/heads/${binding.branch}`), object: z.object({ type: z.literal('commit'), sha }) })
        .parse(await request(`${repo}/git/ref/heads/${binding.branch.split('/').map(encodeURIComponent).join('/')}`, credential));
      return result.object.sha;
    };
    const treeAt = async (revision: string, credential: string) => {
      const commit = commitSchema.parse(await request(`${repo}/git/commits/${revision}`, credential));
      if (commit.sha !== revision) throw new CodeHostError();
      const tree = treeSchema.parse(await request(`${repo}/git/trees/${commit.tree.sha}?recursive=1`, credential));
      if (tree.sha !== commit.tree.sha || new Set(tree.tree.map((e) => e.path)).size !== tree.tree.length ||
          tree.tree.some((e) => !((e.type === 'tree' && e.mode === '040000') || (e.type === 'commit' && e.mode === '160000') ||
            (e.type === 'blob' && ['100644', '100755', '120000'].includes(e.mode))))) throw new CodeHostError();
      return { commit, tree };
    };
    const absent = (tree: Tree, path: string) => {
      // Existing file/dir, descendants or non-directory ancestors prevent creation.
      return !tree.tree.some((e) => e.path === path || e.path.startsWith(`${path}/`) ||
        (path.startsWith(`${e.path}/`) && e.type !== 'tree'));
    };
    const read = async (tree: Tree, path: string, credential: string) => {
      const entry = tree.tree.find((e) => e.path === path);
      if (!entry || entry.mode !== '100644' || entry.type !== 'blob') throw new CodeHostError();
      const blob = z.object({ sha, encoding: z.literal('base64'), size: z.number().int().min(0).max(65536),
        content: z.string().max(131072) }).parse(await request(`${repo}/git/blobs/${entry.sha}`, credential));
      const encoded = blob.content.replace(/\n/g, ''), bytes = Buffer.from(encoded, 'base64');
      if (bytes.length !== blob.size || bytes.toString('base64') !== encoded || blob.sha !== entry.sha || blobHash(bytes) !== entry.sha) throw new CodeHostError();
      return { content: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), sha: entry.sha, digest: hash(bytes) };
    };
    const history = async (revision: string, path: string, credential: string) => z.array(historyCommitSchema).max(2)
      .parse(await request(`${repo}/commits?sha=${revision}&path=${encodeURIComponent(path)}&per_page=2`, credential));
    const inspect = async (ref: BriefSaveReference, credential: string): Promise<BriefSaveObservation> => {
      const revision = await head(credential), current = await treeAt(revision, credential), path = operationPath(ref);
      const changes = await history(revision, path, credential);
      if (absent(current.tree, path)) {
        if (changes.length || await head(credential) !== revision) throw new CodeHostError();
        return { ...ref, outcome: 'not-found' };
      }
      const blob = await read(current.tree, path, credential);
      const marker = markerSchema.parse(JSON.parse(blob.content));
      if (!sameReference(marker, ref)) return { ...ref, outcome: 'conflict' };
      if (changes.length !== 1 || changes[0]?.parents.length !== 1 || changes[0].parents[0]?.sha !== marker.expectedHead) throw new CodeHostError();
      const created = changes[0].sha;
      // Bound the first profile to <=100 linear commits; no incomplete pagination,
      // merge ancestry, rewritten base or path-history ambiguity becomes success.
      const comparison = z.object({ status: z.literal('ahead'), ahead_by: z.number().int().min(1).max(100),
        behind_by: z.literal(0), total_commits: z.number().int().min(1).max(100),
        base_commit: z.object({ sha }), merge_base_commit: z.object({ sha }),
        commits: z.array(historyCommitSchema).min(1).max(100),
      }).parse(await request(`${repo}/compare/${marker.expectedHead}...${revision}?per_page=100&page=1`, credential));
      if (comparison.base_commit.sha !== marker.expectedHead || comparison.merge_base_commit.sha !== marker.expectedHead ||
          comparison.commits.length !== comparison.total_commits || comparison.ahead_by !== comparison.total_commits ||
          comparison.commits[0]?.sha !== created || comparison.commits.at(-1)?.sha !== revision ||
          new Set(comparison.commits.map((c) => c.sha)).size !== comparison.commits.length ||
          comparison.commits.some((c, i) => c.parents.length !== 1 || c.parents[0]?.sha !== (i === 0 ? marker.expectedHead : comparison.commits[i - 1]?.sha))) throw new CodeHostError();
      const initial = created === revision ? current : await treeAt(created, credential);
      const base = await treeAt(marker.expectedHead, credential);
      const leaves = initial.tree.tree.filter((e) => e.type !== 'tree');
      const originalLeaves = base.tree.tree.filter((e) => e.type !== 'tree');
      const markerEntry = initial.tree.tree.find((e) => e.path === path);
      if (initial.commit.parents.length !== 1 || initial.commit.parents[0]?.sha !== marker.expectedHead ||
          !absent(base.tree, ref.path) || !absent(base.tree, path) ||
          markerEntry?.sha !== blob.sha || markerEntry.mode !== '100644' || markerEntry.type !== 'blob' ||
          leaves.length !== originalLeaves.length + 2 || originalLeaves.some((original) =>
            !leaves.some((entry) => entry.path === original.path && entry.sha === original.sha &&
              entry.mode === original.mode && entry.type === original.type))) throw new CodeHostError();
      const artifact = await read(initial.tree, ref.path, credential);
      if (artifact.sha !== marker.blobSha || artifact.digest !== marker.contentDigest || await head(credential) !== revision) throw new CodeHostError();
      return { ...ref, outcome: 'committed', revision: created, expectedHead: marker.expectedHead,
        requestDigest: marker.requestDigest, contentDigest: artifact.digest, blobSha: artifact.sha };
    };
    return { request, token, head, treeAt, absent, inspect, total, bounded };
  };
  return {
    async inspect(raw) {
      const ref = scope(raw), session = io();
      try { return await session.inspect(ref, await session.token('read')); }
      catch { return { ...ref, outcome: 'unknown' }; }
    },
    async compareAndCreate(raw) {
      const request = requestSchema.parse(raw), ref = scope(briefSaveReferenceSchema.parse(Object.fromEntries(
        Object.keys(briefSaveReferenceSchema.shape).map((key) => [key, request[key as keyof BriefCreateRequest]]))));
      const bytes = Buffer.from(request.content, 'utf8');
      if (bytes.length > 32768 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== request.content ||
          request.contentDigest !== hash(bytes) || request.contentBlobSha !== blobHash(bytes) || request.operationPath !== operationPath(ref)) throw new CodeHostError();
      const session = io();
      try {
        const credential = await session.token('read');
        const prior = await session.inspect(ref, credential);
        if (prior.outcome === 'committed') return prior.requestDigest === request.requestDigest && prior.expectedHead === request.expectedHead &&
          prior.contentDigest === request.contentDigest && prior.blobSha === request.contentBlobSha ? prior : { ...ref, outcome: 'conflict' };
        if (prior.outcome !== 'not-found') return prior;
        if (await session.head(credential) !== request.expectedHead) return { ...ref, outcome: 'conflict' };
        const base = await session.treeAt(request.expectedHead, credential);
        if (!session.absent(base.tree, ref.path) || !session.absent(base.tree, request.operationPath)) return { ...ref, outcome: 'conflict' };
        const writeCredential = await session.token('write');
        const proof = briefWriteAuthoritySchema.parse(await session.bounded(dependencies.verifyAuthority({ ...request }), session.total));
        const now = clock().getTime(), evaluated = Date.parse(proof.evaluatedAt), expiry = Date.parse(proof.validThrough);
        if (!sameReference(proof, ref) || proof.requestDigest !== request.requestDigest || proof.expectedHead !== request.expectedHead ||
            proof.authorizationRevision !== request.expectedHead || proof.platformRevision !== config.platformRevision || proof.gate2DecisionDigest !== config.gate2DecisionDigest ||
            !Number.isFinite(now) || evaluated > now || now - evaluated > 5000 || expiry <= now || expiry <= evaluated || expiry - evaluated > 30000) throw new CodeHostError();
        const marker = markerSchema.parse({ ...ref, version: 'steer-brief-operation/v1', requestDigest: request.requestDigest,
          expectedHead: request.expectedHead, contentDigest: request.contentDigest, blobSha: request.contentBlobSha });
        const markerContent = `${JSON.stringify(marker)}\n`;
        // Exactly one mutation. Provider errors and lost acknowledgements are
        // uncertain; never retry, change keys, force, bypass protection or rebase.
        const result = z.object({ data: z.object({ createCommitOnBranch: z.object({
          commit: z.object({ oid: sha }), ref: z.object({ name: z.string() }),
        }) }), errors: z.array(z.unknown()).max(0).optional() }).parse(await session.request('/graphql', writeCredential, {
          query: 'mutation SteerCreateBrief($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } ref { name } } }',
          variables: { input: { branch: { repositoryNameWithOwner: `${binding.owner}/${binding.repository}`, branchName: binding.branch },
            expectedHeadOid: request.expectedHead, message: { headline: 'Create confirmed STEER Brief' },
            fileChanges: { additions: [{ path: request.path, contents: bytes.toString('base64') },
              { path: request.operationPath, contents: Buffer.from(markerContent).toString('base64') }] } } },
        }));
        if (result.data.createCommitOnBranch.ref.name !== binding.branch || result.data.createCommitOnBranch.commit.oid === request.expectedHead) throw new CodeHostError();
        const receipt = await session.inspect(ref, credential);
        if (receipt.outcome !== 'committed' || receipt.revision !== result.data.createCommitOnBranch.commit.oid ||
            receipt.requestDigest !== request.requestDigest || receipt.expectedHead !== request.expectedHead ||
            receipt.blobSha !== request.contentBlobSha || receipt.contentDigest !== request.contentDigest) throw new CodeHostError();
        return receipt;
      } catch { return { ...ref, outcome: 'unknown' }; }
    },
  };
}
