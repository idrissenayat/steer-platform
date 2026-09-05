import type { Role } from "./types.ts";

export interface LearnDocumentMeta {
  id: string;
  kind: string;
  path: string;
  sourcePath: string;
  summary: string;
  title: string;
}

export interface OrientationStep {
  actionHash?: string;
  label: string;
  pageId?: string;
  section?: string;
}

export interface LearnManifest {
  agentSlices: Record<string, string[]>;
  documents: LearnDocumentMeta[];
  frameworkVersion: string;
  orientationPaths: Partial<Record<Role, OrientationStep[]>>;
  tag: string;
}

export type LearnBlock =
  | { kind: "paragraph"; text: string }
  | { items: string[]; kind: "list"; ordered: boolean }
  | { headers: string[]; kind: "table"; rows: string[][] };

export interface LearnSection {
  blocks: LearnBlock[];
  id: string;
  title: string;
}

export interface LearnPage extends LearnDocumentMeta {
  raw: string;
  sections: LearnSection[];
}

export interface LearnSearchHit {
  excerpt: string;
  pageId: string;
  pageTitle: string;
  sectionId: string;
  sectionTitle: string;
}

export interface HubEvent {
  at: string;
  durationMs: number;
  page: string;
  section: string;
  type: "page-open" | "search-open" | "first-action";
}

export function slugifyLearn(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stripInlineMarkdown(value: string): string {
  return value.replace(/^_([^]+)_$/, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
}

export function parseLearnPage(meta: LearnDocumentMeta, raw: string): LearnPage {
  const lines = raw.replace(/\r/g, "").split("\n");
  const titleLine = lines.find((line) => line.startsWith("# "));
  const sections: LearnSection[] = [];
  let current: LearnSection = { blocks: [], id: "overview", title: "Overview" };
  let paragraph: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    current.blocks.push({ kind: "paragraph", text: stripInlineMarkdown(paragraph.join(" ").trim()) });
    paragraph = [];
  }
  function flushSection() {
    flushParagraph();
    if (current.blocks.length) sections.push(current);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      flushSection();
      const title = stripInlineMarkdown(line.slice(3));
      current = { blocks: [], id: slugifyLearn(title), title };
      continue;
    }
    if (!line) { flushParagraph(); continue; }
    if (line.startsWith("| ") && lines[index + 1]?.trim().match(/^\|(?:\s*:?-+:?\s*\|)+$/)) {
      flushParagraph();
      const headers = line.slice(1, -1).split("|").map((cell) => stripInlineMarkdown(cell.trim()));
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index]!.trim().startsWith("| ")) {
        rows.push(lines[index]!.trim().slice(1, -1).split("|").map((cell) => stripInlineMarkdown(cell.trim())));
        index += 1;
      }
      index -= 1;
      current.blocks.push({ headers, kind: "table", rows });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && lines[index]!.trim().startsWith("- ")) {
        items.push(stripInlineMarkdown(lines[index]!.trim().slice(2)));
        index += 1;
      }
      index -= 1;
      current.blocks.push({ items, kind: "list", ordered: false });
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index]!.trim())) {
        items.push(stripInlineMarkdown(lines[index]!.trim().replace(/^\d+\.\s/, "")));
        index += 1;
      }
      index -= 1;
      current.blocks.push({ items, kind: "list", ordered: true });
      continue;
    }
    paragraph.push(line);
  }
  flushSection();
  return { ...meta, raw, sections, title: titleLine ? stripInlineMarkdown(titleLine.slice(2)) : meta.title };
}

export function buildLearnCorpus(manifest: LearnManifest, sources: Record<string, string>): LearnPage[] {
  return manifest.documents.flatMap((meta) => {
    const source = sources[meta.id];
    return source ? [parseLearnPage(meta, source)] : [];
  });
}

export function validateLearnVersion(manifest: LearnManifest, version: { frameworkVersion: string; tag: string }): { ok: boolean; message: string } {
  if (manifest.frameworkVersion !== version.frameworkVersion || manifest.tag !== version.tag) {
    return { ok: false, message: `Learn corpus ${manifest.tag} does not match kit ${version.tag}.` };
  }
  return { ok: true, message: `Learn corpus and kit are aligned at ${version.tag}.` };
}

export function resolveAgentSlice(manifest: LearnManifest, corpus: LearnPage[], role: string): LearnPage[] {
  const ids = manifest.agentSlices[role] ?? [];
  return ids.flatMap((id) => {
    const page = corpus.find((candidate) => candidate.id === id);
    return page ? [page] : [];
  });
}

export function searchLearnCorpus(corpus: LearnPage[], query: string): LearnSearchHit[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: LearnSearchHit[] = [];
  for (const page of corpus) {
    for (const section of page.sections) {
      const text = section.blocks.flatMap((block) => block.kind === "paragraph" ? [block.text] : block.kind === "list" ? block.items : [block.headers.join(" "), ...block.rows.map((row) => row.join(" "))]).join(" ");
      const haystack = `${page.title} ${section.title} ${text}`.toLowerCase();
      if (terms.every((term) => haystack.includes(term))) hits.push({ excerpt: text.slice(0, 180), pageId: page.id, pageTitle: page.title, sectionId: section.id, sectionTitle: section.title });
    }
  }
  return hits.slice(0, 12);
}

export function resolveLearnLocation(corpus: LearnPage[], pageId: string, sectionId?: string): { notice?: string; page: LearnPage; sectionId: string } | undefined {
  const page = corpus.find((candidate) => candidate.id === pageId);
  if (!page) return undefined;
  if (!sectionId) return { page, sectionId: page.sections[0]?.id ?? "overview" };
  const exists = page.sections.some((section) => section.id === sectionId);
  return exists ? { page, sectionId } : { notice: "That section is no longer in the current canon. Showing the page from the top.", page, sectionId: page.sections[0]?.id ?? "overview" };
}

export function firstLoginToActionMedian(firstLogins: Record<string, string>, events: Array<HubEvent & { subject: string }>): number {
  const durations = events.filter((event) => event.type === "first-action" && firstLogins[event.subject]).map((event) => new Date(event.at).getTime() - new Date(firstLogins[event.subject]!).getTime()).filter((duration) => duration >= 0).sort((a, b) => a - b);
  if (!durations.length) return 0;
  const midpoint = Math.floor(durations.length / 2);
  return durations.length % 2 ? durations[midpoint]! : (durations[midpoint - 1]! + durations[midpoint]!) / 2;
}
