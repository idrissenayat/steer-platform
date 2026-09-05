import { createHash, createPrivateKey } from 'node:crypto';
import { SignJWT } from 'jose';
import { z } from 'zod';

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const bindingSchema = z.strictObject({
  organizationId: z.string().min(1).max(200),
  installationId: z.number().int().positive().safe(), repositoryId: z.number().int().positive().safe(),
  owner: z.string().regex(/^[A-Za-z0-9-]+$/), repository: z.string().regex(/^[A-Za-z0-9_.-]+$/).refine((value) => value !== '.' && value !== '..'),
  branch: z.string().min(1).max(200).refine((value) => !/[\s~^:?*\[\\]/.test(value) && !value.includes('..') && !value.startsWith('/') && !value.endsWith('/') && !value.endsWith('.lock')),
});
export type GitHubBinding = z.infer<typeof bindingSchema>;
export interface ArtifactSnapshot {
  organizationId: string;
  repositoryId: number;
  revision: string;
  path: string;
  content: string;
  contentDigest: string;
  blobSha: string;
}
export interface ArtifactReader {
  readonly binding: Readonly<GitHubBinding>;
  readHead(): Promise<string>;
  readArtifact(path: string, revision: string): Promise<ArtifactSnapshot>;
}
export interface ArtifactInventory {
  organizationId: string;
  repositoryId: number;
  revision: string;
  treeSha: string;
  entries: { path: string; blobSha: string }[];
}
export interface RepositoryReader extends ArtifactReader {
  readInventory(selection: ArtifactSelection, revision: string): Promise<ArtifactInventory>;
}
export class CodeHostError extends Error {
  constructor() { super('The configured code-host source could not be verified.'); }
}
const pathSchema = z.string().min(1).max(500).refine((value) =>
  value.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..') && !/[\\\u0000-\u001f\u007f]/.test(value));
export const artifactSelectionSchema = z.strictObject({
  roots: z.array(z.union([z.literal(''), pathSchema])).min(1).max(10),
  fileNames: z.array(pathSchema.refine((value) => !value.includes('/'))).min(1).max(20),
}).refine((value) => new Set(value.fileNames).size === value.fileNames.length && new Set(value.roots).size === value.roots.length &&
  !value.roots.some((root, index) => value.roots.some((other, otherIndex) => index !== otherIndex && (other === '' || root.startsWith(`${other}/`)))));
export type ArtifactSelection = z.infer<typeof artifactSelectionSchema>;
export function matchesArtifactSelection(path: string, selection: ArtifactSelection) {
  return selection.roots.some((root) => root === '' || path.startsWith(`${root}/`)) && selection.fileNames.includes(path.slice(path.lastIndexOf('/') + 1));
}
const maxArtifactBytes = 512 * 1024;
const maxResponseBytes = 2 * 1024 * 1024;

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok || response.status >= 300 || !response.body) throw new CodeHostError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxResponseBytes) { await reader.cancel(); throw new CodeHostError(); }
      chunks.push(part.value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally { reader.releaseLock(); }
}

export function createAppJwtSigner(appId: string, privateKeyPem: string, clock = () => new Date()) {
  if (!/^[1-9][0-9]*$/.test(appId)) throw new CodeHostError();
  let key: ReturnType<typeof createPrivateKey>;
  try {
    key = createPrivateKey(privateKeyPem);
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new CodeHostError();
  } catch { throw new CodeHostError(); }
  return async () => {
    const epoch = Math.floor(clock().getTime() / 1000);
    if (!Number.isFinite(epoch)) throw new CodeHostError();
    return new SignJWT({}).setProtectedHeader({ alg: 'RS256' }).setIssuer(appId)
      .setIssuedAt(epoch - 60).setExpirationTime(epoch + 480).sign(key);
  };
}

export function createGitHubReader(rawBinding: GitHubBinding, dependencies: {
  appJwt: () => Promise<string>; fetch?: typeof globalThis.fetch; now?: () => Date;
}): RepositoryReader {
  const parsed = bindingSchema.safeParse(rawBinding);
  if (!parsed.success) throw new CodeHostError();
  const binding = Object.freeze(parsed.data);
  const transport = dependencies.fetch ?? globalThis.fetch;
  const clock = dependencies.now ?? (() => new Date());
  const repoPath = `/repos/${encodeURIComponent(binding.owner)}/${encodeURIComponent(binding.repository)}`;
  let cached: { token: string; expires: number } | undefined;
  const request = async (path: string, token: string, body?: unknown) => boundedJson(await transport(`https://api.github.com${path}`, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'content-type': 'application/json', 'cache-control': 'no-cache' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  const token = async () => {
    const now = clock().getTime();
    if (!Number.isFinite(now)) throw new CodeHostError();
    if (cached && cached.expires > now + 60000) return cached.token;
    cached = undefined;
    const result = z.object({
      token: z.string().min(1).max(2000), expires_at: z.iso.datetime(),
      permissions: z.record(z.string(), z.string()),
      repositories: z.array(z.object({ id: z.number(), full_name: z.string() })),
    }).parse(await request(`/app/installations/${binding.installationId}/access_tokens`, await dependencies.appJwt(), {
      repository_ids: [binding.repositoryId], permissions: { contents: 'read' },
    }));
    const expiry = Date.parse(result.expires_at);
    if (expiry <= now + 60000 || expiry > now + 3660000 || result.repositories.length !== 1 ||
        result.repositories[0]?.id !== binding.repositoryId ||
        result.repositories[0]?.full_name.toLowerCase() !== `${binding.owner}/${binding.repository}`.toLowerCase() ||
        result.permissions.contents !== 'read' || Object.entries(result.permissions).some(([name, level]) => !['contents', 'metadata'].includes(name) || level !== 'read')) throw new CodeHostError();
    cached = { token: result.token, expires: expiry };
    return cached.token;
  };
  const safely = async <T>(operation: () => Promise<T>): Promise<T> => {
    try { return await operation(); } catch { cached = undefined; throw new CodeHostError(); }
  };
  return {
    binding,
    readHead: () => safely(async () => {
      const result = z.object({ ref: z.string(), object: z.object({ type: z.literal('commit'), sha }) }).parse(
        await request(`${repoPath}/git/ref/heads/${binding.branch.split('/').map(encodeURIComponent).join('/')}`, await token()));
      if (result.ref !== `refs/heads/${binding.branch}`) throw new CodeHostError();
      return result.object.sha;
    }),
    readInventory: (rawSelection, revision) => safely(async () => {
      const selection = artifactSelectionSchema.parse(rawSelection); sha.parse(revision);
      const credential = await token();
      const commit = z.object({ sha, tree: z.object({ sha }) }).parse(await request(`${repoPath}/git/commits/${revision}`, credential));
      if (commit.sha !== revision) throw new CodeHostError();
      const tree = z.object({ sha, truncated: z.boolean(), tree: z.array(z.object({ path: pathSchema,
        mode: z.string(), type: z.string(), sha })).max(10000) }).parse(await request(`${repoPath}/git/trees/${commit.tree.sha}?recursive=1`, credential));
      if (tree.sha !== commit.tree.sha || tree.truncated || new Set(tree.tree.map((entry) => entry.path)).size !== tree.tree.length) throw new CodeHostError();
      const entries: ArtifactInventory['entries'] = [];
      for (const entry of tree.tree) {
        if (!((entry.type === 'tree' && entry.mode === '040000') || (entry.type === 'commit' && entry.mode === '160000') ||
          (entry.type === 'blob' && ['100644', '100755', '120000'].includes(entry.mode)))) throw new CodeHostError();
        if (!matchesArtifactSelection(entry.path, selection)) continue;
        if (entry.type !== 'blob' || entry.mode !== '100644') throw new CodeHostError();
        entries.push({ path: entry.path, blobSha: entry.sha });
        if (entries.length > 100) throw new CodeHostError();
      }
      entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
      return { organizationId: binding.organizationId, repositoryId: binding.repositoryId, revision, treeSha: tree.sha, entries };
    }),
    readArtifact: (path, revision) => safely(async () => {
      pathSchema.parse(path); sha.parse(revision);
      const credential = await token();
      const commit = z.object({ sha, tree: z.object({ sha }) }).parse(await request(`${repoPath}/git/commits/${revision}`, credential));
      if (commit.sha !== revision) throw new CodeHostError();
      const tree = z.object({ sha, truncated: z.boolean(), tree: z.array(z.object({ path: z.string(), mode: z.string(), type: z.string(), sha })) }).parse(
        await request(`${repoPath}/git/trees/${commit.tree.sha}?recursive=1`, credential));
      if (tree.sha !== commit.tree.sha || tree.truncated) throw new CodeHostError();
      const matches = tree.tree.filter((entry) => entry.path === path);
      const entry = matches[0];
      if (matches.length !== 1 || !entry || entry.type !== 'blob' || entry.mode !== '100644') throw new CodeHostError();
      const blob = z.object({ sha, encoding: z.literal('base64'), size: z.number().int().min(0).max(maxArtifactBytes), content: z.string().max(maxArtifactBytes * 2) }).parse(
        await request(`${repoPath}/git/blobs/${entry.sha}`, credential));
      const encoded = blob.content.replace(/\n/g, '');
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new CodeHostError();
      const bytes = Buffer.from(encoded, 'base64');
      const gitDigest = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (bytes.length !== blob.size || bytes.length > maxArtifactBytes || bytes.toString('base64') !== encoded || gitDigest !== entry.sha || blob.sha !== entry.sha) throw new CodeHostError();
      return { organizationId: binding.organizationId, repositoryId: binding.repositoryId, revision, path,
        content: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
        contentDigest: createHash('sha256').update(bytes).digest('hex'), blobSha: gitDigest };
    }),
  };
}
