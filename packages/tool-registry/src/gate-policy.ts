import { roles } from '@steer/domain/types';
import { z } from 'zod';

const identifier = z.string().min(1).max(200).refine((value) => value === value.trim());
const sha = z.string().regex(/^[a-f0-9]{40}$/), digest = z.string().regex(/^[a-f0-9]{64}$/);
const domains = z.enum(['accessibility', 'irreversible-operations', 'legal', 'money', 'privacy', 'reliability', 'security']);
const signature = z.strictObject({ subject: identifier, type: z.enum(['human', 'agent']), hat: z.enum(roles),
  sequence: z.number().int().positive().safe(), sessionId: identifier, authenticatedAt: z.iso.datetime(), signedAt: z.iso.datetime(),
  qualifiedDomains: z.array(domains).max(7).refine((values) => new Set(values).size === values.length),
});
const priorSignature = signature.pick({ subject: true, sessionId: true, signedAt: true });
export const gatePolicyInputSchema = z.strictObject({
  target: z.strictObject({ organizationId: identifier, repository: identifier, itemId: identifier,
    gate: z.union([z.literal(1), z.literal(2), z.literal(3)]), artifactRevision: sha, decisionDigest: digest }),
  policy: z.strictObject({ digest, profile: z.enum(['commercial', 'regulated']), defaultClosed: z.boolean(), userFacing: z.boolean(),
    activatedDomains: z.array(domains).max(7).refine((values) => new Set(values).size === values.length),
    humanSpecialistDomains: z.array(domains).max(7).refine((values) => new Set(values).size === values.length),
  }),
  record: z.strictObject({ organizationId: identifier, repository: identifier, itemId: identifier,
    gate: z.union([z.literal(1), z.literal(2), z.literal(3)]), artifactRevision: sha, decisionDigest: digest,
    decision: z.enum(['approved', 'send-back', 'declined']), signatures: z.array(signature).min(1).max(100),
  }),
  prerequisite: z.strictObject({ organizationId: identifier, repository: identifier, itemId: identifier,
    gate: z.union([z.literal(1), z.literal(2)]), artifactRevision: sha, decisionDigest: digest,
    decision: z.literal('approved'), signatures: z.array(priorSignature).min(1).max(100),
  }).nullable(),
  critic: z.strictObject({ artifactRevision: sha, reportDigest: digest, reportedAt: z.iso.datetime(), passed: z.boolean(),
    freshContext: z.boolean(), unresolvedFindings: z.number().int().nonnegative().max(100000),
  }).nullable(),
  buildEvidence: z.strictObject({ artifactRevision: sha, evidenceDigest: digest, examPassed: z.boolean(), planConformant: z.boolean() }).nullable(),
  domainAssurance: z.strictObject({ builderSubject: identifier,
    reviews: z.array(z.strictObject({ domain: domains, artifactRevision: sha, reportDigest: digest, reviewerSubject: identifier,
      freshContext: z.boolean(), passed: z.boolean(), confidence: z.enum(['high', 'low']), unresolvedFindings: z.number().int().nonnegative(),
      humanRequired: z.boolean(),
    })).max(7),
    exceptionBrief: z.strictObject({ artifactRevision: sha, digest, reviewDigests: z.array(digest).max(7) }),
  }).nullable(),
  evaluatedAt: z.iso.datetime(),
});
export type GatePolicyInput = z.infer<typeof gatePolicyInputSchema>;
export type GatePolicyReason = 'INVALID_INPUT' | 'TARGET_MISMATCH' | 'NOT_APPROVED' | 'HUMAN_REQUIRED' | 'INVALID_SEQUENCE' |
  'INVALID_TIME' | 'MISSING_HAT' | 'UNQUALIFIED_SPECIALIST' | 'PREREQUISITE_REQUIRED' | 'CRITIC_REQUIRED' |
  'UNRESOLVED_FINDINGS' | 'BUILD_EVIDENCE_REQUIRED' | 'DISTINCT_HUMANS_REQUIRED' | 'SECOND_LOOK_REQUIRED' | 'DOMAIN_ASSURANCE_REQUIRED' | 'POLICY_INCOMPLETE' | 'SESSION_MISMATCH';

/** Pure policy evaluation of normalized facts supplied by trusted verification code.
 * It does NOT authenticate a signer, verify provider proof, read current source, or authorize an action. */
export function evaluateGateDecisionPolicy(raw: unknown): {
  outcome: 'policy-satisfied' | 'blocked'; reasons: GatePolicyReason[]; sourceVerificationRequired: true;
} {
  const parsed = gatePolicyInputSchema.safeParse(raw);
  if (!parsed.success) return { outcome: 'blocked', reasons: ['INVALID_INPUT'], sourceVerificationRequired: true };
  const { target, policy, record, prerequisite, critic, buildEvidence, domainAssurance, evaluatedAt } = parsed.data;
  const reasons = new Set<GatePolicyReason>(); const now = Date.parse(evaluatedAt);
  for (const key of ['organizationId', 'repository', 'itemId', 'gate', 'artifactRevision', 'decisionDigest'] as const) {
    if (record[key] !== target[key]) reasons.add('TARGET_MISMATCH');
  }
  if (record.decision !== 'approved') reasons.add('NOT_APPROVED');
  if (record.signatures.some((entry) => entry.type !== 'human')) reasons.add('HUMAN_REQUIRED');
  // Sequence positions are unique, ordered and contiguous within this normalized decision record.
  if (record.signatures.some((entry, index) => entry.sequence !== index + 1) ||
    new Set(record.signatures.map((entry) => `${entry.subject}\0${entry.hat}`)).size !== record.signatures.length) reasons.add('INVALID_SEQUENCE');
  const signatures = record.signatures.filter((entry) => entry.type === 'human');
  const times = record.signatures.map((entry) => Date.parse(entry.signedAt));
  if (times.some((time, index) => time > now || (index > 0 && time < times[index - 1]!))) reasons.add('INVALID_TIME');
  const sessions = new Map<string, { subject: string; authenticatedAt: number }>();
  for (const entry of record.signatures) {
    const authenticatedAt = Date.parse(entry.authenticatedAt);
    if (authenticatedAt > Date.parse(entry.signedAt)) reasons.add('INVALID_TIME');
    const prior = sessions.get(entry.sessionId);
    if (prior && (prior.subject !== entry.subject || prior.authenticatedAt !== authenticatedAt)) reasons.add('SESSION_MISMATCH');
    sessions.set(entry.sessionId, { subject: entry.subject, authenticatedAt });
  }
  const specialistDomains = new Set(policy.humanSpecialistDomains);
  if (policy.profile === 'regulated' && policy.defaultClosed) policy.activatedDomains.forEach((domain) => specialistDomains.add(domain));
  if (target.gate === 3 && policy.userFacing) specialistDomains.add('accessibility');
  if (policy.defaultClosed !== Boolean(policy.activatedDomains.length) || [...specialistDomains].some((domain) => !policy.activatedDomains.includes(domain))) reasons.add('POLICY_INCOMPLETE');
  if (!policy.defaultClosed && domainAssurance !== null) reasons.add('POLICY_INCOMPLETE');
  if (policy.defaultClosed) {
    const reviews = domainAssurance?.reviews ?? [];
    if (!domainAssurance || reviews.length !== policy.activatedDomains.length || new Set(reviews.map((review) => review.domain)).size !== reviews.length ||
      new Set(reviews.map((review) => review.reportDigest)).size !== reviews.length ||
      reviews.some((review) => !policy.activatedDomains.includes(review.domain) || review.artifactRevision !== target.artifactRevision ||
        review.reviewerSubject === domainAssurance.builderSubject || !review.freshContext || !review.passed || review.confidence !== 'high' || review.unresolvedFindings !== 0) ||
      domainAssurance.exceptionBrief.artifactRevision !== target.artifactRevision || domainAssurance.exceptionBrief.reviewDigests.length !== reviews.length ||
      new Set(domainAssurance.exceptionBrief.reviewDigests).size !== reviews.length ||
      reviews.some((review) => !domainAssurance.exceptionBrief.reviewDigests.includes(review.reportDigest))) reasons.add('DOMAIN_ASSURANCE_REQUIRED');
    reviews.filter((review) => review.humanRequired).forEach((review) => specialistDomains.add(review.domain));
  }
  const required = target.gate === 1 ? ['product-lead', 'product-designer'] : target.gate === 2 ? ['tech-lead'] :
    ['product-lead', 'tech-lead', ...(policy.userFacing ? ['product-designer'] : [])];
  if (specialistDomains.size) required.push('specialist');
  if (required.some((hat) => !signatures.some((entry) => entry.hat === hat))) reasons.add('MISSING_HAT');
  if (signatures.some((entry) => !required.includes(entry.hat) || (entry.hat === 'specialist'
    ? entry.sequence < required.indexOf('specialist') + 1 : entry.sequence !== required.indexOf(entry.hat) + 1))) reasons.add('INVALID_SEQUENCE');
  if ([...specialistDomains].some((domain) => !signatures.some((entry) => entry.hat === 'specialist' && entry.qualifiedDomains.includes(domain)))) reasons.add('UNQUALIFIED_SPECIALIST');
  if (policy.profile === 'regulated' && policy.defaultClosed && new Set(signatures.filter((entry) => required.includes(entry.hat)).map((entry) => entry.subject)).size < 2) reasons.add('DISTINCT_HUMANS_REQUIRED');
  if (target.gate > 1) {
    if (!prerequisite || prerequisite.gate !== target.gate - 1) reasons.add('PREREQUISITE_REQUIRED');
    else {
      if (prerequisite.organizationId !== target.organizationId || prerequisite.repository !== target.repository || prerequisite.itemId !== target.itemId) reasons.add('TARGET_MISMATCH');
      if (prerequisite.signatures.some((entry) => Date.parse(entry.signedAt) > now) || times.some((time) => prerequisite.signatures.some((entry) => time < Date.parse(entry.signedAt)))) reasons.add('INVALID_TIME');
    }
  }
  if (!critic || !critic.passed || !critic.freshContext || critic.artifactRevision !== target.artifactRevision) reasons.add('CRITIC_REQUIRED');
  else {
    const at = Date.parse(critic.reportedAt);
    if (at > now || times.some((time) => time <= at)) reasons.add('INVALID_TIME');
    if (policy.defaultClosed && critic.unresolvedFindings !== 0) reasons.add('UNRESOLVED_FINDINGS');
  }
  if (target.gate === 3) {
    if (!buildEvidence || buildEvidence.artifactRevision !== target.artifactRevision || !buildEvidence.examPassed || !buildEvidence.planConformant) reasons.add('BUILD_EVIDENCE_REQUIRED');
    if (policy.profile === 'commercial' && policy.defaultClosed) {
      // Every signer must use a session different from every Gate 2 signature session (SIG-12).
      // A newly added signer still needs the complete prerequisite and post-Critic chronology above.
      if (!prerequisite || prerequisite.gate !== 2 || signatures.some((entry) =>
        prerequisite.signatures.some((prior) => prior.sessionId === entry.sessionId))) reasons.add('SECOND_LOOK_REQUIRED');
      if (!critic || signatures.some((entry) => Date.parse(entry.authenticatedAt) <= Date.parse(critic.reportedAt))) reasons.add('SECOND_LOOK_REQUIRED');
    }
  }
  return { outcome: reasons.size ? 'blocked' : 'policy-satisfied', reasons: [...reasons], sourceVerificationRequired: true };
}
