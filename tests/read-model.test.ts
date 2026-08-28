import { describe, expect, it } from "vitest";
import { demoAsOf, demoChain } from "../src/data/demo-chain";
import { buildReadModel, decisionsForRole, requiredRoles } from "../src/domain/read-model";

describe("artifact-chain read model", () => {
  it("rebuilds deterministically from the same artifact chain", () => {
    const first = buildReadModel(structuredClone(demoChain), demoAsOf);
    const second = buildReadModel(structuredClone(demoChain), demoAsOf);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("surfaces only unsigned roles at a ready gate", () => {
    const model = buildReadModel(demoChain, demoAsOf);
    const foundationDecisions = model.decisions.filter((decision) => decision.itemId === "FD-001");

    expect(foundationDecisions).toHaveLength(1);
    expect(foundationDecisions[0]).toMatchObject({ gate: 1, role: "product-designer" });
  });

  it("adds a specialist seat for default-closed domains", () => {
    const item = demoChain.find((candidate) => candidate.id === "FD-002");
    expect(item).toBeDefined();
    expect(requiredRoles(item!, 2)).toEqual(["tech-lead", "specialist"]);
  });

  it("does not surface Gate 3 when evidence is bound to a stale revision", () => {
    const stale = structuredClone(demoChain);
    const item = stale.find((candidate) => candidate.id === "FD-003")!;
    item.evidence!.revision = "stale00";

    const model = buildReadModel(stale, demoAsOf);
    expect(model.decisions.some((decision) => decision.itemId === "FD-003")).toBe(false);
    expect(model.items.find((candidate) => candidate.id === "FD-003")?.evidenceFresh).toBe(false);
  });

  it("filters the decision inbox by human accountability", () => {
    const model = buildReadModel(demoChain, demoAsOf);
    const techLeadDecisions = decisionsForRole(model, "tech-lead");

    expect(techLeadDecisions.map((decision) => decision.itemId)).toEqual(["FD-003", "FD-002"]);
    expect(techLeadDecisions.every((decision) => decision.role === "tech-lead")).toBe(true);
  });

  it("computes the Flight Board without a mutable status field", () => {
    const model = buildReadModel(demoChain, demoAsOf);
    const stages = Object.fromEntries(model.items.map((item) => [item.id, item.stage]));

    expect(stages).toEqual({
      "FD-001": "frame-intent",
      "FD-002": "frame-exam",
      "FD-003": "evaluate",
      "FD-004": "engineer",
      "FD-005": "sense",
    });
  });

  it("projects historical state-band breaches as huddle signals", () => {
    const model = buildReadModel(demoChain, demoAsOf);
    expect(model.items.find((item) => item.id === "FD-004")?.aging).toEqual({
      ageHours: 10,
      expectedMaxHours: 8,
      state: "huddle",
    });
    expect(model.items.find((item) => item.id === "FD-003")?.aging.state).toBe("within-band");
  });
});
