import { describe, expect, it } from "vitest";
import { demoAsOf } from "../src/data/demo-chain";
import { demoIntents, pilotMetrics } from "../src/data/demo-intents";
import { performDetailAction, orderedDetailSections, previewMergedIntent, recordExternalExit, summarizeDetailOutcome, type DetailActionEvent } from "@steer/domain/intent-detail";
import { declineIntent, projectIntentBacklog } from "@steer/domain/intent-backlog";

const projected = projectIntentBacklog(demoIntents, demoAsOf, pilotMetrics);
const fullIntent = projected.find((intent) => intent.id === "IN-014")!;
const clusterMember = projected.find((intent) => intent.id === "IN-015")!;
const revision = fullIntent.artifactRevision!;

function run(action: "pull" | "decline" | "merge" | "send-back", overrides: Partial<Parameters<typeof performDetailAction>[0]> = {}) {
  return performDetailAction({
    action,
    at: demoAsOf,
    currentRevision: revision,
    displayedRevision: revision,
    durationMs: 1200,
    inFlightCount: 4,
    intent: fullIntent,
    sessionId: "session-1",
    wipLimit: 5,
    ...overrides,
  });
}

describe("intent detail contract", () => {
  it("keeps the complete reading order and omits absent optional sections", () => {
    expect(orderedDetailSections(fullIntent)).toEqual(["problem", "outcome", "outcome-contract", "constraints", "domains", "affected-users-systems", "open-questions", "provenance", "cluster-members", "revision-history"]);
    const minimal = { ...projected.find((intent) => intent.id === "IN-009")!, revisionHistory: undefined };
    expect(orderedDetailSections(minimal)).toEqual(["problem", "outcome", "outcome-contract", "domains", "provenance"]);
    expect(fullIntent.openQuestions).toHaveLength(5);
  });

  it("models each provenance evidence variant and newest-first revision history", () => {
    expect(projected.map((intent) => intent.provenanceEvidence?.kind)).toEqual(["named-originator", "band-breach", "ticket-cluster", "named-originator", "named-originator"]);
    expect(clusterMember.provenanceEvidence?.kind === "ticket-cluster" ? clusterMember.provenanceEvidence.excerpts : []).toHaveLength(3);
    expect(fullIntent.revisionHistory?.map((entry) => entry.revision)).toEqual(["9d71a6c", "5e22bf1", "2a1f830", "f7b98e0"]);
  });

  it("refuses pull at the WIP limit and permits it below the limit", () => {
    expect(run("pull", { inFlightCount: 5 })).toMatchObject({ ok: false, reason: "wip" });
    expect(run("pull")).toMatchObject({ ok: true, event: { action: "pull", surface: "detail_view", intentId: "IN-014", revision } });
  });

  it("requires and retains decline reasoning with a seven-day cluster cooldown", () => {
    expect(run("decline")).toMatchObject({ ok: false, reason: "validation" });
    expect(run("decline", { reason: "Insufficient evidence" })).toMatchObject({ ok: true, event: { reason: "Insufficient evidence" } });
    const declined = declineIntent(fullIntent, "Insufficient evidence", demoAsOf);
    expect(declined.intent.status).toBe("declined");
    expect(declined.intent.clusterCooldownUntil).toBe("2026-09-04T19:00:00.000Z");
  });

  it("previews a merge without mutation and records confirmed members", () => {
    const snapshot = structuredClone(fullIntent);
    expect(previewMergedIntent(fullIntent, [clusterMember])).toMatchObject({ memberIds: ["IN-015"], title: fullIntent.title, outcome: fullIntent.outcome });
    expect(fullIntent).toEqual(snapshot);
    expect(run("merge")).toMatchObject({ ok: false, reason: "validation" });
    expect(run("merge", { members: ["IN-015"] })).toMatchObject({ ok: true, event: { members: ["IN-015"] } });
  });

  it("records exactly one question while retaining the candidate contract", () => {
    expect(run("send-back")).toMatchObject({ ok: false, reason: "validation" });
    expect(run("send-back", { question: "Who owns this metric?" })).toMatchObject({ ok: true, event: { question: "Who owns this metric?" } });
    expect(fullIntent.status).toBe("candidate");
  });

  it("voids stale actions and reports the current revision", () => {
    expect(run("pull", { currentRevision: "new-revision" })).toEqual({ currentRevision: "new-revision", message: "This intent changed while it was open. The action was not applied and the current version is now shown.", ok: false, reason: "stale" });
  });

  it("deduplicates external exits and computes the outcome contract", () => {
    const exitInput = { at: demoAsOf, durationMs: 300, intentId: fullIntent.id, revision, sessionId: "session-1" };
    const once = recordExternalExit([], exitInput);
    expect(recordExternalExit(once, exitInput)).toHaveLength(1);
    const events: DetailActionEvent[] = [
      { action: "pull", at: demoAsOf, durationMs: 1000, intentId: "A", revision: "1", sessionId: "a", surface: "detail_view" },
      { action: "decline", at: demoAsOf, durationMs: 3000, intentId: "B", revision: "1", sessionId: "b", surface: "detail_view" },
      { action: "merge", at: demoAsOf, durationMs: 9000, intentId: "C", revision: "1", sessionId: "c", surface: "summary_card" },
      ...once,
    ];
    expect(summarizeDetailOutcome(events)).toEqual({ detailViewShare: 2 / 3, medianDurationMs: 2000 });
  });
});
