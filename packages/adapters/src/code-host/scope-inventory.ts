import { z } from 'zod';

const sha = z.string().regex(/^[a-f0-9]{40}(?![\s\S])/);
const path = z.string().min(1).max(500).refine(v => !/[\\\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v)
  && v.split('/').every(p => p !== '' && p !== '.' && p !== '..'));
const schema = z.strictObject({ organizationId: z.string().min(1).max(200), repositoryId: z.number().int().positive().safe(),
  revision: sha, treeSha: sha, entries: z.array(z.strictObject({ path, objectSha: sha, mode: z.string(), type: z.string() })).max(10000) });
export type ScopeInventory = z.infer<typeof schema>;
export const scopeRoot = /^(?:intent\/[0-9]{4}|items\/[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*)(?![\s\S])/;

/** Topology and mode checks, not product ownership or lifecycle authority. */
export function verifyScopeInventory(raw: unknown) {
  const inventory = schema.parse(raw), entries = [...inventory.entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const byPath = new Map(entries.map(e => [e.path, e]));
  if (byPath.size !== entries.length) throw new Error('Invalid scope inventory.');
  for (const e of entries) {
    if (!['intent', 'items'].includes(e.path.split('/')[0]!)
      || !((e.type === 'tree' && e.mode === '040000') || (e.type === 'commit' && e.mode === '160000')
        || (e.type === 'blob' && ['100644', '100755', '120000'].includes(e.mode)))) throw new Error('Invalid scope inventory.');
    const parts = e.path.split('/');
    if (parts.length === 1 && e.type !== 'tree') throw new Error('Invalid scope namespace.');
    for (let i = 1; i < parts.length; i++) if (byPath.get(parts.slice(0, i).join('/'))?.type !== 'tree') throw new Error('Missing scope ancestor.');
  }
  const children = entries.filter(e => e.path.split('/').length === 2);
  const roots = children.filter(e => scopeRoot.test(e.path) && e.type === 'tree');
  const unsupportedRootCount = children.filter(e => scopeRoot.test(e.path) ? e.type !== 'tree' : e.type !== 'blob' || !['README.md', '.gitkeep'].includes(e.path.split('/')[1]!)).length;
  return { ...inventory, entries, roots, unsupportedRootCount };
}
