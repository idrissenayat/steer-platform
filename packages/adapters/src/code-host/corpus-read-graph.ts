import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateBundleReferenceSchema, candidateBundlePointerSchema, candidateBundleManifestSchema,
  candidatePointerReferenceSchema } from '@steer/tool-registry/candidate-bundle-contracts';
import type { CorpusRepositoryReader, ArtifactSnapshot } from './github.ts';
import type { IntentCorpusAuthority, CorpusSelectionContext } from './intent-corpus-evidence.ts';
import { verifyScopeInventory } from './scope-inventory.ts';
import { readCorpusArtifactBatch } from './corpus-artifact-batch.ts';

const scopeSchema = candidateBundleReferenceSchema.pick({ organizationId: true, productId: true, repository: true, branch: true });
const revisionSchema = candidateBundleReferenceSchema.shape.revision;
const selectedSchema = z.strictObject({ ...scopeSchema.shape, revision: revisionSchema, root: z.string(), treeSha: revisionSchema,
  selection: z.enum(['canonical', 'pre-pull-candidate', 'out-of-product']), authorityDigest: candidateBundleReferenceSchema.shape.manifestDigest });
type Selection = { context: Readonly<CorpusSelectionContext>; value: z.infer<typeof selectedSchema> };
type File = Readonly<ArtifactSnapshot>;
type Context = { revision: string; inventory: Awaited<ReturnType<CorpusRepositoryReader['readScopeInventory']>>;
  tree: ReturnType<typeof verifyScopeInventory>; entries: Map<string, ReturnType<typeof verifyScopeInventory>['entries'][number]>;
  selections: Selection[]; files: Map<string, File> };
export type CorpusGraphSnapshot = Readonly<{ scope: Readonly<z.infer<typeof scopeSchema>>;
  observedHead: string; permissionsRevision: string; authoritativeClearance: false;
  contexts: readonly Readonly<{ revision: string; files: readonly File[];
    semantic: readonly Readonly<File & { status: 'canonical' | 'candidate' | 'amendment' }>[] }>[] }>;
const fail = () => new Error('The complete corpus graph could not be verified; this does not establish new intent.');
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Internal read-only composition. No factory activation, browser grant, cached
 * authorization or write belongs here. Dependent records retain their own policy. */
export function createCorpusReadGraph(reader: CorpusRepositoryReader, rawScope: unknown, authority: IntentCorpusAuthority,
  options: { monotonicNow?: () => number } = {}) {
  const scope = freeze(scopeSchema.parse(rawScope)), binding = hash(reader.binding), clock = options.monotonicNow ?? (() => performance.now());
  if (reader.binding.organizationId !== scope.organizationId || `github:${reader.binding.repositoryId}` !== scope.repository
    || reader.binding.branch !== scope.branch) throw fail();
  const readerPorts = { readHead: reader.readHead, readScopeInventory: reader.readScopeInventory, readArtifact: reader.readArtifact };
  const policyPorts = { authorize: authority.authorize, select: authority.select, authorizeSource: authority.authorizeSource };
  if ([...Object.values(readerPorts), ...Object.values(policyPorts)].some(port => typeof port !== 'function')) throw fail();
  const lifetime = new AbortController(), pending = new Set<Promise<unknown>>();
  const pinned = () => {
    if (lifetime.signal.aborted || hash(reader.binding) !== binding
      || Object.entries(readerPorts).some(([key, port]) => reader[key as keyof typeof readerPorts] !== port)
      || Object.entries(policyPorts).some(([key, port]) => authority[key as keyof typeof policyPorts] !== port)) throw fail();
  };
  async function withReadSet<T>(rawRevisions: unknown, current: () => Promise<void>, use: (graph: CorpusGraphSnapshot) => Promise<T>,
    externalSignal?: AbortSignal): Promise<T> {
    pinned();
    const revisions = z.array(revisionSchema).min(1).max(4).parse(rawRevisions);
    if (pending.size >= 4 || new Set(revisions).size !== revisions.length || typeof current !== 'function' || typeof use !== 'function') throw fail();
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(30000), ...(externalSignal ? [externalSignal] : [])]);
    let finished = false, lastClock = clock(), permissionsRevision: string | undefined;
    const start = lastClock;
    const guard = () => {
      pinned(); signal.throwIfAborted(); const now = clock();
      if (finished || !Number.isFinite(start) || !Number.isFinite(now) || now < lastClock || now - start >= 30000) throw fail();
      lastClock = now;
    };
    const check = async () => {
      guard(); const value = z.strictObject({ permissionsRevision: z.string().min(1).max(256) }).parse(await Reflect.apply(policyPorts.authorize, authority, [scope]));
      guard(); if (permissionsRevision !== undefined && value.permissionsRevision !== permissionsRevision) throw fail();
      permissionsRevision = value.permissionsRevision;
      if (await current() !== undefined) throw fail(); guard();
    };
    const grant = async (revision: string, path: string) => {
      guard(); if (await Reflect.apply(policyPorts.authorizeSource, authority, [freeze({ ...scope, revision, path })]) !== undefined) throw fail(); guard();
    };
    const select = async (context: Readonly<CorpusSelectionContext>) => {
      guard(); const value = selectedSchema.parse(await Reflect.apply(policyPorts.select, authority, [context])); guard();
      if (Object.entries(context).some(([key, expected]) => expected !== value[key as keyof typeof value])) throw fail();
      return freeze(value);
    };
    // Work remains tracked after the public race rejects, until its actual IO or
    // trusted callback settles. No timeout releases a still-busy admission slot.
    const work = Promise.resolve().then(async () => {
      await check(); const observedHead = revisionSchema.parse(await Reflect.apply(readerPorts.readHead, reader, [])); await check();
      const contexts: Context[] = [];
      for (const revision of revisions) {
        guard(); const inventory = await Reflect.apply(readerPorts.readScopeInventory, reader, [revision]); guard();
        const tree = verifyScopeInventory(inventory);
        if (tree.organizationId !== scope.organizationId || `github:${tree.repositoryId}` !== scope.repository || tree.revision !== revision
          || tree.unsupportedRootCount || tree.roots.length > 250) throw fail();
        contexts.push({ revision, inventory, tree, entries: new Map(tree.entries.map(e => [e.path, e])), selections: [], files: new Map() });
      }
      await check();
      for (const c of contexts) for (const root of c.tree.roots) {
        const context = freeze({ ...scope, revision: c.revision, root: root.path, treeSha: root.objectSha });
        c.selections.push({ context, value: await select(context) });
      }
      type Wanted = { context: Context; path: string };
      const wave = async (wanted: Wanted[]) => {
        const unique = wanted.filter((ref, i) => !ref.context.files.has(ref.path)
          && wanted.findIndex(other => other.context === ref.context && other.path === ref.path) === i);
        for (const c of contexts) if (c.files.size + unique.filter(ref => ref.context === c).length > 100) throw fail();
        for (const ref of unique) {
          const entry = ref.context.entries.get(ref.path);
          if (!entry || entry.type !== 'blob' || entry.mode !== '100644') throw fail();
        }
        for (let offset = 0; offset < unique.length; offset += 100) {
          const refs = unique.slice(offset, offset + 100);
          const files = await readCorpusArtifactBatch(reader, refs.map(({ context, path }) => ({ inventory: context.inventory, revision: context.revision, path })),
            { current: check, authorizeSource: ref => grant(ref.revision, ref.path), signal }); guard();
          for (const [index, file] of files.entries()) {
            const ref = refs[index]!;
            if (!file.content.trim() || file.path !== ref.path || file.revision !== ref.context.revision) throw fail();
            ref.context.files.set(ref.path, file);
          }
        }
      };
      const roots: Wanted[] = [], pointers: Wanted[] = [];
      for (const c of contexts) for (const selection of c.selections) {
        const selected = selection.value, root = selected.root;
        if (selected.selection === 'out-of-product') continue;
        const candidate = selected.selection === 'pre-pull-candidate';
        if (root.startsWith('intent/') && candidate) throw fail();
        if (candidate !== c.entries.has(`${root}/CANDIDATE.json`)) throw fail();
        const proposals = c.entries.get(`${root}/proposals`);
        if (proposals && (proposals.type !== 'tree' || proposals.mode !== '040000')) throw fail();
        for (const name of ['BRIEF', 'SPEC']) {
          const path = `${root}/${name}.md`;
          if (c.entries.has(path)) roots.push({ context: c, path }); else if (name === 'BRIEF' || !candidate) throw fail();
        }
        if (candidate) pointers.push({ context: c, path: `${root}/CANDIDATE.json` });
        for (const entry of c.tree.entries) if (entry.path.startsWith(`${root}/proposals/`) && entry.type !== 'tree') {
          if (!root.startsWith('items/')) throw fail();
          const proposalId = entry.path.slice(`${root}/proposals/`.length).replace(/\.json$/, '');
          const ref = candidatePointerReferenceSchema.parse({ ...scope, revision: c.revision, itemId: root.slice(6), proposalId });
          if (entry.path !== `${root}/proposals/${ref.proposalId}.json`) throw fail();
          pointers.push({ context: c, path: entry.path });
        }
      }
      await wave([...roots, ...pointers]);
      const parsed = pointers.map(({ context, path }) => {
        const file = context.files.get(path)!; if (Buffer.byteLength(file.content) > 8000) throw fail();
        const pointer = candidateBundlePointerSchema.parse(JSON.parse(file.content)), root = path.split('/').slice(0, 2).join('/');
        if (root !== `items/${pointer.itemId}` || Boolean(pointer.proposalTarget) !== path.includes('/proposals/')) throw fail();
        return { context, pointer, root, manifestPath: `${root}/${pointer.manifestPath}` };
      });
      await wave(parsed.map(p => ({ context: p.context, path: p.manifestPath })));
      const manifests = parsed.map(p => {
        const file = p.context.files.get(p.manifestPath)!;
        if (Buffer.byteLength(file.content) > 32000 || file.contentDigest !== p.pointer.manifestDigest) throw fail();
        const manifest = candidateBundleManifestSchema.parse(JSON.parse(file.content));
        if (manifest.organizationId !== scope.organizationId || manifest.productId !== scope.productId || manifest.repository !== scope.repository
          || manifest.itemId !== p.pointer.itemId || manifest.bundleId !== p.pointer.bundleId
          || JSON.stringify(manifest.target) !== JSON.stringify(p.pointer.proposalTarget)
          || (p.pointer.proposalTarget && Boolean(p.pointer.parentProposalDigest) !== Boolean(manifest.previousBundleDigest))) throw fail();
        return { ...p, manifest };
      });
      await wave(manifests.flatMap(m => Object.values(m.manifest.documents).map(d => ({ context: m.context, path: `${m.root}/${d.path}` }))));
      const snapshot: CorpusGraphSnapshot = freeze({ scope, observedHead, permissionsRevision: permissionsRevision!, authoritativeClearance: false, contexts: contexts.map(c => {
        const semantic: Array<File & { status: 'canonical' | 'candidate' | 'amendment' }> = [];
        for (const s of c.selections.filter(s => s.value.selection === 'canonical')) for (const name of ['BRIEF', 'SPEC'])
          semantic.push({ ...c.files.get(`${s.value.root}/${name}.md`)!, status: 'canonical' });
        for (const m of manifests.filter(m => m.context === c)) {
          for (const name of ['brief', 'spec', 'exam'] as const) {
            const document = m.manifest.documents[name], file = c.files.get(`${m.root}/${document.path}`);
            if (!file || file.contentDigest !== document.contentDigest) throw fail();
            if (name !== 'exam') semantic.push({ ...file, status: m.pointer.proposalTarget ? 'amendment' : 'candidate' });
          }
          if (!m.pointer.proposalTarget && c.files.get(`${m.root}/BRIEF.md`)!.contentDigest !== m.manifest.documents.brief.contentDigest) throw fail();
        }
        if (new Set(semantic.map(file => file.path)).size !== semantic.length) throw fail();
        return { revision: c.revision, files: [...c.files.values()], semantic };
      }) });
      guard(); const value = await use(snapshot); await check();
      for (const c of contexts) {
        for (const s of c.selections) if (hash(await select(s.context)) !== hash(s.value)) throw fail();
        for (const path of c.files.keys()) await grant(c.revision, path);
      }
      await check();
      if (revisionSchema.parse(await Reflect.apply(readerPorts.readHead, reader, [])) !== observedHead) throw fail();
      await check(); return value;
    });
    pending.add(work); void work.finally(() => pending.delete(work)).catch(() => {});
    let abort = () => {};
    try {
      return await Promise.race([work, new Promise<never>((_, reject) => {
        abort = () => reject(fail()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
      })]);
    } catch { throw fail(); }
    finally { finished = true; signal.removeEventListener('abort', abort); }
  }
  return { scope, withReadSet,
    close() { lifetime.abort(); },
    async shutdown() { lifetime.abort(); await Promise.allSettled([...pending]); },
  };
}
