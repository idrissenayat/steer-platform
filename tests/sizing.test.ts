import { describe, expect, it } from "vitest";
import { agingBandStatus, assessScope, forecastInitiativeHours, nearestRankPercentile } from "@steer/domain/sizing";

describe("STEER sizing and scoping", () => {
  it("accepts one outcome, one writable exam, and one coherent shape", () => {
    expect(assessScope({ outcomeCount: 1, examCount: 1, examWritable: true, coherentShape: true, touchedFiles: 8, touchedSystems: 2 })).toEqual({
      alarms: [], rightSized: true, status: "right-sized", suggestedSplitLines: [],
    });
  });

  it("splits ambiguity before Gate 1", () => {
    const result = assessScope({ outcomeCount: 2, examCount: 1, examWritable: false, coherentShape: false });
    expect(result.status).toBe("split-at-frame");
    expect(result.alarms).toEqual(["multiple-outcomes", "exam-not-writable", "shape-sprawl"]);
    expect(result.suggestedSplitLines).toContain("interface seam");
  });

  it("does not treat a missing outcome or exam as right-sized", () => {
    const result = assessScope({ outcomeCount: 0, examCount: 0, examWritable: false, coherentShape: true });
    expect(result.alarms).toEqual(["missing-outcome", "missing-exam", "exam-not-writable"]);
    expect(result.rightSized).toBe(false);
  });

  it("raises the Engineer alarm at either plan-sprawl threshold", () => {
    expect(assessScope({ outcomeCount: 1, examCount: 1, examWritable: true, coherentShape: true, touchedFiles: 20, touchedSystems: 2 }).status).toBe("split-at-engineer");
    expect(assessScope({ outcomeCount: 1, examCount: 1, examWritable: true, coherentShape: true, touchedFiles: 4, touchedSystems: 4 }).alarms).toContain("plan-sprawl");
  });

  it("forecasts with the nearest-rank 85th percentile", () => {
    const samples = [10, 12, 14, 18, 22, 28, 36];
    expect(nearestRankPercentile(samples)).toBe(28);
    expect(forecastInitiativeHours(samples, 3)).toBe(84);
  });

  it("escalates an aging-band breach to a huddle", () => {
    expect(agingBandStatus(24, 24)).toBe("within-band");
    expect(agingBandStatus(25, 24)).toBe("huddle");
  });
});
