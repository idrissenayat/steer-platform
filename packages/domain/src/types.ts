export const roles = [
  "org-admin",
  "portfolio-lead",
  "product-steward",
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
  | "irreversible-operations"
  | "legal"
  | "money"
  | "privacy"
  | "reliability"
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
  path?: string;
  revision: string;
  updatedAt: string;
  content?: string;
}

export interface GateSignature {
  gate: Gate;
  role: Role;
  revision: string;
  sequence?: number;
  sessionId?: string;
  signedAt: string;
  signer: string;
  subject?: string;
}

export interface ExamCaseResult {
  id: string;
  name: string;
  passed: boolean;
  revision: string;
}

export interface CriticFinding {
  id: string;
  rank: "blocker" | "major" | "minor" | "nit";
  summary: string;
  revision: string;
}

export interface EvidenceBundle {
  revision: string;
  examPassed: boolean;
  criticFindings: number;
  planConformant: boolean;
  checkedAt: string;
  examCases?: ExamCaseResult[];
  findings?: CriticFinding[];
  planRevision?: string;
}

export interface GateDecisionEvent {
  action: "send-back";
  actorRole: Role;
  actorSubject: string;
  at: string;
  gate: Gate;
  note: string;
  revision: string;
  routeTo: FlightStage;
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
  signerPolicy?: {
    criticFreshContext: boolean;
    humanSpecialistEscalation?: boolean;
    profile: "commercial" | "regulated";
  };
  decisionEvents?: GateDecisionEvent[];
  evidence?: EvidenceBundle;
  decisionReadyAt?: string;
  decisionDueAt?: string;
  stageBandHours?: number;
  stageEnteredAt?: string;
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
  sequencePosition: number;
  slaBreached: boolean;
}

export interface ProjectedWorkItem extends WorkItemChain {
  stage: FlightStage;
  gateCompletion: Record<Gate, boolean>;
  evidenceFresh: boolean;
  aging: {
    ageHours: number;
    expectedMaxHours: number;
    state: "within-band" | "huddle";
  };
}

export interface IdentityContext {
  subject: string;
  displayName: string;
  roles: Role[];
  specialties?: RiskDomain[];
}

export interface GateAction {
  decisionId: string;
  displayedRevision: string;
  kind: "sign" | "send-back";
  note?: string;
  sessionId?: string;
  at: string;
}

export interface ProjectionEvent {
  id: string;
  item: WorkItemChain;
  occurredAt: string;
  sequence: number;
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
