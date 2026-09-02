import type {
  ArtifactKind,
  ArtifactRef,
  DecisionCard,
  FlightStage,
  Gate,
  ProjectedWorkItem,
  ReadModel,
  RiskDomain,
  Role,
  WorkItemChain,
} from "./types";
import { agingBandStatus } from "./sizing";

const defaultClosedDomains = new Set<RiskDomain>([
  "accessibility",
  "irreversible-operations",
  "legal",
  "money",
  "privacy",
  "reliability",
  "security",
]);

const stageOrder: FlightStage[] = [
  "sense",
  "frame-intent",
  "frame-exam",
  "engineer",
  "evaluate",
  "release",
  "observe",
  "learn",
];

function artifact(item: WorkItemChain, kind: ArtifactKind): ArtifactRef | undefined {
  return item.artifacts.find((candidate) => candidate.kind === kind);
}

export function artifactRevisionForGate(item: WorkItemChain, gate: Gate): string | undefined {
  if (gate === 1) return artifact(item, "spec")?.revision;
  if (gate === 2) return artifact(item, "exam")?.revision;
  return artifact(item, "diff")?.revision;
}

export function requiresSpecialist(item: WorkItemChain): boolean {
  return item.riskDomains.some((domain) => defaultClosedDomains.has(domain));
}

export function requiredRoles(item: WorkItemChain, gate: Gate): Role[] {
  if (gate === 1) return ["product-lead", "product-designer"];
  if (gate === 2) {
    return requiresSpecialist(item) ? ["tech-lead", "specialist"] : ["tech-lead"];
  }

  const gateThreeRoles: Role[] = ["product-lead", "tech-lead"];
  if (item.userFacing) gateThreeRoles.push("product-designer");
  if (requiresSpecialist(item)) gateThreeRoles.push("specialist");
  return gateThreeRoles;
}

export function isGateComplete(item: WorkItemChain, gate: Gate): boolean {
  const revision = artifactRevisionForGate(item, gate);
  if (!revision) return false;

  return requiredRoles(item, gate).every((role) =>
    item.signatures.some(
      (signature) =>
        signature.gate === gate && signature.role === role && signature.revision === revision,
    ),
  );
}

function hasArtifacts(item: WorkItemChain, kinds: ArtifactKind[]): boolean {
  return kinds.every((kind) => Boolean(artifact(item, kind)));
}

export function evidenceIsFresh(item: WorkItemChain): boolean {
  const diff = artifact(item, "diff");
  return Boolean(
    diff &&
      item.evidence &&
      item.evidence.revision === diff.revision &&
      item.evidence.examPassed &&
      item.evidence.planConformant,
  );
}

function deriveStage(item: WorkItemChain, completion: Record<Gate, boolean>): FlightStage {
  if (!hasArtifacts(item, ["brief", "spec"])) return "sense";
  if (!completion[1]) return "frame-intent";
  if (!hasArtifacts(item, ["exam"]) || !completion[2]) return "frame-exam";
  if (!hasArtifacts(item, ["plan", "diff"])) return "engineer";
  if (!hasArtifacts(item, ["review"]) || !completion[3]) return "evaluate";
  if (!hasArtifacts(item, ["release"])) return "release";
  if (!hasArtifacts(item, ["band"])) return "observe";
  return "learn";
}

export function gateReady(item: WorkItemChain, gate: Gate, completion: Record<Gate, boolean>): boolean {
  if (gate === 1) return hasArtifacts(item, ["brief", "spec"]);
  if (gate === 2) return completion[1] && hasArtifacts(item, ["exam"]);
  return (
    completion[2] &&
    hasArtifacts(item, ["plan", "diff", "review"]) &&
    evidenceIsFresh(item)
  );
}

function urgency(dueAt: string, asOf: string): DecisionCard["urgency"] {
  const remainingHours =
    (new Date(dueAt).getTime() - new Date(asOf).getTime()) / (60 * 60 * 1000);
  if (remainingHours < 0) return "overdue";
  if (remainingHours <= 4) return "due-soon";
  return "on-track";
}

function pendingDecisions(
  item: WorkItemChain,
  completion: Record<Gate, boolean>,
  asOf: string,
): DecisionCard[] {
  const readyAt = item.decisionReadyAt ?? asOf;
  const dueAt = item.decisionDueAt ?? asOf;
  const decisions: DecisionCard[] = [];

  for (const gate of [1, 2, 3] as const) {
    const revision = artifactRevisionForGate(item, gate);
    if (!revision || completion[gate] || !gateReady(item, gate, completion)) continue;

    const roles = requiredRoles(item, gate);
    for (const role of roles) {
      const alreadySigned = item.signatures.some(
        (signature) =>
          signature.gate === gate &&
          signature.role === role &&
          signature.revision === revision,
      );
      if (alreadySigned) continue;

      decisions.push({
        id: `${item.id}-g${gate}-${role}`,
        itemId: item.id,
        title: item.title,
        summary: item.summary,
        outcome: item.outcome,
        gate,
        role,
        revision,
        riskDomains: [...item.riskDomains].sort(),
        readyAt,
        dueAt,
        urgency: urgency(dueAt, asOf),
        evidenceState: gate === 3 ? "fresh" : "not-required",
        sequencePosition: roles.indexOf(role) + 1,
        slaBreached: urgency(dueAt, asOf) === "overdue",
      });
    }
  }

  return decisions;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle]!;
  return (ordered[middle - 1]! + ordered[middle]!) / 2;
}

export function buildReadModel(items: WorkItemChain[], asOf: string): ReadModel {
  const projectedItems: ProjectedWorkItem[] = items
    .map((item) => {
      const gateCompletion: Record<Gate, boolean> = {
        1: isGateComplete(item, 1),
        2: isGateComplete(item, 2),
        3: isGateComplete(item, 3),
      };
      const enteredAt = item.stageEnteredAt ?? item.artifacts.at(-1)?.updatedAt ?? asOf;
      const ageHours = Math.max(0, Math.round(((new Date(asOf).getTime() - new Date(enteredAt).getTime()) / (60 * 60 * 1000)) * 10) / 10);
      const expectedMaxHours = item.stageBandHours ?? 24;
      return {
        ...item,
        artifacts: [...item.artifacts],
        signatures: [...item.signatures],
        riskDomains: [...item.riskDomains].sort(),
        gateCompletion,
        evidenceFresh: evidenceIsFresh(item),
        stage: deriveStage(item, gateCompletion),
        aging: { ageHours, expectedMaxHours, state: agingBandStatus(ageHours, expectedMaxHours) },
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  const decisions = projectedItems
    .flatMap((item) => pendingDecisions(item, item.gateCompletion, asOf))
    .sort((left, right) => {
      const urgencyRank = { overdue: 0, "due-soon": 1, "on-track": 2 };
      return urgencyRank[left.urgency] - urgencyRank[right.urgency] || left.id.localeCompare(right.id);
    });

  const evidenceBearingItems = projectedItems.filter((item) => artifact(item, "diff"));
  const freshEvidenceItems = evidenceBearingItems.filter((item) => item.evidenceFresh);
  const waitHours = decisions.map(
    (decision) =>
      (new Date(asOf).getTime() - new Date(decision.readyAt).getTime()) /
      (60 * 60 * 1000),
  );

  return {
    asOf,
    items: projectedItems,
    decisions,
    metrics: {
      readyDecisions: decisions.length,
      inFlightItems: projectedItems.filter((item) => item.stage !== "learn").length,
      evidenceFreshPercent:
        evidenceBearingItems.length === 0
          ? 100
          : Math.round((freshEvidenceItems.length / evidenceBearingItems.length) * 100),
      medianGateWaitHours: Math.max(0, Math.round(median(waitHours) * 10) / 10),
    },
  };
}

export function decisionsForRole(model: ReadModel, role: Role): DecisionCard[] {
  return model.decisions.filter((decision) => decision.role === role);
}

export function flightStageIndex(stage: FlightStage): number {
  return stageOrder.indexOf(stage);
}
