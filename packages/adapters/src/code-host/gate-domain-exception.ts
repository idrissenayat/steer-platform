import { createHash } from 'node:crypto';
import { z } from 'zod';
import { artifactProjectionInputSchema } from '@steer/tool-registry';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { nativeDomainReviewSchema, normalizeGateDomainReview, parseNativeReviewJson } from './gate-domain-review.ts';

const native = nativeDomainReviewSchema.shape, target = native.target.shape;
const digest = gatePolicyInputSchema.shape.target.shape.decisionDigest, path = artifactProjectionInputSchema.shape.path;
const summary = z.strictObject({ domain: native.domain, reviewerServiceIdentity: native.reviewer.shape.serviceIdentity,
  reviewerConfigurationRevision: native.reviewer.shape.configurationRevision, decision: native.decision, confidence: native.confidence,
  reviewedAt: native.reviewedAt, openFindingCount: z.number().int().nonnegative().max(100),
  escalationCount: z.number().int().nonnegative().max(100), recordPath: path });
const schema = z.strictObject({ version: z.literal('steer-domain-exception-brief/v1'), organization: target.organization,
  item: target.item, reviewType: native.reviewType, generatedAt: native.reviewedAt, targetRevision: target.revision, exam: target.exam,
  domainSummaries: z.array(summary).min(1).max(7), findings: z.array(native.findings.element.extend({ domain: native.domain })).max(700),
  escalations: z.array(native.escalations.element.extend({ domain: native.domain })).max(700),
  status: z.enum(['ready-for-fresh-context-critic', 'hold-send-back']), eligibleForGateTwoCritic: z.boolean(),
  boundaries: native.boundaries.pick({ doesNotSignGateTwo: true, doesNotAuthorizeBuildOrRelease: true, doesNotAuthorizeProductionOrSpend: true }) });
const expectedSchema = z.strictObject({ organization: target.organization, recordItem: target.item, artifactRevision: target.revision,
  exam: target.exam, reportDigest: digest, builderSubject: native.reviewer.shape.serviceIdentity, evaluatedAt: native.reviewedAt,
  reviews: z.array(z.strictObject({ path, digest, domain: native.domain })).min(1).max(7) });
const sourcesSchema = z.array(z.strictObject({ path, content: z.string().max(65536) })).min(1).max(7);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value;
}

/** Reconstructs every native summary/finding/escalation from pinned source
 * records. Consistent consolidation is not source/reviewer authenticity or a
 * passing gate. Does not read files, issue records or approve selected pins. */
export function verifyNativeDomainException(content: unknown, rawExpected: unknown, rawSources: unknown) {
  try {
    if (typeof content !== 'string') return null;
    const expected = expectedSchema.parse(rawExpected), sources = sourcesSchema.parse(rawSources), bytes = Buffer.from(content, 'utf8');
    if (bytes.length > 512 * 1024 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== content ||
      createHash('sha256').update(bytes).digest('hex') !== expected.reportDigest ||
      new Set(expected.reviews.map(value => value.path)).size !== expected.reviews.length ||
      new Set(expected.reviews.map(value => value.domain)).size !== expected.reviews.length ||
      sources.length !== expected.reviews.length || new Set(sources.map(value => value.path)).size !== sources.length) return null;
    const record = schema.parse(parseNativeReviewJson(content));
    if (record.organization !== expected.organization || record.item !== expected.recordItem || record.targetRevision !== expected.artifactRevision ||
      record.exam.path !== expected.exam.path || record.exam.sha256 !== expected.exam.sha256 ||
      parseUtcInstant(record.generatedAt)! > parseUtcInstant(expected.evaluatedAt)!) return null;
    const reviews = expected.reviews.map(reference => {
      const source = sources.find(value => value.path === reference.path);
      if (!source) throw new Error();
      const observation = normalizeGateDomainReview(source.content, { organization: expected.organization, recordItem: expected.recordItem,
        artifactRevision: expected.artifactRevision, exam: expected.exam, domain: reference.domain, reportDigest: reference.digest,
        builderSubject: expected.builderSubject, evaluatedAt: record.generatedAt });
      if (!observation) throw new Error(); return observation;
    });
    const findings = reviews.flatMap(value => value.record.findings.map(finding => ({ domain: value.record.domain, ...finding })));
    const escalations = reviews.flatMap(value => value.record.escalations.map(escalation => ({ domain: value.record.domain, ...escalation })));
    // Preserve the existing consolidation's medium-confidence semantics. The
    // later gate policy still requires HIGH confidence and may block readiness.
    const eligible = reviews.every(value => value.record.decision === 'approved' && value.record.confidence !== 'low') &&
      findings.every(value => value.status !== 'open') && escalations.length === 0;
    const rebuilt = { version: 'steer-domain-exception-brief/v1', organization: expected.organization, item: expected.recordItem,
      reviewType: 'gate-2-exam', generatedAt: record.generatedAt, targetRevision: expected.artifactRevision, exam: expected.exam,
      domainSummaries: reviews.map((value, index) => ({ domain: value.record.domain, reviewerServiceIdentity: value.record.reviewer.serviceIdentity,
        reviewerConfigurationRevision: value.record.reviewer.configurationRevision, decision: value.record.decision, confidence: value.record.confidence,
        reviewedAt: value.record.reviewedAt, openFindingCount: value.record.findings.filter(finding => finding.status === 'open').length,
        escalationCount: value.record.escalations.length, recordPath: expected.reviews[index]!.path })), findings, escalations,
      status: eligible ? 'ready-for-fresh-context-critic' : 'hold-send-back', eligibleForGateTwoCritic: eligible,
      boundaries: { doesNotSignGateTwo: true, doesNotAuthorizeBuildOrRelease: true, doesNotAuthorizeProductionOrSpend: true } };
    // Both values pass the same strict schema, yielding identical field order
    // without importing another platform dependency or changing original bytes.
    if (JSON.stringify(record) !== JSON.stringify(schema.parse(rebuilt))) return null;
    return freeze({ kind: 'native-domain-exception-observation' as const, record,
      exceptionBrief: { artifactRevision: expected.artifactRevision, digest: expected.reportDigest, reviewDigests: expected.reviews.map(value => value.digest) },
      sourceConsolidationVerified: true as const, reviewerAuthenticityVerificationRequired: true as const,
      sourceVerificationRequired: true as const, gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
