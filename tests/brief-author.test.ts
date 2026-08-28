import { describe, expect, it } from "vitest";
import { draftBrief, draftRevision } from "../src/domain/brief-author";

describe("guided brief authoring", () => {
  it("produces every required brief section using only supplied system names", () => {
    const draft = draftBrief({
      title: "Decision clarity",
      problem: "Reviewers leave the workspace to assemble evidence.",
      outcome: "Reviewers decide with evidence in one place.",
      users: ["Tech Leads"],
      systems: ["STEER platform", "Pilot repository"],
      constraints: ["No private status database"],
      openQuestions: ["Which repository adapter ships first?"],
    });
    expect(draft.validation).toEqual({ valid: true, missing: [] });
    expect(draft.markdown).toContain("## Problem");
    expect(draft.markdown).toContain("## Proposed outcome");
    expect(draft.markdown).toContain("STEER platform");
    expect(draft.markdown).toContain("Pilot repository");
    expect(draft.markdown).not.toContain("Jira");
  });

  it("fails validation instead of inventing missing context", () => {
    const draft = draftBrief({
      title: "Incomplete",
      problem: "",
      outcome: "",
      users: [],
      systems: [],
      constraints: [],
      openQuestions: [],
    });
    expect(draft.validation.valid).toBe(false);
    expect(draft.validation.missing).toEqual(["problem", "proposed outcome", "affected users", "affected systems"]);
  });

  it("binds the same draft to the same deterministic revision", () => {
    expect(draftRevision("same artifact")).toBe(draftRevision("same artifact"));
    expect(draftRevision("same artifact")).not.toBe(draftRevision("changed artifact"));
  });
});
