import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, test } from "node:test";
import {
  consolidateDomainReviews,
  validateDomainReviewRecord,
  verifyTargetArtifacts,
} from "../scripts/domain-review-assurance.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const target = JSON.parse(await readFile(resolve(repositoryRoot, "intent/0001/reviews/domain/review-target.json"), "utf8"));
const policy = JSON.parse(await readFile(resolve(repositoryRoot, "kit/policy/gates.json"), "utf8"));
const digest = "a".repeat(64);

function record(domain, overrides = {}) {
  return {
    version: "steer-domain-review-record/v1",
    domain,
    reviewType: target.reviewType,
    target: {
      organization: target.organization,
      item: target.item,
      revision: target.targetRevision,
      exam: target.exam,
    },
    reviewer: {
      serviceIdentity: `${domain}-review-agent@test`,
      agentType: `${domain}-review-agent`,
      model: "pinned-test-model",
      configurationRevision: "test-config-v1",
      freshContext: true,
      freshContextEvidence: `test-dispatch/${domain}`,
      builderIndependent: true,
    },
    decision: "approved",
    confidence: "high",
    reviewedAt: "2026-09-03T12:00:00.000Z",
    reviewedCases: [`${domain}-case`],
    evidence: [{ path: `evidence/${domain}.json`, sha256: digest }],
    findings: [],
    escalations: [],
    boundaries: {
      doesNotSignGateTwo: true,
      doesNotAuthorizeBuildOrRelease: true,
      doesNotAuthorizeProductionOrSpend: true,
      doesNotAcceptResidualRiskOrWaiveControls: true,
    },
    ...overrides,
  };
}

describe("domain review assurance", () => {
  test("verifies every target artifact at the exact Git revision", async () => {
    await verifyTargetArtifacts(target, repositoryRoot);
  });

  test("accepts a complete independent revision-bound record", () => {
    assert.equal(validateDomainReviewRecord(record("security"), target, policy).decision, "approved");
  });

  test("rejects stale, self-reviewed, and low-confidence records without escalation", () => {
    assert.throws(
      () => validateDomainReviewRecord(record("privacy", { target: { ...record("privacy").target, revision: "0".repeat(40) } }), target, policy),
      /stale or bound to another revision/,
    );
    assert.throws(
      () => validateDomainReviewRecord(record("privacy", { reviewer: { ...record("privacy").reviewer, builderIndependent: false } }), target, policy),
      /independent of the Builder/,
    );
    assert.throws(
      () => validateDomainReviewRecord(record("privacy", { confidence: "low" }), target, policy),
      /escalate low confidence/,
    );
  });

  test("requires deterministic escalation for an unresolved material finding", () => {
    const finding = {
      id: "SEC-001",
      severity: "major",
      status: "open",
      summary: "A required security boundary is absent.",
      evidence: [{ path: "intent/0001/EXAM.md", sha256: target.exam.sha256 }],
      requiredResolution: "Add an explicit negative case.",
    };
    assert.throws(
      () => validateDomainReviewRecord(record("security", { decision: "send-back", findings: [finding] }), target, policy),
      /must escalate every unresolved blocker or major finding/,
    );
  });

  test("consolidates seven green records into a Critic-ready brief", () => {
    const brief = consolidateDomainReviews(target.requiredDomains.map((domain) => record(domain)), target, policy, "2026-09-03T13:00:00.000Z");
    assert.equal(brief.status, "ready-for-fresh-context-critic");
    assert.equal(brief.eligibleForGateTwoCritic, true);
    assert.equal(brief.domainSummaries.length, 7);
    assert.equal(brief.boundaries.doesNotAuthorizeProductionOrSpend, true);
  });

  test("fails closed when a required domain record is missing", () => {
    assert.throws(
      () => consolidateDomainReviews(target.requiredDomains.slice(0, -1).map((domain) => record(domain)), target, policy),
      /Missing domain reviews: irreversible-operations/,
    );
  });
});
