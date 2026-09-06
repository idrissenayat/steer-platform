import { createHash } from 'node:crypto';
import { z } from 'zod';
import { artifactProjectionInputSchema } from '@steer/tool-registry';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';

const text = z.string().min(1).max(20000).refine(value => value.trim().length > 0);
const identifier = z.string().min(1).max(200).refine(value => value === value.trim());
const digest = gatePolicyInputSchema.shape.target.shape.decisionDigest;
const reference = z.strictObject({ path: artifactProjectionInputSchema.shape.path, sha256: digest });
const instant = z.string().max(30).refine(value => parseUtcInstant(value) !== null);
const domain = gatePolicyInputSchema.shape.policy.shape.activatedDomains.element;
const trigger = z.enum(['unresolved-blocker-or-major-finding', 'inconclusive-or-missing-required-evidence',
  'law-regulation-contract-or-policy-requires-human-specialist', 'waiver-or-policy-override-requested',
  'irreversible-external-effect-or-material-rights-impact', 'user-facing-accessibility-manual-release-validation',
  'production-release-paid-deployment-or-spend-authorization']);
const finding = z.strictObject({ id: identifier.regex(/^[A-Z0-9][A-Z0-9-]+$/), severity: z.enum(['blocker', 'major', 'minor', 'nit']),
  status: z.enum(['open', 'resolved']), summary: text, evidence: z.array(reference).min(1).max(128), requiredResolution: text });
const recordSchema = z.strictObject({ version: z.literal('steer-domain-review-record/v1'), domain, reviewType: z.literal('gate-2-exam'),
  target: z.strictObject({ organization: identifier, item: identifier, revision: gatePolicyInputSchema.shape.target.shape.artifactRevision, exam: reference }),
  reviewer: z.strictObject({ serviceIdentity: identifier, agentType: text, model: text, configurationRevision: text,
    freshContext: z.literal(true), freshContextEvidence: text, builderIndependent: z.literal(true) }),
  decision: z.enum(['approved', 'send-back', 'declined']), confidence: z.enum(['high', 'medium', 'low']), reviewedAt: instant,
  reviewedCases: z.array(text).min(1).max(10000), evidence: z.array(reference).min(1).max(128), findings: z.array(finding).max(100),
  escalations: z.array(z.strictObject({ triggerId: trigger, reason: text, findingIds: z.array(identifier).max(100) })).max(100),
  boundaries: z.strictObject({ doesNotSignGateTwo: z.literal(true), doesNotAuthorizeBuildOrRelease: z.literal(true),
    doesNotAuthorizeProductionOrSpend: z.literal(true), doesNotAcceptResidualRiskOrWaiveControls: z.literal(true) }),
});
export { recordSchema as nativeDomainReviewSchema };
const expectedSchema = z.strictObject({ organization: identifier, recordItem: identifier,
  artifactRevision: gatePolicyInputSchema.shape.target.shape.artifactRevision, exam: reference, domain,
  reportDigest: digest, builderSubject: identifier, evaluatedAt: instant });
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value;
}

/** Shared native JSON reader: whitespace is preserved by callers; duplicate keys
 * and alternate token encodings are not silently normalized. Callers bound bytes. */
export function parseNativeReviewJson(content: string): unknown {
  let compact = '', quoted = false, escaped = false;
  for (const char of content) {
    if (quoted) { compact += char; if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (!/[\t\n\r ]/.test(char)) { compact += char; if (char === '"') quoted = true; }
  }
  const raw: unknown = JSON.parse(content);
  if (JSON.stringify(raw) !== compact) throw new Error('Unsupported native review encoding.');
  return raw;
}

/** Native-v1 claim normalization, not reviewer authentication or independent
 * context verification. Preserve exact original bytes and adverse dispositions.
 * The caller must separately verify every referenced artifact and source pin. */
export function normalizeGateDomainReview(content: unknown, rawExpected: unknown) {
  try {
    if (typeof content !== 'string') return null;
    const bytes = Buffer.from(content, 'utf8'), expected = expectedSchema.parse(rawExpected);
    if (bytes.length > 65536 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== content ||
      createHash('sha256').update(bytes).digest('hex') !== expected.reportDigest) return null;
    const record = recordSchema.parse(parseNativeReviewJson(content)), target = record.target;
    if (target.organization !== expected.organization || target.item !== expected.recordItem || target.revision !== expected.artifactRevision ||
      target.exam.path !== expected.exam.path || target.exam.sha256 !== expected.exam.sha256 || record.domain !== expected.domain ||
      parseUtcInstant(record.reviewedAt)! > parseUtcInstant(expected.evaluatedAt)! ||
      new Set(record.reviewedCases).size !== record.reviewedCases.length || new Set(record.findings.map(value => value.id)).size !== record.findings.length) return null;
    const ids = new Set(record.findings.map(value => value.id)), triggers = new Set(record.escalations.map(value => value.triggerId));
    if (record.escalations.some(value => new Set(value.findingIds).size !== value.findingIds.length || value.findingIds.some(id => !ids.has(id))) ||
      (record.findings.some(value => value.status === 'open' && ['blocker', 'major'].includes(value.severity)) && !triggers.has('unresolved-blocker-or-major-finding')) ||
      (record.confidence === 'low' && !triggers.has('inconclusive-or-missing-required-evidence'))) return null;
    const references = new Map<string, z.infer<typeof reference>>();
    for (const entry of [target.exam, ...record.evidence, ...record.findings.flatMap(value => value.evidence)]) {
      if (references.has(entry.path) && references.get(entry.path)!.sha256 !== entry.sha256) return null;
      references.set(entry.path, entry);
    }
    if (references.size > 128) return null;
    const unresolvedFindings = record.findings.filter(value => value.status === 'open').length;
    return freeze({ kind: 'native-gate-domain-review-observation' as const, record,
      evidenceReferences: [...references.values()], review: {
        domain: record.domain, artifactRevision: target.revision, reportDigest: expected.reportDigest,
        reviewerSubject: record.reviewer.serviceIdentity,
        freshContext: record.reviewer.freshContext && record.reviewer.builderIndependent && record.reviewer.serviceIdentity !== expected.builderSubject,
        passed: record.decision === 'approved' && unresolvedFindings === 0 && record.escalations.length === 0,
        confidence: record.confidence === 'high' ? 'high' as const : 'low' as const,
        unresolvedFindings, humanRequired: record.escalations.length > 0,
      }, evidenceVerificationRequired: true as const, reviewerAuthenticityVerificationRequired: true as const,
      gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
