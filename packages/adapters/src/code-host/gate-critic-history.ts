import { z } from 'zod';
import { artifactProjectionInputSchema } from '@steer/tool-registry';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { normalizeGateCritic } from './gate-critic.ts';

const identity = z.string().min(1).max(200).refine(value => value === value.trim());
export const nativeCriticHistoryReferenceSchema = z.strictObject({ path: artifactProjectionInputSchema.shape.path,
  digest: gatePolicyInputSchema.shape.target.shape.decisionDigest,
  artifactRevision: gatePolicyInputSchema.shape.target.shape.artifactRevision,
  reviewerProvider: identity, reviewerTask: identity, builderTask: identity });
const expectedSchema = z.strictObject({ recordItem: identity,
  evaluatedAt: z.string().max(30).refine(value => parseUtcInstant(value) !== null),
  reviews: z.array(nativeCriticHistoryReferenceSchema).min(2).max(16) });
const sourcesSchema = z.array(z.strictObject({ path: artifactProjectionInputSchema.shape.path,
  content: z.string().max(512 * 1024) })).min(2).max(16);
type Severity = 'blocker' | 'major' | 'minor' | 'nit';

/** Exact-set continuity through a selected initial HOLD and its follow-ups.
 * This checks that findings were accounted for, not whether claimed resolutions
 * are true, the selected history is authoritative, or target commits are ancestors. */
export function verifyNativeCriticHistory(rawSources: unknown, rawExpected: unknown) {
  try {
    const sources = sourcesSchema.parse(rawSources), expected = expectedSchema.parse(rawExpected);
    if (sources.length !== expected.reviews.length || new Set(sources.map(value => value.path)).size !== sources.length ||
      new Set(expected.reviews.map(value => value.path)).size !== expected.reviews.length ||
      new Set(expected.reviews.map(value => value.digest)).size !== expected.reviews.length ||
      sources.reduce((total, value) => total + Buffer.byteLength(value.content, 'utf8'), 0) > 8 * 1024 * 1024) return null;
    const observations: NonNullable<ReturnType<typeof normalizeGateCritic>>[] = [];
    const findings = new Map<string, Severity>();
    for (const [index, reference] of expected.reviews.entries()) {
      const source = sources.find(value => value.path === reference.path); if (!source) return null;
      const observation = normalizeGateCritic(source.content, { recordItem: expected.recordItem,
        artifactRevision: reference.artifactRevision, reportDigest: reference.digest, evaluatedAt: expected.evaluatedAt,
        reviewerProvider: reference.reviewerProvider, reviewerTask: reference.reviewerTask, builderTask: reference.builderTask });
      if (!observation) return null;
      const record = observation.record, previous = observations.at(-1);
      if (previous && parseUtcInstant(record.reviewedAt)! < parseUtcInstant(previous.record.reviewedAt)!) return null;
      if (index === 0) {
        if (!('findings' in record)) return null;
        for (const finding of record.findings) findings.set(finding.id, finding.rank);
      } else {
        if (!('originalFindingStatus' in record) || record.originalFindingStatus.length !== findings.size ||
          record.originalFindingStatus.some(value => !findings.has(value.id))) return null;
        for (const finding of record.originalFindingStatus) {
          if (finding.status !== 'resolved' && findings.get(finding.id) !==
            (finding.status === 'partially-resolved-blocker' ? 'blocker' : 'major')) return null;
        }
        for (const finding of record.newFindings) {
          if (findings.has(finding.id)) return null; findings.set(finding.id, finding.rank);
        }
      }
      observations.push(observation);
    }
    return Object.freeze({ kind: 'native-critic-history-observation' as const,
      records: Object.freeze(observations), selectedLinksVerified: true as const,
      reportDigests: Object.freeze(expected.reviews.map(value => value.digest)),
      findingIds: Object.freeze([...findings.keys()]),
      selectedHistoryVerificationRequired: true as const, resolutionEvidenceVerificationRequired: true as const,
      targetAncestryVerificationRequired: true as const, reviewerAuthenticityVerificationRequired: true as const,
      gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
