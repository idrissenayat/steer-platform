import type { BriefProjection } from '@steer/tool-registry/brief-contracts';

/** Only source-backed Problem/Outcome excerpts. Never chooses among duplicates. */
export function briefSummarySections(brief: Pick<BriefProjection, 'content' | 'document'>) {
  return (['Problem', 'Proposed outcome'] as const).map(name => {
    const selected = brief.document.sections.filter(section => section.knownAs === name);
    const section = selected[0];
    const unsafe = brief.document.issues.some(issue => issue.code === 'multiple-titles' || issue.code === 'unclosed-fence');
    if (unsafe || selected.length > 1 || (section && (section.bodyStart < section.start || section.end < section.bodyStart ||
      section.end > brief.content.length || brief.content.slice(section.bodyStart, section.end) !== section.markdown))) {
      return { name, state: 'ambiguous' as const, text: '', truncated: false };
    }
    if (!section) return { name, state: 'missing' as const, text: '', truncated: false };
    if (!section.markdown.trim()) return { name, state: 'empty' as const, text: '', truncated: false };
    let end = Math.min(1600, section.markdown.length);
    if (end < section.markdown.length && /[\uD800-\uDBFF]/.test(section.markdown[end - 1]!)) end--;
    return { name, state: 'present' as const, text: section.markdown.slice(0, end), truncated: end < section.markdown.length };
  });
}
