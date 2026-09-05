import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateGateDecisionPolicy, type GatePolicyInput } from '../src/gate-policy.ts';

function fixture(): GatePolicyInput {
  const target = { organizationId: 'synthetic', repository: 'github:1', itemId: 'intent/0043', gate: 3 as const, artifactRevision: 'a'.repeat(40), decisionDigest: 'b'.repeat(64) };
  const signatures: GatePolicyInput['record']['signatures'] = ['product-lead', 'tech-lead', 'product-designer', 'specialist'].map((hat, index) => ({ subject: 'synthetic-human', type: 'human' as const,
    hat: hat as 'product-lead' | 'tech-lead' | 'product-designer' | 'specialist', sequence: index + 1, sessionId: 'gate3-session', authenticatedAt: '2026-09-05T12:00:01.500Z', signedAt: '2026-09-05T12:00:02Z', qualifiedDomains: hat === 'specialist' ? ['accessibility', 'security'] : [] }));
  return { target, policy: { digest: 'c'.repeat(64), profile: 'commercial', defaultClosed: true, userFacing: true, activatedDomains: ['security', 'accessibility'], humanSpecialistDomains: ['accessibility'] },
    record: { ...target, decision: 'approved', signatures },
    prerequisite: { organizationId: target.organizationId, repository: target.repository, itemId: target.itemId,
      gate: 2, artifactRevision: 'd'.repeat(40), decisionDigest: 'e'.repeat(64), decision: 'approved',
      signatures: [{ subject: 'synthetic-human', sessionId: 'gate2-session', signedAt: '2026-09-05T11:00:00Z' }] },
    critic: { artifactRevision: target.artifactRevision, reportDigest: 'f'.repeat(64), reportedAt: '2026-09-05T12:00:01Z', passed: true, freshContext: true, unresolvedFindings: 0 },
    buildEvidence: { artifactRevision: target.artifactRevision, evidenceDigest: '1'.repeat(64), examPassed: true, planConformant: true },
    domainAssurance: { builderSubject: 'synthetic-builder', reviews: ['security', 'accessibility'].map((domain, index) => ({
      domain: domain as 'security' | 'accessibility', artifactRevision: target.artifactRevision, reportDigest: String(index + 3).repeat(64), reviewerSubject: `synthetic-reviewer-${index}`,
      freshContext: true, passed: true, confidence: 'high', unresolvedFindings: 0, humanRequired: domain === 'accessibility',
    })), exceptionBrief: { artifactRevision: target.artifactRevision, digest: '5'.repeat(64), reviewDigests: ['3'.repeat(64), '4'.repeat(64)] } },
    evaluatedAt: '2026-09-05T12:00:03Z' };
}
const blocked = (value: unknown, reason: string) => { const result = evaluateGateDecisionPolicy(value); assert.equal(result.outcome, 'blocked'); assert.ok(result.reasons.includes(reason as never)); assert.equal(result.sourceVerificationRequired, true); };
test('commercial solo can satisfy required hats only as normalized policy facts, never standalone approval', () => {
  assert.deepEqual(evaluateGateDecisionPolicy(fixture()), { outcome: 'policy-satisfied', reasons: [], sourceVerificationRequired: true });
  const input = fixture(); input.target.gate = 1; input.record.gate = 1; input.record.signatures = input.record.signatures.filter((entry) => entry.hat !== 'tech-lead').map((entry, index) => ({ ...entry, sequence: index + 1 }));
  input.prerequisite = null; input.buildEvidence = null;
  assert.equal(evaluateGateDecisionPolicy(input).outcome, 'policy-satisfied');
  input.record.signatures = input.record.signatures.filter((entry) => entry.hat !== 'product-designer'); blocked(input, 'MISSING_HAT');
});
test('malformed inputs, target substitution, agents and non-approval decisions fail closed', () => {
  blocked({}, 'INVALID_INPUT'); blocked({ ...fixture(), approval: true }, 'INVALID_INPUT');
  for (const field of ['organizationId', 'repository', 'itemId', 'artifactRevision', 'decisionDigest'] as const) {
    const input = fixture(); input.record[field] = field === 'artifactRevision' ? '2'.repeat(40) : field === 'decisionDigest' ? '2'.repeat(64) : 'foreign'; blocked(input, 'TARGET_MISMATCH');
  }
  const agent = fixture(); agent.record.signatures[0]!.type = 'agent'; blocked(agent, 'HUMAN_REQUIRED');
  for (const decision of ['send-back', 'declined'] as const) { const input = fixture(); input.record.decision = decision; blocked(input, 'NOT_APPROVED'); }
});
test('sequences, duplicate signer-hat pairs, future timestamps and reversed order cannot satisfy policy', () => {
  for (const sequence of [0, 9]) { const input = fixture(); input.record.signatures[1]!.sequence = sequence; blocked(input, sequence === 0 ? 'INVALID_INPUT' : 'INVALID_SEQUENCE'); }
  const duplicate = fixture(); duplicate.record.signatures[1]!.hat = 'product-lead'; blocked(duplicate, 'INVALID_SEQUENCE');
  for (const time of ['2026-09-05T12:00:04Z', '2026-09-05T12:00:01Z', '2026-09-05T10:00:00Z']) {
    const input = fixture(); input.record.signatures[1]!.signedAt = time; blocked(input, 'INVALID_TIME');
  }
});
test('Critic and build evidence are complete and revision-bound and closed work permits no unresolved findings', () => {
  for (const critic of [null, { ...fixture().critic!, freshContext: false }, { ...fixture().critic!, passed: false }, { ...fixture().critic!, artifactRevision: '2'.repeat(40) }]) blocked({ ...fixture(), critic }, 'CRITIC_REQUIRED');
  blocked({ ...fixture(), critic: { ...fixture().critic!, unresolvedFindings: 1 } }, 'UNRESOLVED_FINDINGS');
  for (const buildEvidence of [null, { ...fixture().buildEvidence!, examPassed: false }, { ...fixture().buildEvidence!, planConformant: false }, { ...fixture().buildEvidence!, artifactRevision: '2'.repeat(40) }]) blocked({ ...fixture(), buildEvidence }, 'BUILD_EVIDENCE_REQUIRED');
});
test('second look requires the right prerequisite, no reused Gate 2 session and post-Critic timing for all signatures', () => {
  blocked({ ...fixture(), prerequisite: null }, 'PREREQUISITE_REQUIRED');
  blocked({ ...fixture(), prerequisite: { ...fixture().prerequisite!, organizationId: 'foreign' } }, 'TARGET_MISMATCH');
  blocked({ ...fixture(), prerequisite: { ...fixture().prerequisite!, gate: 1 } }, 'SECOND_LOOK_REQUIRED');
  const same = fixture(); same.record.signatures[1]!.sessionId = 'gate2-session'; blocked(same, 'SECOND_LOOK_REQUIRED');
  const unrelated = fixture(); unrelated.prerequisite!.signatures[0]!.subject = 'another-human'; unrelated.record.signatures[0]!.sessionId = 'gate2-session'; blocked(unrelated, 'SECOND_LOOK_REQUIRED');
  const multiple = fixture(); multiple.prerequisite!.signatures.push({ subject: 'synthetic-human', sessionId: 'gate3-session', signedAt: '2026-09-05T11:01:00Z' }); blocked(multiple, 'SECOND_LOOK_REQUIRED');
  const beforeCritic = fixture(); beforeCritic.record.signatures.forEach((entry) => { entry.signedAt = '2026-09-05T12:00:00Z'; }); blocked(beforeCritic, 'INVALID_TIME');
});
test('regulated closed work needs distinct contributing humans and qualified specialists for each escalated domain', () => {
  const input = fixture(); input.policy.profile = 'regulated'; blocked(input, 'DISTINCT_HUMANS_REQUIRED');
  input.record.signatures[1]!.subject = 'second-synthetic-human'; input.record.signatures[1]!.sessionId = 'second-human-session'; assert.equal(evaluateGateDecisionPolicy(input).outcome, 'policy-satisfied');
  input.record.signatures[3]!.qualifiedDomains = ['accessibility']; blocked(input, 'UNQUALIFIED_SPECIALIST');
  input.record.signatures[3]!.qualifiedDomains.push('security');
  assert.equal(evaluateGateDecisionPolicy(input).outcome, 'policy-satisfied');
});

test('session authentication precedes signing, follows the closed commercial build Critic, and cannot change identity', () => {
  for (const authenticatedAt of ['2026-09-05T12:00:00Z', '2026-09-05T12:00:01Z']) {
    const input = fixture(); input.record.signatures.forEach((entry) => { entry.authenticatedAt = authenticatedAt; });
    blocked(input, 'SECOND_LOOK_REQUIRED');
  }
  const future = fixture(); future.record.signatures[0]!.authenticatedAt = '2026-09-05T12:00:03Z'; blocked(future, 'INVALID_TIME');
  const identity = fixture(); identity.record.signatures[1]!.subject = 'another-human'; blocked(identity, 'SESSION_MISMATCH');
  const inconsistent = fixture(); inconsistent.record.signatures[1]!.authenticatedAt = '2026-09-05T12:00:01.750Z'; blocked(inconsistent, 'SESSION_MISMATCH');
});

test('closed-domain assurance is complete, independent, high-confidence, current and exactly linked from the exception brief', () => {
  blocked({ ...fixture(), domainAssurance: null }, 'DOMAIN_ASSURANCE_REQUIRED');
  for (const change of [{ passed: false }, { confidence: 'low' as const }, { freshContext: false }, { unresolvedFindings: 1 },
    { reviewerSubject: 'synthetic-builder' }, { artifactRevision: '2'.repeat(40) }]) {
    const input = fixture(); Object.assign(input.domainAssurance!.reviews[0]!, change); blocked(input, 'DOMAIN_ASSURANCE_REQUIRED');
  }
  const missing = fixture(); missing.domainAssurance!.reviews.pop(); blocked(missing, 'DOMAIN_ASSURANCE_REQUIRED');
  const link = fixture(); link.domainAssurance!.exceptionBrief.reviewDigests = ['3'.repeat(64), '3'.repeat(64)]; blocked(link, 'DOMAIN_ASSURANCE_REQUIRED');
  const trigger = fixture(); trigger.policy.humanSpecialistDomains = []; trigger.domainAssurance!.reviews[0]!.humanRequired = true;
  trigger.record.signatures[3]!.qualifiedDomains = ['accessibility']; blocked(trigger, 'UNQUALIFIED_SPECIALIST');
  const weakened = fixture(); weakened.policy.defaultClosed = false; blocked(weakened, 'POLICY_INCOMPLETE');
});
