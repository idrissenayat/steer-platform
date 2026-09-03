import { describe, expect, it } from "vitest";
import {
  evaluateSignerPolicy,
  assuranceDomains,
  inheritPolicy,
  organizationHats,
  personalCapacityDisposition,
  proposeOrganizationSetup,
  readinessScan,
  tenantScopeAllows,
  transferAccountability,
} from "@steer/domain/organization";

describe("Operating Model v3.2 organization contracts", () => {
  it("proposes a complete solo topology with explicit hats and one tenant-scoped agent", () => {
    const proposal = proposeOrganizationSetup({
      description: "A governed agent delivery platform.",
      humanName: "Idriss Enayat",
      profile: "commercial",
      repositoryMode: "existing",
      teamMode: "solo",
    });
    expect(proposal.artifactPaths).toEqual(["ORG.md", "portfolios/default.md", "products/a-governed-agent-delivery-platform/PRODUCT.md", "pods/primary.md"]);
    expect(proposal.assignments.map((assignment) => assignment.hat)).toEqual(organizationHats.filter((hat) => hat !== "specialist"));
    expect(new Set(proposal.assignments.map((assignment) => assignment.identity))).toEqual(new Set(["Idriss Enayat"]));
    expect(proposal.agentIdentity).toMatchObject({ status: "registered", scope: proposal.ids.organization });
    expect(proposal.domainReviewAgents.map((agent) => agent.domain)).toEqual(assuranceDomains);
    expect(proposal.domainReviewAgents.every((agent) => agent.independentOfBuilder)).toBe(true);
    expect(proposal.signerConstraint).toContain("Human specialists appear only on deterministic escalation");
    expect(proposal.status).toBe("awaiting-human-signature");
  });

  it("states the regulated two-human constraint during onboarding", () => {
    const proposal = proposeOrganizationSetup({ description: "A regulated case system", humanName: "Avery Chen", profile: "regulated", repositoryMode: "greenfield", teamMode: "solo" });
    expect(proposal.signerConstraint).toContain("two distinct humans");
    expect(proposal.signerConstraint).toContain("before release");
  });

  it("turns readiness gaps into on-ramp briefs without mutating a repository", () => {
    const findings = readinessScan("existing");
    expect(findings.map((finding) => finding.check)).toEqual(["tests", "seams", "secrets-hygiene", "ci", "telemetry"]);
    expect(findings.every((finding) => finding.state === "review" && finding.onRampBrief)).toBe(true);
  });

  it("allows inherited policy to strengthen but never weaken default-closed domains", () => {
    const parent = { defaultClosedDomains: ["security", "privacy"] as const, source: "organization" as const, version: "org-1" };
    expect(inheritPolicy({ ...parent, defaultClosedDomains: [...parent.defaultClosedDomains] }, { defaultClosedDomains: ["security", "privacy", "accessibility"], source: "pod" })).toMatchObject({ defaultClosedDomains: ["accessibility", "privacy", "security"], source: "pod" });
    expect(() => inheritPolicy({ ...parent, defaultClosedDomains: [...parent.defaultClosedDomains] }, { defaultClosedDomains: ["security"] })).toThrow(/cannot weaken/i);
  });

  it("rolls WIP up per person across pods and hats", () => {
    const assignments = [
      { inFlight: 2, podId: "pod-a", subject: "human-1" },
      { inFlight: 3, podId: "pod-b", subject: "human-1" },
      { inFlight: 8, podId: "pod-c", subject: "human-2" },
    ];
    expect(personalCapacityDisposition(assignments, "human-1", 5)).toEqual({ allowed: false, inFlight: 5, message: "Personal attention limit reached: 5 of 5 slots are in flight across all pods and hats." });
    expect(personalCapacityDisposition(assignments, "human-1", 6).allowed).toBe(true);
  });

  it("enforces fresh Critic evidence, second look, and regulated signer counts", () => {
    const commercial = evaluateSignerPolicy({
      profile: "commercial",
      defaultClosed: true,
      critic: { freshContext: true, passed: true, unresolvedFindings: 0 },
      gate2Signatures: [{ subject: "solo", sessionId: "session-a" }],
      gate3Signatures: [{ subject: "solo", sessionId: "session-b" }],
    });
    expect(commercial).toEqual({ allowed: true, reasons: [], requiredDistinctHumans: 1 });
    expect(evaluateSignerPolicy({
      profile: "commercial",
      defaultClosed: true,
      critic: { freshContext: true, passed: true, unresolvedFindings: 0 },
      gate2Signatures: [{ subject: "solo", sessionId: "same" }],
      gate3Signatures: [{ subject: "solo", sessionId: "same" }],
    }).reasons).toContain("Gate 3 must be a second look in a session separate from Gate 2.");
    expect(evaluateSignerPolicy({
      profile: "regulated",
      defaultClosed: true,
      critic: { freshContext: true, passed: true, unresolvedFindings: 0 },
      gate2Signatures: [],
      gate3Signatures: [{ subject: "solo", sessionId: "one" }],
    })).toMatchObject({ allowed: false, requiredDistinctHumans: 2 });
  });

  it("records handover without re-attributing history and closes tenant boundaries", () => {
    expect(transferAccountability("tech-lead", "human-1", "human-2", "2026-09-02T12:00:00Z")).toMatchObject({ openGateAssignee: "human-2", pastSignaturesRemainAttributed: true, type: "accountability-transferred" });
    expect(tenantScopeAllows("org-a", "org-a")).toBe(true);
    expect(tenantScopeAllows("org-a", "org-b")).toBe(false);
  });
});
