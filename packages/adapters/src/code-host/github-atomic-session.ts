import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CodeHostError, type GitHubBinding } from './github.ts';

const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/);
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

export type GitHubAtomicDependencies = {
  fetch: typeof globalThis.fetch; appJwt: () => Promise<string>; now?: () => Date;
};

// Internal shared bounded transport. Callers own authorization, immutable request
// validation and one-way dispatch. This helper neither retries nor grants access.
export function createGitHubAtomicSession(binding: GitHubBinding, dependencies: GitHubAtomicDependencies,
  options: { signal?: AbortSignal; maxRequests?: number; maxBlobBytes?: number } = {}) {
  const clock = dependencies.now ?? (() => new Date());
  const repo = `/repos/${binding.owner}/${binding.repository}`;

  const total = AbortSignal.any([options.signal ?? new AbortController().signal, AbortSignal.timeout(60000)]);
  let count = 0;
  let pending = 0;
  const drained: Array<() => void> = [];
  const whenDrained = () => pending === 0 ? Promise.resolve() : new Promise<void>(resolve => drained.push(resolve));
  // A hung injected transport/signer/body must not outlive the operation budget.
  const bounded = async <T>(work: Promise<T>, signal: AbortSignal): Promise<T> => {
    pending++;
    void work.finally(() => { if (--pending === 0) drained.splice(0).forEach(resolve => resolve()); }).catch(() => {});
    signal.throwIfAborted();
    let listener: () => void = () => {};
    try { return await Promise.race([work, new Promise<never>((_, reject) => {
      listener = () => reject(new CodeHostError()); signal.addEventListener('abort', listener, { once: true });
      if (signal.aborted) listener();
    })]); } finally { signal.removeEventListener('abort', listener); }
  };
  const request = async (path: string, token: string, body?: unknown): Promise<unknown> => {
    if (++count > (options.maxRequests ?? 40)) throw new CodeHostError();
    const signal = AbortSignal.any([total, AbortSignal.timeout(10000)]);
    signal.throwIfAborted();
    const response = await bounded(dependencies.fetch(`https://api.github.com${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store', signal,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10', 'content-type': 'application/json', 'cache-control': 'no-cache' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), signal);
    if (!response.ok || response.status >= 300 || !response.body) {
      if (response.body) void bounded(response.body.cancel(), total).catch(() => {});
      throw new CodeHostError();
    }
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
    } finally { void bounded(reader.cancel(), total).catch(() => {}); reader.releaseLock(); }
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
    const entries = new Map(tree.tree.map(e => [e.path, e]));
    if (tree.tree.some(e => e.path.split('/').slice(0, -1).some((_, i) => {
      const parent = entries.get(e.path.split('/').slice(0, i + 1).join('/'));
      return parent?.type !== 'tree' || parent.mode !== '040000';
    }))) throw new CodeHostError();
    return { commit, tree };
  };
  const ancestors = (tree: Tree, path: string) => path.split('/').slice(0, -1).every((_, i) => {
    const parent = tree.tree.find(e => e.path === path.split('/').slice(0, i + 1).join('/'));
    return parent?.type === 'tree' && parent.mode === '040000';
  });
  const absent = (tree: Tree, path: string) => {
    // Existing file/dir, descendants or non-directory ancestors prevent creation.
    return !tree.tree.some((e) => e.path === path || e.path.startsWith(`${path}/`) ||
      (path.startsWith(`${e.path}/`) && e.type !== 'tree'));
  };
  const read = async (tree: Tree, path: string, credential: string) => {
    const entry = tree.tree.find((e) => e.path === path);
    if (!entry || entry.mode !== '100644' || entry.type !== 'blob' || !ancestors(tree, path)) throw new CodeHostError();
    const blob = z.object({ sha, encoding: z.literal('base64'), size: z.number().int().min(0).max(options.maxBlobBytes ?? 65536),
      content: z.string().max((options.maxBlobBytes ?? 65536) * 2) }).parse(await request(`${repo}/git/blobs/${entry.sha}`, credential));
    const encoded = blob.content.replace(/\n/g, ''), bytes = Buffer.from(encoded, 'base64');
    if (bytes.length !== blob.size || bytes.toString('base64') !== encoded || blob.sha !== entry.sha || blobHash(bytes) !== entry.sha) throw new CodeHostError();
    return { content: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), sha: entry.sha, digest: hash(bytes) };
  };
  const history = async (revision: string, path: string, credential: string) => z.array(historyCommitSchema).max(2)
    .parse(await request(`${repo}/commits?sha=${revision}&path=${encodeURIComponent(path)}&per_page=2`, credential));

  return { request, token, head, treeAt, absent, read, history, total, bounded, whenDrained };
}
