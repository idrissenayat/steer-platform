import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateBundlePointerSchema, candidateBundleManifestSchema, candidatePointerReferenceSchema } from '@steer/tool-registry/candidate-bundle-contracts';
import { verifyScopeInventory } from '../../../packages/adapters/src/code-host/scope-inventory.ts';
import type { IntentCorpusAuthority } from '../../../packages/adapters/src/code-host/intent-corpus-evidence.ts';
import type { GitHubBinding } from '../../../packages/adapters/src/code-host/github.ts';
import { corpusBatchQuery, partitionCorpusBatch } from './corpus-batch-prototype.ts';

// TEST ONLY. One local immutable-object graph; no cache survives this invocation.
// Every revision/path retains separate membership, selection and policy checks.
const oid = z.string().regex(/^[a-f0-9]{40}$/), fail = () => new Error('Synthetic corpus read graph unavailable.');
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
type File = { path: string; content: string; contentDigest: string; blobSha: string };
type Selection = { context: Parameters<IntentCorpusAuthority['select']>[0]; value: any; root: string; candidate: boolean };
type Context = { revision: string; tree: ReturnType<typeof verifyScopeInventory>; sizes: Map<string, number>;
  byPath: Map<string, ReturnType<typeof verifyScopeInventory>['entries'][number]>; selections: Selection[]; files: Map<string, File> };

async function json(response: Response) {
  if (!response.ok || !response.body) throw fail();
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  try { for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength;
    if (bytes > 2097152) { await reader.cancel(); throw fail(); } chunks.push(next.value); }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally { reader.releaseLock(); }
}
export async function collectCorpusReadgraphPrototype(rawBinding: GitHubBinding, productId: string, rawRevisions: unknown,
  transport: typeof fetch, authority: IntentCorpusAuthority, revalidate: () => Promise<void>, signal = new AbortController().signal) {
  const revisions = z.array(oid).min(1).max(4).parse(rawRevisions);
  if (new Set(revisions).size !== revisions.length) throw fail();
  const binding = Object.freeze({ ...rawBinding }), pinned = JSON.stringify(binding);
  if (binding.owner !== 'synthetic' || binding.repository !== 'fixture' || binding.repositoryId !== 52) throw fail();
  const scope = Object.freeze({ organizationId: binding.organizationId, productId, repository: `github:${binding.repositoryId}`, branch: binding.branch });
  const ports = { authorize: authority.authorize, select: authority.select, authorizeSource: authority.authorizeSource };
  const guard = () => { signal.throwIfAborted(); if (JSON.stringify(rawBinding) !== pinned
    || Object.entries(ports).some(([name, port]) => authority[name as keyof typeof ports] !== port)) throw fail(); };
  let permissions: string | undefined, token: string | undefined, requests = 0, sourcePolicyQueries = 0;
  const current = async () => { guard(); const p = await ports.authorize.call(authority, scope); guard();
    if (!p || typeof p.permissionsRevision !== 'string' || !p.permissionsRevision || p.permissionsRevision.length > 256
      || (permissions !== undefined && p.permissionsRevision !== permissions)) throw fail(); permissions = p.permissionsRevision;
    if (await revalidate() !== undefined) throw fail(); guard(); };
  const grant = async (c: Context, path: string) => { guard(); sourcePolicyQueries++;
    if (await ports.authorizeSource.call(authority, Object.freeze({ ...scope, revision: c.revision, path })) !== undefined) throw fail(); guard(); };
  const send = async (path: string, credential: string, body?: unknown) => { guard(); if (++requests > 40) throw fail();
    return json(await transport(`https://api.github.com${path}`, { method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), headers: { authorization: `Bearer ${credential}`, accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })); };
  const request = async (path: string, body?: unknown) => {
    if (!token) { const t = await send(`/app/installations/${binding.installationId}/access_tokens`, 'synthetic-app-jwt',
      { repository_ids: [binding.repositoryId], permissions: { contents: 'read' } });
      if (t.token !== 'synthetic-read' || t.permissions.contents !== 'read'
        || Object.entries(t.permissions).some(([k, v]) => !['contents', 'metadata'].includes(k) || v !== 'read')
        || t.repositories.length !== 1 || t.repositories[0].id !== binding.repositoryId
        || t.repositories[0].full_name !== `${binding.owner}/${binding.repository}`) throw fail(); token = t.token;
    } return send(path, token!, body);
  };
  const io = async <T>(work: () => Promise<T>) => { await current(); const result = await work(); await current(); return result; };
  const repo = `/repos/${binding.owner}/${binding.repository}`;
  const head = async () => { const raw = await request(`${repo}/git/ref/heads/${binding.branch}`);
    if (raw.ref !== `refs/heads/${binding.branch}` || raw.object.type !== 'commit') throw fail(); return oid.parse(raw.object.sha); };
  const observedHead = await io(head);
  const contexts = await io(async () => {
    const contexts: Context[] = [];
    for (const revision of revisions) {
      const commit = await request(`${repo}/git/commits/${revision}`); if (commit.sha !== revision) throw fail();
      const treeSha = oid.parse(commit.tree.sha), raw = await request(`${repo}/git/trees/${treeSha}?recursive=1`);
      if (raw.sha !== treeSha || raw.truncated !== false || !Array.isArray(raw.tree) || raw.tree.length > 10000) throw fail();
      const sizes = new Map<string, number>();
      const entries = raw.tree.filter((e: any) => /^(intent|items)(\/|$)/.test(e.path)).map((e: any) => {
        if (e.size !== undefined) { if (!Number.isSafeInteger(e.size) || e.size < 0) throw fail(); sizes.set(e.path, e.size); }
        return { path: e.path, objectSha: e.sha, mode: e.mode, type: e.type };
      });
      const tree = verifyScopeInventory({ organizationId: scope.organizationId, repositoryId: binding.repositoryId, revision, treeSha, entries });
      if (tree.unsupportedRootCount) throw fail();
      contexts.push({ revision, tree, sizes, byPath: new Map(tree.entries.map(e => [e.path, e])), selections: [], files: new Map() });
    } return contexts;
  });
  for (const c of contexts) for (const root of c.tree.roots) {
    const context = Object.freeze({ ...scope, revision: c.revision, root: root.path, treeSha: root.objectSha });
    guard(); const raw = await ports.select.call(authority, context); guard();
    const value = z.object({ organizationId: z.literal(scope.organizationId), productId: z.literal(productId), repository: z.literal(scope.repository),
      branch: z.literal(scope.branch), revision: z.literal(c.revision), root: z.literal(root.path), treeSha: z.literal(root.objectSha),
      selection: z.enum(['canonical', 'pre-pull-candidate', 'out-of-product']), authorityDigest: z.string().regex(/^[a-f0-9]{64}$/) }).parse(raw);
    c.selections.push({ context, value, root: root.path, candidate: value.selection === 'pre-pull-candidate' });
  }
  const blobs = new Map<string, Omit<File, 'path'>>(), waves: Array<{ name: string; paths: number; fetchedObjects: number; batches: number }> = [];
  const wave = async (name: string, wanted: Array<{ c: Context; path: string }>) => {
    const refs = wanted.filter((ref, i) => !ref.c.files.has(ref.path) && wanted.findIndex(v => v.c === ref.c && v.path === ref.path) === i)
      .map(({ c, path }) => { const e = c.byPath.get(path); if (!e || e.type !== 'blob' || e.mode !== '100644') throw fail();
        const size = c.sizes.get(path) ?? 131072; if (!Number.isSafeInteger(size) || size < 1 || size > 131072) throw fail();
        return { c, path, oid: e.objectSha, size, hasSize: c.sizes.has(path) }; });
    for (const c of contexts) if (c.files.size + refs.filter(r => r.c === c).length > 100) throw fail();
    const objects = new Map<string, { oid: string; size: number }>();
    for (const ref of refs) { const prior = objects.get(ref.oid); if (prior && prior.size !== ref.size) throw fail(); objects.set(ref.oid, { oid: ref.oid, size: ref.size }); }
    const retained = new Set([...objects.keys()].filter(id => blobs.has(id))), fresh = [...objects.values()].filter(v => !retained.has(v.oid));
    const batches = partitionCorpusBatch(fresh); if (!batches.length && refs.length) batches.push([]);
    for (const [index, batch] of batches.entries()) {
      const active = refs.filter(r => batch.some(b => b.oid === r.oid) || (index === 0 && retained.has(r.oid)));
      for (const ref of active) await grant(ref.c, ref.path);
      await current();
      if (batch.length) {
        const raw = await request('/graphql', { query: corpusBatchQuery(batch.length), variables: { owner: binding.owner, name: binding.repository,
          ...Object.fromEntries(batch.map((f, i) => [`o${i}`, f.oid])) } }); guard();
        if (!raw || Object.keys(raw).length !== 1 || !raw.data || Object.keys(raw.data).join() !== 'repository') throw fail();
        const repository = raw.data.repository;
        if (!repository || repository.databaseId !== binding.repositoryId || repository.nameWithOwner !== `${binding.owner}/${binding.repository}`
          || Object.keys(repository).sort().join() !== ['databaseId', 'nameWithOwner', ...batch.map((_, i) => `b${i}`)].sort().join()) throw fail();
        for (const [i, item] of batch.entries()) {
          const value = z.strictObject({ __typename: z.literal('Blob'), oid, byteSize: z.number().int().min(1).max(131072),
            isBinary: z.literal(false), isTruncated: z.literal(false), text: z.string().min(1).max(131072).refine(v => !/[\uD800-\uDFFF]/u.test(v)) }).parse(repository[`b${i}`]);
          const length = Buffer.byteLength(value.text), blobSha = createHash('sha1').update(`blob ${length}\0`).update(value.text).digest('hex');
          if (value.oid !== item.oid || blobSha !== item.oid || length !== value.byteSize || !value.text.trim()) throw fail();
          blobs.set(item.oid, { content: value.text, contentDigest: hash(value.text), blobSha });
        }
      }
      for (const ref of active) { const value = blobs.get(ref.oid); if (!value || (ref.hasSize && Buffer.byteLength(value.content) !== ref.size)) throw fail(); await grant(ref.c, ref.path); }
      await current(); for (const ref of active) ref.c.files.set(ref.path, { path: ref.path, ...blobs.get(ref.oid)! });
    }
    waves.push({ name, paths: refs.length, fetchedObjects: fresh.length, batches: batches.length });
  };
  const pointers: Array<{ c: Context; path: string }> = [], roots: typeof pointers = [];
  for (const c of contexts) for (const s of c.selections.filter(s => s.value.selection !== 'out-of-product')) {
    if (!s.candidate && c.byPath.has(`${s.root}/CANDIDATE.json`)) throw fail();
    for (const name of ['BRIEF', 'SPEC']) if (c.byPath.has(`${s.root}/${name}.md`)) roots.push({ c, path: `${s.root}/${name}.md` }); else if (name === 'BRIEF' || !s.candidate) throw fail();
    if (c.byPath.has(`${s.root}/CANDIDATE.json`)) pointers.push({ c, path: `${s.root}/CANDIDATE.json` });
    for (const e of c.tree.entries) if (e.path.startsWith(`${s.root}/proposals/`) && e.type !== 'tree') {
      const ref = candidatePointerReferenceSchema.parse({ ...scope, revision: c.revision, itemId: s.root.slice(6), proposalId: e.path.slice(`${s.root}/proposals/`.length).replace(/\.json$/, '') });
      if (e.path !== `${s.root}/proposals/${ref.proposalId}.json`) throw fail(); pointers.push({ c, path: e.path });
    }
    if (s.candidate && !c.byPath.has(`${s.root}/CANDIDATE.json`)) throw fail();
  }
  await wave('roots-and-pointers', [...roots, ...pointers]);
  const parsed = pointers.map(({ c, path }) => { const file = c.files.get(path)!; if (Buffer.byteLength(file.content) > 8000) throw fail();
    const value = candidateBundlePointerSchema.parse(JSON.parse(file.content)), root = path.split('/').slice(0, 2).join('/');
    if (root !== `items/${value.itemId}` || Boolean(value.proposalTarget) !== path.includes('/proposals/')) throw fail();
    return { c, value, root, manifestPath: `${root}/${value.manifestPath}` }; });
  await wave('manifests', parsed.map(p => ({ c: p.c, path: p.manifestPath })));
  const manifests = parsed.map(p => { const file = p.c.files.get(p.manifestPath)!;
    if (Buffer.byteLength(file.content) > 32000 || file.contentDigest !== p.value.manifestDigest) throw fail();
    const manifest = candidateBundleManifestSchema.parse(JSON.parse(file.content));
    if (manifest.organizationId !== scope.organizationId || manifest.productId !== productId || manifest.repository !== scope.repository
      || manifest.itemId !== p.value.itemId || manifest.bundleId !== p.value.bundleId || JSON.stringify(manifest.target) !== JSON.stringify(p.value.proposalTarget)
      || (p.value.proposalTarget && Boolean(p.value.parentProposalDigest) !== Boolean(manifest.previousBundleDigest))) throw fail(); return { ...p, manifest }; });
  await wave('bundle-documents', manifests.flatMap(m => Object.values(m.manifest.documents).map(d => ({ c: m.c, path: `${m.root}/${d.path}` }))));
  const results = contexts.map(c => {
    const semantic: Array<File & { status: 'canonical' | 'candidate' | 'amendment' }> = [];
    for (const s of c.selections.filter(s => s.value.selection !== 'out-of-product' && !s.candidate)) for (const name of ['BRIEF', 'SPEC']) semantic.push({ ...c.files.get(`${s.root}/${name}.md`)!, status: 'canonical' });
    for (const m of manifests.filter(m => m.c === c)) {
      for (const name of ['brief', 'spec', 'exam'] as const) { const ref = m.manifest.documents[name], file = c.files.get(`${m.root}/${ref.path}`);
        if (!file || file.contentDigest !== ref.contentDigest) throw fail(); if (name !== 'exam') semantic.push({ ...file, status: m.value.proposalTarget ? 'amendment' : 'candidate' }); }
      if (!m.value.proposalTarget && c.files.get(`${m.root}/BRIEF.md`)!.contentDigest !== m.manifest.documents.brief.contentDigest) throw fail();
    } return { revision: c.revision, files: [...c.files.values()], semantic };
  });
  for (const c of contexts) { for (const s of c.selections) { guard(); if (JSON.stringify(await ports.select.call(authority, s.context)) !== JSON.stringify(s.value)) throw fail(); guard(); }
    for (const path of c.files.keys()) await grant(c, path); }
  if (await io(head) !== observedHead) throw fail(); guard();
  return { contexts: results, waves, requests, sourcePolicyQueries, uniqueBlobObjects: blobs.size, productionInstalled: false as const };
}
