import { describe, expect, it } from "vitest";
import { buildReadModel, gateReady, isGateComplete, requiredRoles } from "../src/domain/read-model";
import type { ArtifactKind, Gate, WorkItemChain } from "../src/domain/types";

const artifactOrder: ArtifactKind[] = ["brief", "spec", "exam", "plan", "diff", "review", "release", "band", "learning"];
const gates = [1, 2, 3] as const;

function generatedItem(prefix: number, signatureMask: number, evidence: "fresh" | "stale" | "red" | "none"): WorkItemChain {
  const artifacts = artifactOrder.slice(0, prefix).map((kind, index) => ({ kind, revision: `${kind}-${index}`, updatedAt: "2026-08-28T10:00:00Z" }));
  const item: WorkItemChain = {
    id: `GEN-${prefix}-${signatureMask}-${evidence}`,
    title: "Generated chain",
    summary: "Generated state",
    outcome: "Projection remains deterministic",
    riskDomains: ["integrations"],
    userFacing: false,
    artifacts,
    signatures: [],
    decisionReadyAt: "2026-08-28T10:00:00Z",
    decisionDueAt: "2026-08-29T10:00:00Z",
  };
  const revisions: Partial<Record<Gate, string>> = {
    1: artifacts.find((artifact) => artifact.kind === "spec")?.revision,
    2: artifacts.find((artifact) => artifact.kind === "exam")?.revision,
    3: artifacts.find((artifact) => artifact.kind === "diff")?.revision,
  };
  for (const gate of gates) {
    if (!(signatureMask & (1 << (gate - 1))) || !revisions[gate]) continue;
    for (const role of requiredRoles(item, gate)) item.signatures.push({ gate, role, revision: revisions[gate]!, signedAt: "2026-08-28T11:00:00Z", signer: role });
  }
  const diff = revisions[3];
  if (diff && evidence !== "none") item.evidence = { revision: evidence === "stale" ? "old" : diff, examPassed: evidence !== "red", criticFindings: evidence === "red" ? 1 : 0, planConformant: evidence !== "red", checkedAt: "2026-08-28T11:00:00Z" };
  return item;
}

describe("generated chain combinations", () => {
  it("surfaces a decision if and only if its gate is ready, unsigned, and revision-bound", () => {
    for (let prefix = 0; prefix <= artifactOrder.length; prefix += 1) {
      for (let mask = 0; mask < 8; mask += 1) {
        for (const evidence of ["fresh", "stale", "red", "none"] as const) {
          const item = generatedItem(prefix, mask, evidence);
          const model = buildReadModel([item], "2026-08-28T12:00:00Z");
          const projected = model.items[0];
          for (const gate of gates) {
            const expected = gateReady(item, gate, projected.gateCompletion) && !isGateComplete(item, gate);
            expect(model.decisions.some((decision) => decision.gate === gate)).toBe(expected);
            expect(model.decisions.filter((decision) => decision.gate === gate).map((decision) => decision.role).sort()).toEqual(expected ? requiredRoles(item, gate).sort() : []);
          }
        }
      }
    }
  });
});
