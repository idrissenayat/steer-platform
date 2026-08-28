import { describe, expect, it } from "vitest";
import { FixtureChainAdapter } from "../src/adapters/fixture-adapter";
import { demoAsOf, demoChain } from "../src/data/demo-chain";
import { applyGateAction } from "../src/domain/actions";
import { assembleEvidence } from "../src/domain/evidence";
import { buildReadModel } from "../src/domain/read-model";
import { reconcileProjection, replayEvents } from "../src/domain/replay";
import { summarizePilot } from "../src/domain/telemetry";
import type { IdentityContext, ProjectionEvent } from "../src/domain/types";

const techLead: IdentityContext = {
  subject: "oidc|morgan",
  displayName: "Morgan Lee",
  roles: ["tech-lead"],
};

describe("gate actions", () => {
  it("records identity, sequence, and the displayed artifact revision", () => {
    const result = applyGateAction(demoChain, techLead, {
      decisionId: "FD-002-g2-tech-lead",
      displayedRevision: "f24cb90",
      kind: "sign",
      at: demoAsOf,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.signatures.at(-1)).toMatchObject({
      gate: 2,
      revision: "f24cb90",
      role: "tech-lead",
      sequence: 1,
      signer: "Morgan Lee",
      subject: "oidc|morgan",
    });
  });

  it("fails closed when the displayed revision is stale", () => {
    const changed = structuredClone(demoChain);
    changed.find((item) => item.id === "FD-002")!.artifacts.find((artifact) => artifact.kind === "exam")!.revision = "newexam";
    const result = applyGateAction(changed, techLead, {
      decisionId: "FD-002-g2-tech-lead",
      displayedRevision: "f24cb90",
      kind: "sign",
      at: demoAsOf,
    });

    expect(result).toMatchObject({ ok: false, code: "stale-revision", currentRevision: "newexam" });
  });

  it("requires a note and keeps the gate unsigned on send-back", () => {
    const missingNote = applyGateAction(demoChain, techLead, {
      decisionId: "FD-002-g2-tech-lead",
      displayedRevision: "f24cb90",
      kind: "send-back",
      at: demoAsOf,
    });
    expect(missingNote).toMatchObject({ ok: false, code: "note-required" });

    const sentBack = applyGateAction(demoChain, techLead, {
      decisionId: "FD-002-g2-tech-lead",
      displayedRevision: "f24cb90",
      kind: "send-back",
      note: "Add forged webhook vectors.",
      at: demoAsOf,
    });
    expect(sentBack.ok).toBe(true);
    if (!sentBack.ok) return;
    expect(sentBack.item.decisionEvents?.at(-1)).toMatchObject({
      gate: 2,
      note: "Add forged webhook vectors.",
      routeTo: "frame-intent",
    });
    expect(buildReadModel(sentBack.chain, demoAsOf).decisions.some((decision) => decision.id === "FD-002-g2-tech-lead")).toBe(true);
  });

  it("rejects an identity without the required accountability", () => {
    const result = applyGateAction(demoChain, { ...techLead, roles: ["product-lead"] }, {
      decisionId: "FD-002-g2-tech-lead",
      displayedRevision: "f24cb90",
      kind: "sign",
      at: demoAsOf,
    });
    expect(result).toMatchObject({ ok: false, code: "not-authorized" });
  });
});

describe("projection and reconciliation", () => {
  it("repairs a dropped event from the authoritative adapter snapshot", () => {
    const events: ProjectionEvent[] = demoChain.slice(0, 4).map((item, index) => ({
      id: `event-${index}`,
      item,
      occurredAt: demoAsOf,
      sequence: index + 1,
    }));
    const repaired = reconcileProjection(events, demoChain, demoAsOf);
    expect(replayEvents(repaired)).toEqual(demoChain);
    expect(repaired).toHaveLength(events.length + 1);
  });

  it("persists a decision through the adapter event seam", async () => {
    const adapter = new FixtureChainAdapter(demoChain);
    const result = await adapter.recordDecision(techLead, {
      decisionId: "FD-002-g2-tech-lead",
      displayedRevision: "f24cb90",
      kind: "sign",
      at: demoAsOf,
    });
    expect(result.ok).toBe(true);
    const item = (await adapter.snapshot()).find((candidate) => candidate.id === "FD-002")!;
    expect(item.signatures.some((signature) => signature.subject === "oidc|morgan")).toBe(true);
  });
});

describe("evidence and pilot telemetry", () => {
  it("never presents revision-stale evidence as current", () => {
    const item = structuredClone(demoChain.find((candidate) => candidate.id === "FD-003")!);
    item.evidence!.examCases = [{ id: "A1", name: "Keyboard flow", passed: true, revision: "oldrev" }];
    item.evidence!.findings = [];
    item.evidence!.planRevision = "57dcfe5";
    const evidence = assembleEvidence(item);
    expect(evidence.current).toBe(true);
    expect(evidence.cases[0].state).toBe("stale");
    expect(evidence.gateThreeReady).toBe(false);
  });

  it("computes the outcome-contract telemetry without mutable status fields", () => {
    const summary = summarizePilot([
      { type: "decision-ready", decisionId: "D1", at: "2026-08-28T10:00:00Z" },
      { type: "decision-completed", decisionId: "D1", at: "2026-08-28T12:00:00Z", stayedInPlatform: true, humanSeconds: 120 },
      { type: "decision-ready", decisionId: "D2", at: "2026-08-28T10:00:00Z" },
      { type: "decision-completed", decisionId: "D2", at: "2026-08-28T14:00:00Z", stayedInPlatform: false, humanSeconds: 240 },
      { type: "item-shipped", itemId: "I1", at: demoAsOf, humanSeconds: 3600 },
    ]);
    expect(summary).toEqual({ medianGateWaitHours: 3, centralizationPercent: 50, humanHoursPerShippedItem: 1 });
  });
});
