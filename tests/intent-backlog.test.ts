import { describe, expect, it } from "vitest";
import { demoAsOf } from "../src/data/demo-chain";
import { demoIntents, pilotMetrics } from "../src/data/demo-intents";
import { declineIntent, homeNotifications, projectIntentBacklog, pullDisposition, surfacePriority } from "../src/domain/intent-backlog";

describe("intent backlog and three-surface home", () => {
  it("refuses pull at the visible WIP limit", () => {
    expect(pullDisposition(5, 5)).toEqual({ allowed: false, message: "WIP limit reached: 5 of 5 slots are in flight." });
    expect(pullDisposition(4, 5).allowed).toBe(true);
  });

  it("marks measurable-today only when the metric resolves", () => {
    const projected = projectIntentBacklog(demoIntents, demoAsOf, pilotMetrics);
    expect(projected.find((intent) => intent.id === "IN-014")?.measurableToday).toBe(true);
    expect(projected.find((intent) => intent.id === "IN-009")?.measurableToday).toBe(false);
  });

  it("clusters seeded duplicates without grouping unrelated intents", () => {
    const projected = projectIntentBacklog(demoIntents, demoAsOf, pilotMetrics);
    expect(projected.find((intent) => intent.id === "IN-014")?.duplicateCount).toBe(2);
    expect(projected.find((intent) => intent.id === "IN-016")?.duplicateCount).toBe(1);
  });

  it("records expiry without deleting the candidate", () => {
    const projected = projectIntentBacklog(demoIntents, demoAsOf, pilotMetrics);
    expect(projected).toHaveLength(demoIntents.length);
    expect(projected.find((intent) => intent.id === "IN-009")?.status).toBe("expired");
  });

  it("records decline reason as Scout tuning input", () => {
    const result = declineIntent(demoIntents[0], "Does not move the current mission", demoAsOf);
    expect(result.intent.status).toBe("declined");
    expect(result.record).toMatchObject({ reason: "Does not move the current mission", scoutTuningInput: true });
  });

  it("enforces inbox, candidates, ambient flight and emits only breach notifications", () => {
    expect(surfacePriority).toEqual(["decision-inbox", "candidates", "in-motion"]);
    expect(homeNotifications(0, 0)).toEqual([]);
    expect(homeNotifications(1, 1)).toEqual(["decision-sla-breach", "aging-band-breach"]);
  });
});
