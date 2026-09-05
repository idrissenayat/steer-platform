const order = ['Problem', 'Proposed outcome', 'Outcome contract', 'Constraints', 'Sizing and scoping',
  'Domain tags', 'Affected users and systems', 'Open questions'] as const;
type Node = { type: string; depth?: number; value?: string; children?: Node[] };
type Root = Node & { children: Node[] };

const plainHeading = (node: Node) => node.children?.every((child) => child.type === 'text' && typeof child.value === 'string') ?
  node.children.map((child) => child.value).join('').trim() : null;

/** Operates after CommonMark parsing: never splice/reparse Markdown or rewrite source bytes.
 * Original nodes, contents and positions stay intact. Only whole top-level section groups move. */
export function arrangeBriefTree(raw: unknown): { mode: 'review' | 'source'; children: Node[] } {
  const tree = raw as Root;
  if (!tree || tree.type !== 'root' || !Array.isArray(tree.children)) throw new Error('Invalid Brief reading tree.');
  const original = tree.children;
  const fallback = () => ({ mode: 'source' as const, children: [...original] });
  // Reference-definition ordering can affect resolution. Keep the entire original tree
  // when definitions occur anywhere, including nested quotes/lists. Bound this inspection.
  const pending = [...original]; const seen = new Set<Node>();
  while (pending.length) {
    const node = pending.pop()!;
    if (!node || typeof node.type !== 'string' || seen.has(node) || seen.size >= 100000) return fallback();
    seen.add(node);
    if (node.type === 'definition') return fallback();
    if (node.children) {
      if (!Array.isArray(node.children) || node.children.length > 100000 - seen.size) return fallback();
      pending.push(...node.children);
    }
  }
  const first = original.findIndex((node) => node.type === 'heading' && node.depth === 2);
  if (first < 0 || original.filter((node) => node.type === 'heading' && node.depth === 1).length !== 1 ||
      original.slice(first).some((node) => node.type === 'heading' && node.depth === 1)) return fallback();
  const groups: { rank: number; nodes: Node[] }[] = []; const known = new Set<number>();
  for (const node of original.slice(first)) {
    if (node.type === 'heading' && node.depth === 2) {
      const heading = plainHeading(node); if (heading === null) return fallback();
      const name = heading.toLowerCase();
      const rank = order.findIndex((item) => name === item.toLowerCase() || (name.startsWith(`${item.toLowerCase()} (`) && name.endsWith(')')));
      if (rank >= 0 && known.has(rank)) return fallback();
      if (rank >= 0) known.add(rank);
      if (groups.length >= 128) return fallback();
      groups.push({ rank: rank < 0 ? order.length : rank, nodes: [node] });
    } else groups.at(-1)!.nodes.push(node);
  }
  if (!known.size) return fallback();
  // Stable sort preserves unknown sections in their original relative order.
  groups.sort((a, b) => a.rank - b.rank);
  return { mode: 'review', children: [...original.slice(0, first), ...groups.flatMap((group) => group.nodes)] };
}

/** Local presentation-only remark plugin; adds no links, HTML, authority or I/O. */
export function briefReadingOrder() {
  return (tree: unknown) => {
    const result = arrangeBriefTree(tree);
    const note = result.mode === 'review' ? 'STEER reading view: sections arranged for review. Source bytes and revision are unchanged.' :
      'STEER reading view: original section order retained to preserve this document’s structure.';
    (tree as Root).children = [{ type: 'paragraph', data: { hProperties: { className: 'brief-reading-note' } },
      children: [{ type: 'text', value: note }] } as Node, ...result.children];
  };
}
