import type { RiskDomain, Role } from "./types";

export type OperatingProfile = "commercial" | "regulated";
export type TeamMode = "solo" | "team";
export type RepositoryMode = "existing" | "greenfield";

export const organizationHats = [
  "org-admin",
  "portfolio-lead",
  "product-steward",
  "product-lead",
  "product-designer",
  "tech-lead",
  "platform-engineer",
  "specialist",
] as const satisfies readonly Role[];

export interface OnboardingAnswers {
  description: string;
  humanName: string;
  organizationName?: string;
  profile: OperatingProfile;
  repositoryMode: RepositoryMode;
  teamMode: TeamMode;
}

export interface ReadinessFinding {
  check: "ci" | "seams" | "secrets-hygiene" | "telemetry" | "tests";
  onRampBrief?: string;
  state: "pass" | "review";
}

export interface OrganizationProposal {
  agentIdentity: { id: string; scope: string; status: "registered" };
  artifactPaths: string[];
  assignments: Array<{ hat: Role; identity: string }>;
  description: string;
  ids: { organization: string; pod: string; portfolio: string; product: string };
  profile: OperatingProfile;
  readiness: ReadinessFinding[];
  signerConstraint: string;
  stackPack: "typescript-react-web";
  status: "awaiting-human-signature";
  summary: string;
}

export interface InheritedPolicy {
  defaultClosedDomains: RiskDomain[];
  source: "organization" | "product" | "pod";
  version: string;
}

export interface CapacityAssignment {
  inFlight: number;
  podId: string;
  subject: string;
}

export interface AccountabilityTransferEvent {
  at: string;
  fromSubject: string;
  hat: Role;
  openGateAssignee: string;
  pastSignaturesRemainAttributed: true;
  toSubject: string;
  type: "accountability-transferred";
}

export interface SignerPolicyInput {
  critic: { freshContext: boolean; passed: boolean; unresolvedFindings: number };
  defaultClosed: boolean;
  gate2Signatures: Array<{ sessionId: string; subject: string }>;
  gate3Signatures: Array<{ sessionId: string; subject: string }>;
  profile: OperatingProfile;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "new-product";
}

export function readinessScan(mode: RepositoryMode): ReadinessFinding[] {
  if (mode === "greenfield") {
    return [
      { check: "tests", state: "review", onRampBrief: "Install the Stack Pack test harness." },
      { check: "seams", state: "review", onRampBrief: "Declare the first interface seam." },
      { check: "secrets-hygiene", state: "pass" },
      { check: "ci", state: "review", onRampBrief: "Activate the exam-protection workflow." },
      { check: "telemetry", state: "review", onRampBrief: "Instrument the first leading indicator." },
    ];
  }
  return [
    { check: "tests", state: "review", onRampBrief: "Characterize existing behavior before changing it." },
    { check: "seams", state: "review", onRampBrief: "Name the existing system boundaries." },
    { check: "secrets-hygiene", state: "review", onRampBrief: "Run the repository secrets-hygiene exam." },
    { check: "ci", state: "review", onRampBrief: "Bind current CI to the STEER gauntlet." },
    { check: "telemetry", state: "review", onRampBrief: "Connect outcome and release telemetry." },
  ];
}

export function proposeOrganizationSetup(answers: OnboardingAnswers): OrganizationProposal {
  const description = answers.description.trim();
  if (!description) throw new Error("Tell the platform agent what you are building first.");
  const product = slug(description.split(/[.!?]/)[0] ?? description);
  const organization = slug(answers.organizationName ?? `${answers.humanName} organization`);
  const humanHats = answers.teamMode === "solo"
    ? organizationHats
    : organizationHats.filter((hat) => hat !== "product-steward" && hat !== "specialist");
  const readiness = readinessScan(answers.repositoryMode);
  const signerConstraint = answers.profile === "regulated"
    ? "Default-closed work requires two distinct humans. A solo operator must add a second signer before release."
    : "Default-closed work requires a fresh-context Critic with zero unresolved findings and a Gate 3 second look in a separate session.";
  return {
    agentIdentity: { id: `agent:${organization}:platform`, scope: organization, status: "registered" },
    artifactPaths: ["ORG.md", "portfolios/default.md", `products/${product}/PRODUCT.md`, "pods/primary.md"],
    assignments: humanHats.map((hat) => ({ hat, identity: answers.humanName })),
    description,
    ids: { organization, portfolio: "default", product, pod: "primary" },
    profile: answers.profile,
    readiness,
    signerConstraint,
    stackPack: "typescript-react-web",
    status: "awaiting-human-signature",
    summary: `Create ${organization} with one portfolio, product ${product}, and a primary pod; register the platform agent; apply the ${answers.profile} trust profile; and draft ${readiness.filter((finding) => finding.onRampBrief).length} on-ramp briefs.`,
  };
}

export function inheritPolicy(parent: InheritedPolicy, child: Partial<InheritedPolicy>): InheritedPolicy {
  const requested = child.defaultClosedDomains ?? parent.defaultClosedDomains;
  const weakened = parent.defaultClosedDomains.filter((domain) => !requested.includes(domain));
  if (weakened.length) throw new Error(`A lower level cannot weaken default-closed domains: ${weakened.join(", ")}.`);
  return {
    defaultClosedDomains: [...new Set(requested)].sort(),
    source: child.source ?? parent.source,
    version: child.version ?? parent.version,
  };
}

export function personalCapacityDisposition(assignments: CapacityAssignment[], subject: string, limit: number): { allowed: boolean; inFlight: number; message: string } {
  const inFlight = assignments.filter((assignment) => assignment.subject === subject).reduce((sum, assignment) => sum + assignment.inFlight, 0);
  return inFlight >= limit
    ? { allowed: false, inFlight, message: `Personal attention limit reached: ${inFlight} of ${limit} slots are in flight across all pods and hats.` }
    : { allowed: true, inFlight, message: `Personal attention available: ${inFlight} of ${limit} slots are in flight across all pods and hats.` };
}

export function evaluateSignerPolicy(input: SignerPolicyInput): { allowed: boolean; reasons: string[]; requiredDistinctHumans: number } {
  const requiredDistinctHumans = input.profile === "regulated" && input.defaultClosed ? 2 : 1;
  const reasons: string[] = [];
  if (!input.critic.passed || !input.critic.freshContext) reasons.push("A passing fresh-context Critic report is required.");
  if (input.defaultClosed && input.critic.unresolvedFindings > 0) reasons.push("Default-closed work cannot retain unresolved Critic findings.");
  const distinct = new Set(input.gate3Signatures.map((signature) => signature.subject)).size;
  if (distinct < requiredDistinctHumans) reasons.push(`${requiredDistinctHumans} distinct human signer${requiredDistinctHumans === 1 ? " is" : "s are"} required.`);
  if (input.profile === "commercial" && input.defaultClosed) {
    const gate2SessionsBySubject = new Map(input.gate2Signatures.map((signature) => [signature.subject, signature.sessionId]));
    const hasSecondLook = input.gate3Signatures.some((signature) => gate2SessionsBySubject.get(signature.subject) !== signature.sessionId);
    if (!hasSecondLook) reasons.push("Gate 3 must be a second look in a session separate from Gate 2.");
  }
  return { allowed: reasons.length === 0, reasons, requiredDistinctHumans };
}

export function transferAccountability(hat: Role, fromSubject: string, toSubject: string, at: string): AccountabilityTransferEvent {
  if (fromSubject === toSubject) throw new Error("An accountability transfer requires a new identity.");
  return { at, fromSubject, hat, openGateAssignee: toSubject, pastSignaturesRemainAttributed: true, toSubject, type: "accountability-transferred" };
}

export function tenantScopeAllows(identityOrganization: string, resourceOrganization: string): boolean {
  return Boolean(identityOrganization) && identityOrganization === resourceOrganization;
}
