export type LearnBlock = { kind: 'paragraph'; text: string } | { kind: 'list'; ordered: boolean; items: string[] } |
  { kind: 'table'; headers: string[]; rows: string[][] };
export type LearnPage = { id: string; title: string; summary: string; path: string; sourcePath: string; raw: string;
  contentDigest: string; sections: { id: string; title: string; blocks: LearnBlock[] }[] };
export type LearnCorpus = { tag: string; frameworkVersion: string; pages: LearnPage[] };

/** Bounded local search. Never sends reading interests to analytics or a provider. */
export function searchLearn(pages: LearnPage[], query: string) {
  const terms = query.slice(0, 200).toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return pages.flatMap(page => page.sections.flatMap(section => {
    const text = section.blocks.flatMap(block => block.kind === 'paragraph' ? [block.text] : block.kind === 'list' ? block.items :
      [block.headers.join(' '), ...block.rows.map(row => row.join(' '))]).join(' ');
    return terms.every(term => `${page.title} ${section.title} ${text}`.toLowerCase().includes(term)) ?
      [{ pageId: page.id, sectionId: section.id, pageTitle: page.title, title: section.title, excerpt: text.slice(0, 180) }] : [];
  })).slice(0, 12);
}
