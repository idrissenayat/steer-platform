import { describe, expect, it } from "vitest";
import { kitVersion, learnManifest, learnSources } from "../src/data/learn-corpus";
import { buildLearnCorpus, firstLoginToActionMedian, resolveAgentSlice, resolveLearnLocation, searchLearnCorpus, validateLearnVersion, type HubEvent } from "../src/domain/learn";

const corpus = buildLearnCorpus(learnManifest, learnSources);

describe("Learn STEER canon", () => {
  it("renders every present manifest source and omits an absent document", () => {
    expect(corpus.map((page) => page.id)).toEqual(learnManifest.documents.map((document) => document.id));
    expect(corpus.every((page) => page.raw.length > 100 && page.sections.length > 0)).toBe(true);
    const missing = buildLearnCorpus({ ...learnManifest, documents: [...learnManifest.documents, { id: "missing", kind: "reference", path: "missing.md", sourcePath: "missing.md", summary: "Missing", title: "Missing" }] }, learnSources);
    expect(missing.some((page) => page.id === "missing")).toBe(false);
  });

  it("fails a seeded framework-version mismatch and passes the aligned kit", () => {
    expect(validateLearnVersion(learnManifest, kitVersion)).toEqual({ ok: true, message: "Learn corpus and kit are aligned at v3.0." });
    expect(validateLearnVersion({ ...learnManifest, tag: "v2.9" }, kitVersion)).toMatchObject({ ok: false });
  });

  it("deep-links to current sections and recovers removed anchors visibly", () => {
    expect(resolveLearnLocation(corpus, "framework", "the-three-gates")).toMatchObject({ page: { id: "framework" }, sectionId: "the-three-gates" });
    expect(resolveLearnLocation(corpus, "framework", "removed-section")).toMatchObject({ page: { id: "framework" }, notice: expect.stringContaining("no longer") });
    expect(resolveLearnLocation(corpus, "removed-page")).toBeUndefined();
  });

  it("returns section-scoped full-text results and clear no-hit data", () => {
    const hits = searchLearnCorpus(corpus, "builders exam");
    expect(hits.some((hit) => hit.pageId === "framework" && hit.sectionId === "the-eight-plays")).toBe(true);
    expect(searchLearnCorpus(corpus, "term-that-does-not-exist")).toEqual([]);
  });

  it("resolves every human and agent role slice from the same source bytes", () => {
    for (const role of ["product-lead", "product-designer", "tech-lead", "platform-engineer", "builder"]) {
      const slice = resolveAgentSlice(learnManifest, corpus, role);
      expect(slice.map((page) => page.id)).toEqual(learnManifest.agentSlices[role]);
      expect(slice.every((page) => page.raw === learnSources[page.id])).toBe(true);
    }
    const builder = resolveAgentSlice(learnManifest, corpus, "builder");
    expect(builder.some((page) => page.id === "operating-model")).toBe(false);
    expect(builder.find((page) => page.id === "framework")?.raw.toLowerCase()).toContain("builders can never edit it");
  });

  it("provides five stateless orientation steps for every accountability", () => {
    for (const role of ["product-lead", "product-designer", "tech-lead", "platform-engineer"] as const) {
      const steps = learnManifest.orientationPaths[role]!;
      expect(steps).toHaveLength(5);
      expect(steps.at(-1)?.actionHash).toMatch(/^#/);
    }
  });

  it("keeps hub telemetry coarse and computes first-login-to-action median", () => {
    const events: Array<HubEvent & { subject: string }> = [
      { at: "2026-08-28T10:05:00Z", durationMs: 20_000, page: "framework", section: "the-three-gates", subject: "a", type: "first-action" },
      { at: "2026-08-28T10:09:00Z", durationMs: 30_000, page: "guidebook", section: "overview", subject: "b", type: "first-action" },
    ];
    expect(Object.keys(events[0]).sort()).toEqual(["at", "durationMs", "page", "section", "subject", "type"]);
    expect(firstLoginToActionMedian({ a: "2026-08-28T10:00:00Z", b: "2026-08-28T10:00:00Z" }, events)).toBe(420_000);
  });
});
