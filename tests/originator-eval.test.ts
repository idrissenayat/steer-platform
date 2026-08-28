import { describe, expect, it } from "vitest";
import { draftBrief } from "../src/domain/brief-author";

const prompts = [
  ["Slow policy review", "Policy reviewers manually assemble change evidence", "Review evidence is available beside the decision", "Policy reviewers", "Policy repository"],
  ["Canary ambiguity", "Release owners cannot see the active canary threshold", "Release owners see threshold and rollback evidence", "Release owners", "Release telemetry"],
  ["Design drift", "Design intent is separated from the shipped result", "Designers review intent and experience together", "Product Designers", "Design system"],
  ["Accessibility queue", "Accessibility review blocks without visible ownership", "The specialist seat and SLA are visible", "Accessibility specialists", "Review queue"],
  ["Exam coverage", "Builders cannot see which requirements lack checks", "Coverage gaps appear before evaluation", "Tech Leads", "CI checks"],
  ["Brief intake", "Originators avoid the process because authoring is technical", "Originators create a valid brief conversationally", "Originators", "Intent home"],
  ["Revision race", "A decision can outlive the artifact displayed to the signer", "Stale actions are rejected", "Gate signers", "Code host"],
  ["Portfolio noise", "Leaders receive item activity instead of outcome movement", "Leaders see outcomes and guardrails", "Portfolio leaders", "Mission briefs"],
  ["Review findings", "Critic findings are not ranked consistently", "Blockers and nits are visibly separated", "Reviewers", "Critic output"],
  ["Dropped event", "A dropped event leaves a stale board", "Reconciliation heals the projection", "Platform Engineers", "Webhook service"],
  ["Learning loss", "Incident learning does not become a permanent check", "Every escape creates a versioned eval", "Reliability specialists", "Guardrail library"],
  ["Gate delay", "Decision wait time has no baseline", "The pilot records gate-ready and signed time", "Product Leads", "Telemetry store"],
  ["Human effort", "Automation hides rising review toil", "Human hours per item remain visible", "Pod members", "Pilot metrics"],
  ["Secret logging", "Connector diagnostics may contain credentials", "Sensitive values are scrubbed", "Platform Engineers", "Application logs"],
  ["Assistant retention", "Originator descriptions may outlive the session", "Only the committed artifact is retained", "Originators", "Model adapter"],
  ["Host lock-in", "Provider objects leak into core logic", "The adapter contract remains vendor-neutral", "Maintainers", "Adapter seam"],
  ["Specialist routing", "Privacy work can advance without privacy review", "Tagged work activates the correct specialist", "Privacy specialists", "Gate policy"],
  ["Notification fatigue", "Every event competes for attention", "Only SLA risk creates a push", "All signers", "Notification service"],
  ["Rollback proof", "A release decision lacks rollback readiness", "Rollback evidence is present at Gate 3", "Release owners", "Release record"],
  ["Trust reset", "Model changes inherit an unrelated trust record", "A model change resets the relevant record", "Platform Engineers", "Fleet policy"],
] as const;

describe("20-prompt originator eval", () => {
  it("keeps all required sections and never invents a system name", () => {
    for (const [title, problem, outcome, users, system] of prompts) {
      const draft = draftBrief({ title, problem, outcome, users: [users], systems: [system], constraints: ["Preserve the artifact chain"], openQuestions: ["Who owns the first review?"] });
      expect(draft.validation.valid).toBe(true);
      expect(draft.markdown).toContain(system);
      const systemsBlock = draft.markdown.split("### Systems\n")[1].split("\n\n## Constraints")[0];
      expect(systemsBlock.trim()).toBe(`- ${system}`);
    }
    expect(prompts).toHaveLength(20);
  });
});
