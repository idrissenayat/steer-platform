/** A bounded structural view of kit-style Markdown, never a signing/authority parser. */
export const briefSectionNames = ['Problem', 'Proposed outcome', 'Outcome contract', 'Affected users and systems',
  'Constraints', 'Sizing and scoping', 'Domain tags', 'Open questions'] as const;
export type BriefSectionName = typeof briefSectionNames[number];
export interface BriefDocumentSection {
  heading: string;
  knownAs: BriefSectionName | null;
  /** Offsets index the exact input string; end is exclusive. Lines are one-based. */
  start: number; bodyStart: number; end: number; line: number;
  markdown: string;
}
export interface BriefDocumentIssue {
  code: 'missing-title' | 'multiple-titles' | 'missing-section' | 'duplicate-section' | 'empty-section' | 'unclosed-fence';
  section?: BriefSectionName; line?: number;
}
export interface BriefDocument {
  format: 'steer-brief/read-v1';
  title: string | null;
  preamble: string;
  sections: BriefDocumentSection[];
  issues: BriefDocumentIssue[];
}

/** Recognizes only top-level ATX kit headings, outside fenced/indented code.
 * Unknown and duplicate sections remain in source order; no inference of metadata,
 * identity, workflow state, domain policy, metrics, provenance or approval is made. */
export function readBriefDocument(source: string): BriefDocument {
  if (typeof source !== 'string' || source.length > 512 * 1024 || new TextEncoder().encode(source).byteLength > 512 * 1024 ||
      source.includes('\0') || source.replace(/\r\n/g, '').includes('\r')) throw new Error('Brief source is invalid or exceeds the reading bound.');
  const issues: BriefDocumentIssue[] = [];
  const sections: BriefDocumentSection[] = [];
  const titles: string[] = [];
  let fence: { character: string; length: number; line: number } | null = null;
  let offset = 0; let lineNumber = 0;
  // Retain CRLF/LF bytes and offsets instead of normalizing then reconstructing content.
  for (const match of source.matchAll(/[^\n]*(?:\n|$)/g)) {
    const raw = match[0]; if (!raw.length) continue;
    const line = raw.replace(/\r?\n$/, ''); lineNumber++;
    if (lineNumber > 16384) throw new Error('Brief exceeds the structural reading bound.');
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1]![0] === fence.character && close[1]!.length >= fence.length) fence = null;
      offset += raw.length; continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open && (open[1]![0] !== '`' || !open[2]!.includes('`'))) {
      fence = { character: open[1]![0]!, length: open[1]!.length, line: lineNumber };
      offset += raw.length; continue;
    }
    const heading = /^ {0,3}(#{1,2})(?:[ \t]+(.*?)|[ \t]*)$/.exec(line);
    if (heading) {
      if ((heading[2]?.length ?? 0) > 512) throw new Error('Brief heading exceeds the reading bound.');
      const text = (heading[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim();
      if (heading[1] === '#') {
        const title = /^Brief:[ \t]*(.+)$/i.exec(text)?.[1]?.trim();
        if (title) titles.push(title);
      } else {
        const canonical = text.toLowerCase();
        const knownAs = briefSectionNames.find((name) => canonical === name.toLowerCase() ||
          (canonical.startsWith(`${name.toLowerCase()} (`) && canonical.endsWith(')'))) ?? null;
        if (sections.length >= 128) throw new Error('Brief has too many sections.');
        if (sections.length) sections.at(-1)!.end = offset;
        sections.push({ heading: text, knownAs, start: offset, bodyStart: offset + raw.length, end: source.length, line: lineNumber, markdown: '' });
      }
    }
    offset += raw.length;
  }
  if (titles.length === 0) issues.push({ code: 'missing-title' });
  if (titles.length > 1) issues.push({ code: 'multiple-titles' });
  if (fence) issues.push({ code: 'unclosed-fence', line: fence.line });
  for (const section of sections) section.markdown = source.slice(section.bodyStart, section.end);
  for (const name of briefSectionNames) {
    const matches = sections.filter((section) => section.knownAs === name);
    if (!matches.length) issues.push({ code: 'missing-section', section: name });
    for (const [index, section] of matches.entries()) {
      if (index > 0) issues.push({ code: 'duplicate-section', section: name, line: section.line });
      if (!section.markdown.trim()) issues.push({ code: 'empty-section', section: name, line: section.line });
    }
  }
  return { format: 'steer-brief/read-v1', title: titles.length === 1 ? titles[0]! : null,
    preamble: source.slice(0, sections[0]?.start ?? source.length), sections, issues };
}
