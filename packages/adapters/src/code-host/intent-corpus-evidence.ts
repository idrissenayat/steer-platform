import { createHash } from 'node:crypto';
import { z } from 'zod';
import { intentEvidenceInputSchema, buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { createCandidateScopeCatalog } from './candidate-scope-catalog.ts';
import { verifyScopeInventory, scopeRoot } from './scope-inventory.ts';
import type { ArtifactSnapshot, CorpusRepositoryReader } from './github.ts';

const shape = intentEvidenceInputSchema.shape;
const scopeSchema = intentEvidenceInputSchema.pick({ organizationId: true, productId: true, repository: true, branch: true });
const configurationSchema = scopeSchema.extend({ retrievalConfigurationRevision: z.string().min(1).max(100) });
const inputSchema = scopeSchema.extend({ scopeInputDigest: shape.scopeInputDigest });
const referenceSchema = scopeSchema.extend({ revision: shape.head });
const selectionContextSchema = referenceSchema.extend({ root: z.string().max(180).regex(scopeRoot), treeSha: shape.head });
const selectionSchema = selectionContextSchema.extend({
  selection: z.enum(['canonical', 'pre-pull-candidate', 'out-of-product', 'inaccessible', 'unresolved']),
  authorityDigest: shape.scopeInputDigest,
});
const sourceSchema = z.strictObject({ organizationId: shape.organizationId, repositoryId: z.number().int().positive().safe(),
  revision: shape.head, path: z.string().max(500), blobSha: shape.head, contentDigest: shape.scopeInputDigest,
  content: z.string().max(131072).refine(v => !/[\uD800-\uDFFF]/u.test(v)) });
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
const blob = (v: string) => createHash('sha1').update(`blob ${Buffer.byteLength(v)}\0`).update(v).digest('hex');
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const unavailable = () => new Error('Current intent corpus could not be verified; this does not establish new intent.');
export type CorpusSelectionContext = z.infer<typeof selectionContextSchema>;
/** Current trusted services must verify repo inventory access, product assignment,
 * per-source read grants and lifecycle selection. Their returned evidence is not
 * verified merely by this schema. These are NOT browser-provided callbacks. */
export interface IntentCorpusAuthority {
  // Revision must cover the current identity and all relevant inventory/source
  // grants. A constant label or configuration string is not authority evidence.
  authorize(scope: Readonly<z.infer<typeof scopeSchema>>): Promise<{ permissionsRevision: string }>;
  select(context: Readonly<CorpusSelectionContext>): Promise<unknown>;
  authorizeSource(reference: Readonly<z.infer<typeof referenceSchema> & { path: string }>): Promise<void>;
}

/** Uninstalled read-only composition. Enumerates both namespaces at one current
 * head, never chooses canonical state from filenames and never calls a model. */
export function createIntentCorpusEvidence(reader: CorpusRepositoryReader, rawConfiguration: unknown, authority: IntentCorpusAuthority) {
  const config = freeze(configurationSchema.parse(rawConfiguration));
  const { retrievalConfigurationRevision: _retrieval, ...scopeFields } = config;
  const scope = freeze(scopeFields), binding = freeze({ ...reader.binding });
  if (!reader.readScopeInventory || !authority.authorize || !authority.select || !authority.authorizeSource
    || reader.binding.organizationId !== config.organizationId || `github:${reader.binding.repositoryId}` !== config.repository || reader.binding.branch !== config.branch) throw unavailable();
  let closed = false, busy = false, cancel: (() => void) | undefined;
  return {
    scope,
    async collect(raw: unknown, revalidate: () => Promise<void>) {
      const input = freeze(inputSchema.parse(raw));
      if (closed || busy || typeof revalidate !== 'function' || Object.keys(scope).some(k => input[k as keyof typeof scope] !== scope[k as keyof typeof scope])) throw unavailable();
      busy = true; let finished = false, drained = false, timer: ReturnType<typeof setTimeout> | undefined, reads = 0;
      const deadline = performance.now() + 30000;
      const catalogs: Array<ReturnType<typeof createCandidateScopeCatalog>> = [];
      const guard = () => { if (closed || finished || performance.now() >= deadline || hash(reader.binding) !== hash(binding)) throw unavailable(); };
      let permissionsRevision: string | null = null;
      const check = async () => {
        guard(); if (await revalidate() !== undefined) throw unavailable(); guard();
        const p = z.strictObject({ permissionsRevision: shape.permissionsRevision }).parse(await authority.authorize(freeze({ ...scope })));
        guard(); if (permissionsRevision !== null && permissionsRevision !== p.permissionsRevision) throw unavailable(); permissionsRevision = p.permissionsRevision;
        if (await revalidate() !== undefined) throw unavailable(); guard();
      };
      const io = async <T>(work: () => Promise<T>) => { await check(); if (++reads > 100) throw unavailable(); const value = await work(); guard(); await check(); return value; };
      const work = Promise.resolve().then(async () => {
        const head = shape.head.parse(await io(() => reader.readHead())), reference = freeze({ ...scope, revision: head });
        const tree = freeze(verifyScopeInventory(await io(() => reader.readScopeInventory(head))));
        if (tree.organizationId !== scope.organizationId || tree.repositoryId !== binding.repositoryId || tree.revision !== head) throw unavailable();
        const entries = new Map(tree.entries.map(e => [e.path, e]));
        const inventory: z.infer<typeof shape.inventory> = [], documents: z.infer<typeof shape.documents> = [];
        const observations: Array<{ context: CorpusSelectionContext; selected: z.infer<typeof selectionSchema> | null }> = [];
        let accessGapCount = 0, unresolvedCount = tree.unsupportedRootCount, excludedCount = 0, sourceGapCount = 0;
        const select = async (context: CorpusSelectionContext) => {
          await check(); let value: unknown;
          try { value = await authority.select(context); } catch { value = null; }
          guard(); await check(); const parsed = selectionSchema.safeParse(value);
          if (!parsed.success || Object.keys(context).some(k => parsed.data[k as keyof CorpusSelectionContext] !== context[k as keyof CorpusSelectionContext])) return null;
          return freeze(parsed.data);
        };
        const readSource = async (path: string, revision: string): Promise<ArtifactSnapshot> => {
          if (revision !== head || !entries.has(path) || reads >= 98) throw unavailable(); await check();
          if (await authority.authorizeSource(freeze({ ...reference, path })) !== undefined) throw unavailable(); guard();
          const file = sourceSchema.parse(await io(() => reader.readArtifact(path, revision))); const entry = entries.get(path)!;
          if (file.organizationId !== scope.organizationId || file.repositoryId !== binding.repositoryId || file.revision !== head || file.path !== path
            || entry.type !== 'blob' || entry.mode !== '100644' || entry.objectSha !== file.blobSha || digest(file.content) !== file.contentDigest
            || blob(file.content) !== file.blobSha || Buffer.byteLength(file.content) > 131072 || !file.content.trim()) throw unavailable();
          if (await authority.authorizeSource(freeze({ ...reference, path })) !== undefined) throw unavailable(); guard(); await check(); return file;
        };
        const include = (file: ArtifactSnapshot, status: 'canonical' | 'candidate' | 'amendment', targetId: string) => {
          if (inventory.length >= 1000 || inventory.some(i => i.path === file.path)) throw unavailable();
          const sourceId = `source:${digest(file.path)}`;
          inventory.push({ sourceId, targetId, path: file.path, status, contentDigest: file.contentDigest, blobOid: file.blobSha });
          if (documents.length < 50) documents.push({ sourceId, content: file.content });
        };
        for (const root of tree.roots) {
          if (observations.length >= 250 || reads >= 98) { unresolvedCount++; continue; }
          const context = freeze({ ...reference, root: root.path, treeSha: root.objectSha }), selected = await select(context);
          observations.push({ context, selected });
          if (!selected || selected.selection === 'unresolved') { unresolvedCount++; continue; }
          if (selected.selection === 'inaccessible') { accessGapCount++; continue; }
          if (selected.selection === 'out-of-product') { excludedCount++; continue; }
          if (root.path.startsWith('intent/')) {
            if (selected.selection !== 'canonical') { unresolvedCount++; continue; }
            for (const name of ['BRIEF', 'SPEC']) try { include(await readSource(`${root.path}/${name}.md`, head), 'canonical', root.path); } catch { sourceGapCount++; }
          } else {
            const itemId = root.path.slice(6);
            const port: CorpusRepositoryReader = { ...reader, readArtifact: readSource,
              readDirectoryInventory: async (path, revision) => {
                if (path !== root.path || revision !== head) throw unavailable(); await check();
                return { organizationId: tree.organizationId, repositoryId: tree.repositoryId, revision: head, treeSha: tree.treeSha, root: path,
                  entries: tree.entries.filter(e => e.path === path || e.path.startsWith(`${path}/`)) };
              } };
            const catalog = createCandidateScopeCatalog(port, { ...scope, itemIds: [itemId] }, async () => check()); catalogs.push(catalog);
            try {
              const collected = await catalog.collect(reference), candidate = collected.groups.filter(g => g.kind === 'candidate');
              if (!collected.coverage.inventoryComplete || !collected.coverage.sourceCoverageComplete) sourceGapCount++;
              if (selected.selection === 'pre-pull-candidate' ? candidate.length !== 1 : candidate.length !== 0) { unresolvedCount++; continue; }
              const chosen = collected.groups.filter(g => g.kind === 'amendment' || g.kind === (selected.selection === 'canonical' ? 'root-scope' : 'candidate'));
              for (const group of chosen) for (const path of group.documentPaths) {
                const file = collected.documents.find(d => d.path === path); if (!file) throw unavailable();
                include(file, group.kind === 'root-scope' ? 'canonical' : group.kind, root.path);
              }
            } catch { sourceGapCount++; }
            finally { catalog.close(); }
          }
        }
        for (const observed of observations) if (hash(await select(observed.context)) !== hash(observed.selected)) throw unavailable();
        // Reauthorize every emitted source after all other asynchronous work.
        for (const file of inventory) { await check(); if (await authority.authorizeSource(freeze({ ...reference, path: file.path })) !== undefined) throw unavailable(); guard(); }
        if (shape.head.parse(await io(() => reader.readHead())) !== head) throw unavailable(); await check();
        const selectionDigest = hash(observations.map(o => o.selected));
        const evidence = intentEvidenceInputSchema.parse({ ...scope, head, scopeInputDigest: input.scopeInputDigest, permissionsRevision,
          retrievalConfigurationRevision: `${config.retrievalConfigurationRevision}:${selectionDigest}`, inventoryComplete: unresolvedCount === 0 && sourceGapCount === 0,
          accessGapCount, inventory, documents });
        const envelope = await buildIntentEvidenceEnvelope(evidence); guard(); await check();
        return freeze({ evidence, envelope, coverage: { scope: 'configured-repository-intent-and-items' as const, enumeratedRootCount: tree.roots.length,
          excludedCount, unresolvedCount, sourceGapCount, accessGapCount, readLimitReached: reads >= 98 },
          authoritativeClearance: false as const, semanticReviewComplete: false as const });
      });
      void work.finally(() => { drained = true; if (finished) busy = false; }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { cancel = () => reject(unavailable()); timer = setTimeout(cancel, 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; cancel = undefined; if (timer) clearTimeout(timer); catalogs.forEach(c => c.close()); if (drained) busy = false; }
    },
    close() { closed = true; cancel?.(); },
  };
}
