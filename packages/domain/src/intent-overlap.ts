/** Candidate retrieval, NOT a semantic duplicate decision. No model, I/O or authority. */
export interface IntentOverlap {
  signal: 'matching-text' | 'shared-terms';
  queryTermCoverage: number;
  matchedTerms: string[];
  excerpt: string;
}
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
const common = new Set('a an the i we our my want need to of for and or in on with is are be this that it as by'.split(' '));
function terms(value: string) {
  return [...new Set((normalize(value).match(/[\p{L}\p{N}]+/gu) ?? []).filter(term => term.length > 1 && !common.has(term)))];
}

export function findIntentOverlap(intent: string, content: string): IntentOverlap | null {
  if (typeof intent !== 'string' || typeof content !== 'string' || intent.length > 10000 || content.length > 512 * 1024) throw new Error('Invalid overlap input.');
  const query = normalize(intent); if (!query) return null;
  const queryTerms = terms(intent); const sourceTerms = new Set(terms(content));
  const matchedTerms = queryTerms.filter(term => sourceTerms.has(term));
  const queryTermCoverage = queryTerms.length ? matchedTerms.length / queryTerms.length : 0;
  // Short generic phrases are not strong enough even when the same words appear.
  const matchingText = query.length >= 20 && normalize(content).includes(query);
  if (!matchingText && (matchedTerms.length < 3 || queryTermCoverage < 0.4)) return null;
  const candidates = content.split(/\n\s*\n/u);
  let excerpt = content.slice(0, 500), best = -1;
  for (const paragraph of candidates) {
    const normalized = normalize(paragraph);
    const paragraphTerms = new Set(terms(paragraph));
    const score = matchingText && normalized.includes(query) ? queryTerms.length + 1 : matchedTerms.filter(term => paragraphTerms.has(term)).length;
    if (score > best) {
      best = score;
      const literalAt = paragraph.toLowerCase().indexOf(intent.toLowerCase().trim());
      let at = literalAt;
      if (at < 0) for (const match of paragraph.matchAll(/[\p{L}\p{N}]+/gu)) {
        if (matchedTerms.includes(normalize(match[0]))) { at = match.index; break; }
      }
      const start = Math.max(0, at - 120);
      excerpt = paragraph.slice(start, start + 500);
    }
  }
  return { signal: matchingText ? 'matching-text' : 'shared-terms', queryTermCoverage,
    matchedTerms: matchedTerms.slice(0, 12), excerpt };
}
