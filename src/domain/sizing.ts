export const sizingPolicy = {
  maxOutcomes: 1,
  maxExams: 1,
  planSprawlFileThreshold: 20,
  planSprawlSystemThreshold: 4,
  forecastPercentile: 0.85,
} as const;

export type ScopeAlarm =
  | "exam-not-writable"
  | "missing-exam"
  | "missing-outcome"
  | "multiple-exams"
  | "multiple-outcomes"
  | "plan-sprawl"
  | "shape-sprawl";

export interface ScopeAssessmentInput {
  outcomeCount: number;
  examCount: number;
  examWritable: boolean;
  coherentShape: boolean;
  touchedFiles?: number;
  touchedSystems?: number;
}

export interface ScopeAssessment {
  alarms: ScopeAlarm[];
  rightSized: boolean;
  status: "right-sized" | "split-at-frame" | "split-at-engineer";
  suggestedSplitLines: string[];
}

const splitLines = ["user path", "domain tag", "interface seam", "legacy on-ramp"];

export function assessScope(input: ScopeAssessmentInput): ScopeAssessment {
  const alarms: ScopeAlarm[] = [];
  if (input.outcomeCount < 1) alarms.push("missing-outcome");
  if (input.outcomeCount > sizingPolicy.maxOutcomes) alarms.push("multiple-outcomes");
  if (input.examCount < 1) alarms.push("missing-exam");
  if (input.examCount > sizingPolicy.maxExams) alarms.push("multiple-exams");
  if (!input.examWritable) alarms.push("exam-not-writable");
  if (!input.coherentShape) alarms.push("shape-sprawl");
  if (
    (input.touchedFiles ?? 0) >= sizingPolicy.planSprawlFileThreshold ||
    (input.touchedSystems ?? 0) >= sizingPolicy.planSprawlSystemThreshold
  ) alarms.push("plan-sprawl");

  const frameAlarm = alarms.some((alarm) => alarm !== "plan-sprawl");
  return {
    alarms,
    rightSized: alarms.length === 0,
    status: frameAlarm ? "split-at-frame" : alarms.includes("plan-sprawl") ? "split-at-engineer" : "right-sized",
    suggestedSplitLines: alarms.length ? splitLines : [],
  };
}

export function nearestRankPercentile(samples: number[], percentile = sizingPolicy.forecastPercentile): number {
  if (!samples.length) throw new Error("At least one cycle-time sample is required.");
  if (percentile <= 0 || percentile > 1) throw new Error("Percentile must be greater than 0 and at most 1.");
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(percentile * ordered.length) - 1];
}

export function agingBandStatus(ageHours: number, expectedMaxHours: number): "within-band" | "huddle" {
  if (ageHours < 0 || expectedMaxHours <= 0) throw new Error("Aging values must be positive.");
  return ageHours > expectedMaxHours ? "huddle" : "within-band";
}

export function forecastInitiativeHours(briefShapeSamples: number[], briefCount: number): number {
  if (!Number.isInteger(briefCount) || briefCount < 1) throw new Error("Brief count must be a positive integer.");
  return nearestRankPercentile(briefShapeSamples) * briefCount;
}
