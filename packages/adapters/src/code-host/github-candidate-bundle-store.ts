import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateBundleInputSchema, candidateBundleManifestSchema, candidateBundlePointerSchema,
  planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { assertIntentSaveBindingCurrent, intentSaveBindingSchema, intentDocumentDraftsSchema
} from '@steer/tool-registry/intent-revision-contracts';
import { CodeHostError, type GitHubBinding } from './github.ts';
import { createGitHubAtomicSession, type GitHubAtomicDependencies } from './github-atomic-session.ts';

const sha = z.string().regex(/^[a-f0-9]{40}(?![\s\S])/);
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const configuration = z.strictObject({
  organizationId: candidateBundleInputSchema.shape.organizationId, productId: candidateBundleInputSchema.shape.productId,
  repository: candidateBundleInputSchema.shape.repository, branch: candidateBundleInputSchema.shape.branch,
  serviceCommitter: candidateBundleInputSchema.shape.serviceCommitter,
  itemIds: z.array(candidateBundleInputSchema.shape.itemId).min(1).max(100).refine(v => new Set(v).size === v.length),
  platformRevision: sha, gate2DecisionDigest: digest,
});
const bindingSchema = z.strictObject({ organizationId: configuration.shape.organizationId,
  installationId: z.number().int().positive().safe(), repositoryId: z.number().int().positive().safe(),
  owner: z.string().min(1).max(100).regex(/^[A-Za-z0-9-]+(?![\s\S])/),
  repository: z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+(?![\s\S])/).refine(v => v !== '.' && v !== '..'),
  branch: z.string().min(1).max(200).refine(v => !/[\s~^:?*\[\\\u0000-\u001f\u007f]/u.test(v)
    && !v.includes('..') && !v.includes('@{') && v.split('/').every(p => p && !p.startsWith('.') && !p.endsWith('.') && !p.endsWith('.lock'))),
});
const requestSchema = z.strictObject({ bundle: candidateBundleInputSchema, confirmation: intentSaveBindingSchema });
export type CandidateBundleSaveRequest = z.infer<typeof requestSchema>;
type Plan = Awaited<ReturnType<typeof planCandidateBundle>>;
type Session = ReturnType<typeof createGitHubAtomicSession>;
type Tree = Awaited<ReturnType<Session['treeAt']>>['tree'];
type Prepared = Readonly<{ request: CandidateBundleSaveRequest; plan: Plan }>;
export type CandidateBundlePrepared = Prepared;
export const candidateBundleStoreConfigurationSchema = configuration;

// This result may only come from trusted composition that verifies current source,
// lifecycle, human consent and gate/grant evidence, AND atomically consumes the
// durable operation's single dispatch permit. An assertion supplied by a caller,
// matching hashes, configuration or an in-memory flag is not such evidence.
export const candidateBundleDispatchProofSchema = z.strictObject({
  kind: z.literal('steer-candidate-bundle-dispatch-proof/v1'), operationId: candidateBundleInputSchema.shape.operationId,
  inputDigest: digest, currentBinding: intentSaveBindingSchema,
  authorizationRevision: sha, sourceReviewRevision: sha, lifecycleRevision: sha,
  lifecycle: z.enum(['absent-item', 'candidate-not-pulled', 'existing-target-proposal-only']),
  platformRevision: sha, gate2DecisionDigest: digest, evaluatedAt: z.iso.datetime(), validThrough: z.iso.datetime(),
});
type Outcome = { outcome: 'unknown' | 'conflict' } | { outcome: 'not-found'; observedHead: string }
  | { outcome: 'committed'; revision: string; expectedHead: string; manifestDigest: string; pointerDigest: string };
type Observation = {
  kind: 'steer-candidate-bundle-observation/v1'; operationId: string; inputDigest: string;
  gateSigned: false; executionAuthorized: false; retryAuthorized: false;
} & Outcome;
const blobHash = (content: string) => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}

/**
 * Uninstalled code-host primitive, not an enabled save tool or lifecycle service.
 * Only accepts original typed input and consent; derives every file/hash itself.
 * Authenticated recovery needs that original immutable request, not a new head or
 * new operation ID. No API bootstrap constructs this store. The required durable
 * dispatch/authority service is NOT implemented by this adapter.
 */
export function createGitHubCandidateBundleStore(rawBinding: GitHubBinding, rawConfiguration: unknown,
  dependencies: GitHubAtomicDependencies & {
    authorizeRead: (prepared: Prepared) => Promise<void>;
    authorizeAndClaimDispatch: (prepared: Prepared) => Promise<unknown>;
  }) {
  const binding = bindingSchema.parse(rawBinding), config = freeze(configuration.parse(rawConfiguration));
  if (binding.organizationId !== config.organizationId || `github:${binding.repositoryId}` !== config.repository
    || binding.branch !== config.branch || ['fetch', 'appJwt', 'authorizeRead', 'authorizeAndClaimDispatch']
      .some(key => typeof dependencies[key as keyof typeof dependencies] !== 'function')) throw new CodeHostError();
  const lifetime = new AbortController(), attempted = new Map<string, string>();
  let active = false;
  async function prepare(raw: unknown): Promise<Prepared> {
    const request = requestSchema.parse(raw), input = request.bundle;
    for (const key of ['organizationId', 'productId', 'repository', 'branch', 'serviceCommitter'] as const)
      if (input[key] !== config[key]) throw new CodeHostError();
    if (!config.itemIds.includes(input.itemId)) throw new CodeHostError();
    const plan = await planCandidateBundle(input, request.confirmation);
    return freeze({ request, plan });
  }
  function observe(p: Prepared, result: Outcome): Observation {
    return freeze({ kind: 'steer-candidate-bundle-observation/v1', operationId: p.request.bundle.operationId,
      inputDigest: p.plan.inputDigest, gateSigned: false, executionAuthorized: false, retryAuthorized: false, ...result });
  }
  const changedTreeMatches = (base: Tree, actual: Tree, plan: Plan) => {
    const expected = new Map(base.tree.filter(e => e.type !== 'tree').map(e => [e.path, e]));
    const directories = new Set(base.tree.filter(e => e.type === 'tree').map(e => e.path));
    for (const file of plan.files) {
      expected.set(file.path, { path: file.path, type: 'blob', mode: '100644', sha: blobHash(file.content) });
      file.path.split('/').slice(0, -1).forEach((_, i) => directories.add(file.path.split('/').slice(0, i + 1).join('/')));
    }
    const leaves = actual.tree.filter(e => e.type !== 'tree'), dirs = actual.tree.filter(e => e.type === 'tree');
    return leaves.length === expected.size && dirs.length === directories.size
      && dirs.every(e => e.mode === '040000' && directories.has(e.path))
      && leaves.every(e => { const original = expected.get(e.path);
        return original && e.sha === original.sha && e.mode === original.mode && e.type === original.type; });
  };
  async function checkBase(p: Prepared, io: Session, tree: Tree, credential: string) {
    const input = p.request.bundle, root = `items/${input.itemId}`;
    if (input.purpose === 'new-candidate' && !io.absent(tree, root)) return false;
    if (!io.absent(tree, `${root}/candidates/${input.bundleId}`)) return false;
    for (const file of p.plan.files) {
      if (file.mode === 'create') { if (!io.absent(tree, file.path)) return false; }
      else await io.read(tree, file.path, credential); // Reject links, executable files and invalid ancestry.
    }
    if (input.purpose === 'amendment') {
      // Physical existence only. Verified target/lifecycle authority must come
      // from authorizeAndClaimDispatch, never from these filenames.
      await io.read(tree, `${root}/BRIEF.md`, credential);
      const target = input.amendment!.target;
      const targetTree = target.revision === input.expectedHead ? tree : (await io.treeAt(target.revision, credential)).tree;
      await io.read(targetTree, `${root}/BRIEF.md`, credential);
    }
    if (input.previousBundleDigest) {
      const path = input.amendment ? `${root}/proposals/${input.amendment.proposalId}.json` : `${root}/CANDIDATE.json`;
      const file = await io.read(tree, path, credential);
      if (input.amendment && file.digest !== input.amendment.parentProposalDigest) return false;
      const pointer = candidateBundlePointerSchema.parse(JSON.parse(file.content));
      if (pointer.itemId !== input.itemId || pointer.manifestDigest !== input.previousBundleDigest
        || JSON.stringify(pointer.proposalTarget) !== JSON.stringify(input.amendment?.target ?? null)) return false;
      const previous = await io.read(tree, `${root}/${pointer.manifestPath}`, credential);
      if (previous.digest !== input.previousBundleDigest || Buffer.byteLength(previous.content) > 32000) return false;
      const manifest = candidateBundleManifestSchema.parse(JSON.parse(previous.content));
      if (manifest.bundleId !== pointer.bundleId || JSON.stringify(manifest.target) !== JSON.stringify(pointer.proposalTarget)
        || (Boolean(manifest.previousBundleDigest) !== Boolean(pointer.parentProposalDigest) && input.amendment)) return false;
      for (const key of ['organizationId', 'productId', 'repository', 'itemId'] as const) if (manifest[key] !== input[key]) return false;
      const documents = { brief: '', spec: '', exam: '' };
      for (const name of ['brief', 'spec', 'exam'] as const) {
        const doc = await io.read(tree, `${root}/${manifest.documents[name].path}`, credential);
        if (doc.digest !== manifest.documents[name].contentDigest) return false;
        documents[name] = doc.content;
      }
      intentDocumentDraftsSchema.parse(documents);
      if (Object.values(documents).some(v => !v.trim())) return false;
      if (!input.amendment && (await io.read(tree, `${root}/BRIEF.md`, credential)).digest !== manifest.documents.brief.contentDigest) return false;
    }
    return true;
  }
  async function inspectAtProvider(p: Prepared, io: Session, credential: string): Promise<Observation> {
    const { plan } = p, revision = await io.head(credential), current = await io.treeAt(revision, credential);
    const receipt = plan.files.at(-1)!;
    const history = await io.history(revision, receipt.path, credential);
    if (io.absent(current.tree, receipt.path)) {
      if (history.length || await io.head(credential) !== revision) throw new CodeHostError();
      return observe(p, { outcome: 'not-found', observedHead: revision });
    }
    const marker = await io.read(current.tree, receipt.path, credential);
    if (marker.content !== receipt.content || marker.digest !== receipt.contentDigest) return observe(p, { outcome: 'conflict' });
    if (history.length !== 1 || history[0]?.parents.length !== 1 || history[0].parents[0]?.sha !== plan.expectedHead) throw new CodeHostError();
    const created = history[0].sha;
    const comparison = z.object({ status: z.literal('ahead'), ahead_by: z.number().int().min(1).max(100), behind_by: z.literal(0),
      total_commits: z.number().int().min(1).max(100), base_commit: z.object({ sha }), merge_base_commit: z.object({ sha }),
      commits: z.array(z.object({ sha, parents: z.array(z.object({ sha })).length(1) })).min(1).max(100),
    }).parse(await io.request(`/repos/${binding.owner}/${binding.repository}/compare/${plan.expectedHead}...${revision}?per_page=100&page=1`, credential));
    if (comparison.base_commit.sha !== plan.expectedHead || comparison.merge_base_commit.sha !== plan.expectedHead
      || comparison.commits.length !== comparison.total_commits || comparison.ahead_by !== comparison.total_commits
      || comparison.commits[0]?.sha !== created || comparison.commits.at(-1)?.sha !== revision
      || new Set(comparison.commits.map(c => c.sha)).size !== comparison.commits.length
      || comparison.commits.some((c, i) => c.parents[0]?.sha !== (i === 0 ? plan.expectedHead : comparison.commits[i - 1]?.sha))) throw new CodeHostError();
    const initial = created === revision ? current : await io.treeAt(created, credential);
    const base = await io.treeAt(plan.expectedHead, credential);
    if (initial.commit.parents.length !== 1 || initial.commit.parents[0]?.sha !== plan.expectedHead
      || !await checkBase(p, io, base.tree, credential) || !changedTreeMatches(base.tree, initial.tree, plan)) throw new CodeHostError();
    for (const file of plan.files) {
      const written = await io.read(initial.tree, file.path, credential);
      if (written.content !== file.content || written.digest !== file.contentDigest) throw new CodeHostError();
    }
    if (await io.head(credential) !== revision) throw new CodeHostError();
    return observe(p, { outcome: 'committed', revision: created, expectedHead: plan.expectedHead,
      manifestDigest: plan.manifestDigest, pointerDigest: plan.pointerDigest });
  }
  async function run(raw: unknown, write: boolean, current?: () => Promise<void>): Promise<Observation> {
    const p = await prepare(raw);
    if (lifetime.signal.aborted || active) return observe(p, { outcome: 'unknown' });
    active = true;
    const io = createGitHubAtomicSession(binding, dependencies, { signal: lifetime.signal, maxRequests: 80, maxBlobBytes: 131072 });
    const authorize = async () => {
      io.total.throwIfAborted();
      if (current && await io.bounded(current(), io.total) !== undefined) throw new CodeHostError();
      const value = await io.bounded(dependencies.authorizeRead(p), io.total);
      if (value !== undefined) throw new CodeHostError();
      if (current && await io.bounded(current(), io.total) !== undefined) throw new CodeHostError();
      io.total.throwIfAborted();
    };
    try {
      await authorize();
      const credential = await io.token('read');
      let result = await inspectAtProvider(p, io, credential);
      const priorAttempt = attempted.get(p.request.bundle.operationId);
      if (priorAttempt && priorAttempt !== p.plan.inputDigest) result = observe(p, { outcome: 'conflict' });
      else if (priorAttempt && result.outcome === 'not-found') result = observe(p, { outcome: 'unknown' });
      if (write && result.outcome === 'not-found' && !priorAttempt) {
        if (attempted.size >= 256) throw new CodeHostError();
        if (result.observedHead !== p.plan.expectedHead || await io.head(credential) !== p.plan.expectedHead) result = observe(p, { outcome: 'conflict' });
        else {
          const base = await io.treeAt(p.plan.expectedHead, credential);
          if (!await checkBase(p, io, base.tree, credential)) result = observe(p, { outcome: 'conflict' });
          else {
            await authorize();
            const writeCredential = await io.token('write');
            // Remember even an uncertain dispatch-claim response. Status cannot
            // authorize retry. Durable cross-process exclusion belongs to the
            // REQUIRED trusted atomic claim service, not this bounded local map.
            attempted.set(p.request.bundle.operationId, p.plan.inputDigest);
            const proof = candidateBundleDispatchProofSchema.parse(await io.bounded(
              dependencies.authorizeAndClaimDispatch(p), io.total));
            const time = (dependencies.now ?? (() => new Date()))().getTime();
            const evaluated = Date.parse(proof.evaluatedAt), expiry = Date.parse(proof.validThrough);
            assertIntentSaveBindingCurrent(p.request.confirmation, proof.currentBinding);
            if (proof.operationId !== p.request.bundle.operationId || proof.inputDigest !== p.plan.inputDigest
              || proof.authorizationRevision !== p.plan.expectedHead || proof.sourceReviewRevision !== p.plan.expectedHead
              || proof.lifecycleRevision !== p.plan.expectedHead || proof.lifecycle !== p.plan.requiredLifecycle
              || proof.platformRevision !== config.platformRevision || proof.gate2DecisionDigest !== config.gate2DecisionDigest
              || !Number.isFinite(time) || evaluated > time || time - evaluated > 5000
              || expiry <= time || expiry <= evaluated || expiry - evaluated > 30000) throw new CodeHostError();
            io.total.throwIfAborted();
            const response = z.object({ data: z.object({ createCommitOnBranch: z.object({
              commit: z.object({ oid: sha }), ref: z.object({ name: z.literal(binding.branch) }),
            }) }), errors: z.array(z.unknown()).max(0).optional() }).parse(await io.request('/graphql', writeCredential, {
              query: 'mutation SteerSaveCandidateBundle($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } ref { name } } }',
              variables: { input: { branch: { repositoryNameWithOwner: `${binding.owner}/${binding.repository}`, branchName: binding.branch },
                expectedHeadOid: p.plan.expectedHead, message: { headline: 'Record confirmed STEER candidate bundle' },
                fileChanges: { additions: p.plan.files.map(file => ({ path: file.path, contents: Buffer.from(file.content).toString('base64') })) } } },
            }));
            result = await inspectAtProvider(p, io, credential);
            if (result.outcome !== 'committed' || result.revision !== response.data.createCommitOnBranch.commit.oid) throw new CodeHostError();
          }
        }
      }
      await authorize();
      return result;
    } catch { return observe(p, { outcome: 'unknown' }); }
    finally { void io.whenDrained().then(() => { active = false; }); }
  }
  return {
    inspect: (originalRequest: unknown, current?: () => Promise<void>) => run(originalRequest, false, current),
    compareAndWrite: (originalRequest: unknown) => run(originalRequest, true),
    close: () => lifetime.abort(),
  };
}

/** Read-only capability: no compare/write or dispatch authority is exposed. */
export function createGitHubCandidateBundleInspector(binding: GitHubBinding, configuration: unknown,
  dependencies: GitHubAtomicDependencies & { authorizeRead: (prepared: Prepared) => Promise<void> }) {
  const store = createGitHubCandidateBundleStore(binding, configuration, { ...dependencies,
    authorizeAndClaimDispatch: async () => { throw new CodeHostError(); } });
  return Object.freeze({ inspect: store.inspect, close: store.close });
}
