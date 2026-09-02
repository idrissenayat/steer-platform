import { describe, expect, it } from "vitest";
import { blankIntentAnswers, buildInterviewDraft, correctionDisposition, pilotSystemContext } from "@steer/domain/intent-interview";

describe("providing intent", () => {
  it("resolves real system names and moves unknown names to Open Questions", () => {
    const draft = buildInterviewDraft({
      ...blankIntentAnswers,
      title: "Earlier shipping cost",
      problem: "International customers abandon checkout.",
      users: "International customers",
      outcome: "Customers see landed cost before payment.",
      successMeasure: "International checkout completion rate",
      systems: "STEER platform, Carrier Oracle",
      constraints: "Thirty-day observation window",
      openQuestions: "Which carriers first?",
    }, pilotSystemContext);

    expect(draft.resolvedSystems).toEqual(["STEER platform"]);
    expect(draft.unresolvedSystems).toEqual(["Carrier Oracle"]);
    expect(draft.openQuestions).toContain("Confirm the real system name for “Carrier Oracle”.");
    expect(draft.resolvedSystems).not.toContain("Carrier Oracle");
  });

  it("surfaces an absent success signal instead of inventing one", () => {
    const draft = buildInterviewDraft({ ...blankIntentAnswers, systems: "GitHub" }, pilotSystemContext);
    expect(draft.successMeasure).toBe("");
    expect(draft.openQuestions).toContain("How will success be measured?");
  });

  it("promotes the same correction only after it appears twice", () => {
    expect(correctionDisposition(["Use GitHub"], "Use GitHub")).toBe("keep-in-session");
    expect(correctionDisposition(["Use GitHub", "Use GitHub"], "Use GitHub")).toBe("promote-to-versioned-context");
  });
});
