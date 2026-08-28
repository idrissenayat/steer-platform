import type { RiskDomain } from "./types";

export type IntentStatus = "candidate" | "declined" | "expired" | "pulled";

export interface IntentCandidate {
  decayDays: number;
  domainTags: RiskDomain[];
  duplicateKey: string;
  id: string;
  artifactRevision?: string;
  lastTouchedAt: string;
  missionOutcome?: string;
  outcome: string;
  problem: string;
  provenance: string;
  originator?: string;
  successMetric?: string;
  title: string;
  status: IntentStatus;
}

export interface ProjectedIntent extends IntentCandidate {
  duplicateCount: number;
  measurableToday: boolean;
}

export interface DeclineRecord {
  declinedAt: string;
  intentId: string;
  reason: string;
  scoutTuningInput: true;
}

export const surfacePriority = ["decision-inbox", "candidates", "in-motion"] as const;

export function metricResolves(metric: string | undefined, availableMetrics: readonly string[]): boolean {
  if (!metric) return false;
  return availableMetrics.some((candidate) => candidate.toLowerCase() === metric.toLowerCase());
}

export function isIntentExpired(intent: IntentCandidate, asOf: string): boolean {
  const ageMs = new Date(asOf).getTime() - new Date(intent.lastTouchedAt).getTime();
  return ageMs > intent.decayDays * 24 * 60 * 60 * 1000;
}

export function projectIntentBacklog(intents: IntentCandidate[], asOf: string, availableMetrics: readonly string[]): ProjectedIntent[] {
  const clusterSizes = new Map<string, number>();
  for (const intent of intents) clusterSizes.set(intent.duplicateKey, (clusterSizes.get(intent.duplicateKey) ?? 0) + 1);

  return intents.map((intent) => ({
    ...intent,
    status: intent.status === "candidate" && isIntentExpired(intent, asOf) ? "expired" : intent.status,
    duplicateCount: clusterSizes.get(intent.duplicateKey) ?? 1,
    measurableToday: metricResolves(intent.successMetric, availableMetrics),
  }));
}

export function pullDisposition(inFlightCount: number, wipLimit: number): { allowed: boolean; message: string } {
  if (inFlightCount >= wipLimit) return { allowed: false, message: `WIP limit reached: ${inFlightCount} of ${wipLimit} slots are in flight.` };
  return { allowed: true, message: `Capacity available: ${inFlightCount} of ${wipLimit} slots are in flight.` };
}

export function declineIntent(intent: IntentCandidate, reason: string, declinedAt: string): { intent: IntentCandidate; record: DeclineRecord } {
  if (!reason.trim()) throw new Error("A decline reason is required.");
  return {
    intent: { ...intent, status: "declined" },
    record: { declinedAt, intentId: intent.id, reason: reason.trim(), scoutTuningInput: true },
  };
}

export function homeNotifications(slaBreaches: number, agingBandBreaches: number): string[] {
  return [
    ...Array.from({ length: slaBreaches }, () => "decision-sla-breach"),
    ...Array.from({ length: agingBandBreaches }, () => "aging-band-breach"),
  ];
}
