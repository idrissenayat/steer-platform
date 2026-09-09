import { createHash } from 'node:crypto';
import { verifyScopeInventory } from './scope-inventory.ts';

/** Conservative physical equality, not lifecycle or semantic equivalence.
 * Only protocol-owned candidates/ and proposals/ are excluded; all other item
 * entries, including gates, root Spec/Exam and hidden files, must match exactly.
 * No body text is returned. Callers must authorize both inventories and sources. */
export function describeAmendmentTargetSurface(verified: ReturnType<typeof verifyScopeInventory>, itemId: string) {
  const { roots: _roots, unsupportedRootCount: _unsupported, ...snapshot } = verified;
  const inventory = verifyScopeInventory(snapshot), root = `items/${itemId}`;
  const entry = inventory.entries.find(e => e.path === root);
  if (entry?.type !== 'tree' || entry.mode !== '040000') throw new Error('Target surface unavailable.');
  const selected = inventory.entries.filter(e => e.path.startsWith(`${root}/`));
  for (const name of ['candidates', 'proposals']) {
    const reserved = selected.find(e => e.path === `${root}/${name}`);
    if (reserved && (reserved.type !== 'tree' || reserved.mode !== '040000')) throw new Error('Target surface unavailable.');
  }
  const entries = selected.filter(e => !['candidates', 'proposals'].some(name => e.path === `${root}/${name}` || e.path.startsWith(`${root}/${name}/`)))
    .map(e => ({ path: e.path.slice(root.length + 1), type: e.type, mode: e.mode, objectSha: e.objectSha }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (entries.length > 128 || !entries.some(e => e.path === 'BRIEF.md' && e.type === 'blob' && e.mode === '100644')
    || entries.some(e => !(e.type === 'tree' && e.mode === '040000') && !(e.type === 'blob' && e.mode === '100644'))) throw new Error('Target surface unavailable.');
  return { rootTreeSha: entry.objectSha, digest: createHash('sha256').update(JSON.stringify(['steer-amendment-target-surface/v1', entries])).digest('hex'),
    paths: entries.filter(e => e.type === 'blob').map(e => `${root}/${e.path}`) };
}
