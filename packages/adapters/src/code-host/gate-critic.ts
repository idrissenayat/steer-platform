import { createHash } from 'node:crypto';
import { z } from 'zod';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { parseNativeReviewJson } from './gate-domain-review.ts';

const text = z.string().min(1).max(20000).refine(value => value.trim().length > 0);
const identifier = z.string().min(1).max(200).refine(value => value === value.trim());
const count = z.number().int().min(0).max(100000);
const rank = z.enum(['blocker', 'major', 'minor', 'nit']);
const instant = z.string().max(30).refine(value => parseUtcInstant(value) !== null);
const finding = z.strictObject({ id: identifier, rank, summary: text,
  evidence: z.array(text).min(1).max(128), requiredResolution: text });
const reviewer = z.strictObject({ type: z.literal('fresh-context-critic-agent'), provider: identifier,
  task: identifier, inheritedConversation: z.boolean(), memoryUse: text });
const common = z.strictObject({ version: z.literal('steer-critic-review/v1'), item: identifier, gate: z.literal(2),
  targetRevision: gatePolicyInputSchema.shape.target.shape.artifactRevision, reviewedAt: instant,
  disposition: z.literal('hold-send-back'), pass: z.literal(false),
  unresolved: z.strictObject({ total: count, blocker: count, major: count, minor: count, nit: count }),
  recommendedGate2Disposition: text });
// Explicitly support the two retained native HOLD layouts. A future PASS or
// remediation-preflight format needs its own reviewed contract, not a guessed alias.
const initial = common.extend({ reviewer: reviewer.extend({ priorStatusTreatedAsEvidence: z.boolean() }),
  validation: z.strictObject({ command: text, passed: z.boolean(), testFilesPassed: count,
    testsPassed: count, workspaceTestsPassed: count, scope: text }), findings: z.array(finding).max(100) });
const followup = common.extend({ reviewer: reviewer.extend({ priorConclusionsTreatedAsAuthority: z.boolean() }),
  validation: z.strictObject({ targetMatchesLocalHeadTrackingAndRemote: z.boolean(), workingTreeCleanBeforeAndAfter: z.boolean(),
    gateOneArtifactsByteIdentical: z.boolean(), suppliedExamSha256: gatePolicyInputSchema.shape.target.shape.decisionDigest,
    pnpmCheckPassed: z.boolean(), vitestFilesPassed: count, vitestTestsPassed: count, examControlTestsPassed: count,
    workspaceTestsPassed: count, buildsPassed: count }),
  liveGitHubEvidence: z.strictObject({ controlPullRequest: count, controlPullRequestState: z.literal('merged'),
    controlMergeCommit: gatePolicyInputSchema.shape.target.shape.artifactRevision, repositoryContractConclusion: text,
    strictRequiredCheck: z.boolean(), requireCodeOwnerReview: z.boolean(), dismissStaleReviews: z.boolean(),
    enforceForAdministrators: z.boolean(), allowForcePushes: z.boolean(), allowDeletions: z.boolean(),
    examCandidateCheckRuns: count, examCandidateAssociatedPullRequests: count,
    exactTargetCheckRuns: count, exactTargetAssociatedPullRequests: count }),
  originalFindingStatus: z.array(z.strictObject({ id: identifier,
    status: z.enum(['resolved', 'partially-resolved-blocker', 'partially-resolved-major']), summary: text,
    evidence: z.array(text).min(1).max(128), requiredResolution: text.optional() })).max(100),
  newFindings: z.array(finding).max(100) });
const schema = z.union([initial, followup]);
const expectedSchema = z.strictObject({ recordItem: identifier,
  artifactRevision: gatePolicyInputSchema.shape.target.shape.artifactRevision,
  reportDigest: gatePolicyInputSchema.shape.target.shape.decisionDigest, evaluatedAt: instant,
  reviewerProvider: identifier, reviewerTask: identifier, builderTask: identifier });
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}

/** Preserve native Critic claims and recompute their unresolved counters. This
 * does not authenticate the task/provider, attest fresh context, validate cited
 * prose or upgrade local preflight, test success or historical HOLD to gate PASS. */
export function normalizeGateCritic(content: unknown, rawExpected: unknown) {
  try {
    if (typeof content !== 'string') return null;
    const bytes = Buffer.from(content, 'utf8'), expected = expectedSchema.parse(rawExpected);
    if (bytes.length > 512 * 1024 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== content ||
      createHash('sha256').update(bytes).digest('hex') !== expected.reportDigest) return null;
    const record = schema.parse(parseNativeReviewJson(content));
    if (record.item !== expected.recordItem || record.targetRevision !== expected.artifactRevision ||
      record.reviewer.provider !== expected.reviewerProvider || record.reviewer.task !== expected.reviewerTask ||
      parseUtcInstant(record.reviewedAt)! > parseUtcInstant(expected.evaluatedAt)!) return null;
    const totals = { total: 0, blocker: 0, major: 0, minor: 0, nit: 0 }, ids = new Set<string>();
    const add = (id: string, severity?: z.infer<typeof rank>) => {
      if (ids.has(id)) throw new Error('Duplicate finding.'); ids.add(id);
      if (severity) { totals.total++; totals[severity]++; }
    };
    if ('findings' in record) for (const entry of record.findings) add(entry.id, entry.rank);
    else {
      for (const entry of record.originalFindingStatus) {
        if (entry.status !== 'resolved' && !entry.requiredResolution) return null;
        add(entry.id, entry.status === 'resolved' ? undefined : entry.status === 'partially-resolved-blocker' ? 'blocker' : 'major');
      }
      for (const entry of record.newFindings) add(entry.id, entry.rank);
    }
    if (Object.entries(totals).some(([key, value]) => record.unresolved[key as keyof typeof totals] !== value)) return null;
    const priorClaim = 'priorStatusTreatedAsEvidence' in record.reviewer ? record.reviewer.priorStatusTreatedAsEvidence : record.reviewer.priorConclusionsTreatedAsAuthority;
    return freeze({ kind: 'native-gate-critic-observation' as const, record,
      critic: { artifactRevision: record.targetRevision, reportDigest: expected.reportDigest, reportedAt: record.reviewedAt,
        passed: false as const, unresolvedFindings: totals.total,
        freshContext: !record.reviewer.inheritedConversation && !priorClaim && record.reviewer.task !== expected.builderTask },
      reviewerAuthenticityVerificationRequired: true as const, evidenceVerificationRequired: true as const,
      findingHistoryVerificationRequired: true as const, sourceVerificationRequired: true as const,
      gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
