export const roles = [
  "product-lead",
  "product-designer",
  "tech-lead",
  "platform-engineer",
  "specialist",
] as const;

export type Role = (typeof roles)[number];
export type Gate = 1 | 2 | 3;
export type RiskDomain =
  | "accessibility"
  | "integrations"
  | "privacy"
  | "security";

export type ArtifactKind =
  | "brief"
  | "spec"
  | "exam"
  | "plan"
  | "diff"
  | "review"
  | "release"
  | "band"
  | "learning";

export type FlightStage =
  | "sense"
  | "frame-intent"
  | "frame-exam"
  | "engineer"
  | "evaluate"
  | "release"
  | "observe"
  | "learn";

export interface ArtifactRef {
  kind: ArtifactKind;
  revision: string;
  updatedAt: string;
}

export interface GateSignature {
  gate: Gate;
  role: Role;
  revision: string;
  signedAt: string;
  signer: string;
}

export interface EvidenceBundle {
  revision: string;
  examPassed: boolean;
  criticFindings: number;
  planConformant: boolean;
  checkedAt: string;
}

export interface WorkItemChain {
  id: string;
  title: string;
  summary: string;
  outcome: string;
  riskDomains: RiskDomain[];
  userFacing: boolean;
  artifacts: ArtifactRef[];
  signatures: GateSignature[];
  evidence?: EvidenceBundle;
  decisionReadyAt?: string;
  decisionDueAt?: string;
}

export interface DecisionCard {
  id: string;
  itemId: string;
  title: string;
  summary: string;
  outcome: string;
  gate: Gate;
  role: Role;
  revision: string;
  riskDomains: RiskDomain[];
  readyAt: string;
  dueAt: string;
  urgency: "on-track" | "due-soon" | "overdue";
  evidenceState: "not-required" | "fresh";
}

export interface ProjectedWorkItem extends WorkItemChain {
  stage: FlightStage;
  gateCompletion: Record<Gate, boolean>;
  evidenceFresh: boolean;
}

export interface ReadModel {
  asOf: string;
  items: ProjectedWorkItem[];
  decisions: DecisionCard[];
  metrics: {
    readyDecisions: number;
    inFlightItems: number;
    evidenceFreshPercent: number;
    medianGateWaitHours: number;
  };
}
