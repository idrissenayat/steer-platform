import { z } from 'zod';

const text = (max: number) => z.string().max(max).refine(value => !/[\uD800-\uDFFF]/u.test(value));
const id = text(200).refine(value => value.trim().length > 0);
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const oid = z.string().regex(/^[a-f0-9]{40}(?![\s\S])/);
const sourceRef = z.strictObject({
  sourceId: id, targetId: id,
  path: z.string().max(400).regex(/^(?:intent\/[0-9]{4}|items\/[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*(?:\/candidates\/[a-f0-9-]{36})?)\/(?:BRIEF|SPEC)\.md(?![\s\S])/),
  status: z.enum(['canonical', 'candidate', 'amendment']),
  contentDigest: digest, blobOid: oid,
});
const envelopeInput = z.strictObject({
  organizationId: id, productId: id, repository: id, branch: id, head: oid,
  scopeInputDigest: digest, permissionsRevision: id, retrievalConfigurationRevision: id,
  inventoryComplete: z.boolean(),
  // Access gaps are aggregate only: never accept or emit inaccessible item IDs.
  accessGapCount: z.number().int().min(0).max(1000000),
  inventory: z.array(sourceRef).max(1000),
  documents: z.array(z.strictObject({ sourceId: id, content: text(512 * 1024) })).max(50),
});

export const intentEvidenceInputSchema = envelopeInput;

async function hash(content: Uint8Array, algorithm: 'SHA-1' | 'SHA-256' = 'SHA-256') {
  const result = await crypto.subtle.digest(algorithm, new Uint8Array(content));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const bytes = (value: string) => new TextEncoder().encode(value);
const fingerprint = (value: unknown) => hash(bytes(JSON.stringify(value)));

/**
 * Non-billable, bounded exhaustive evidence preparation. Callers must authorize
 * reads and resolve every inventory path/blob at head before calling. This checks
 * byte integrity, not provider provenance or the truth of the declared inventory.
 * Whole documents preserve headings, exclusions and list qualifiers. Large files
 * are explicitly unassessed until contextual chunking exists; never excerpt them.
 */
export async function buildIntentEvidenceEnvelope(value: unknown) {
  const input = envelopeInput.parse(value);
  const inventory = [...input.inventory].sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
  if (new Set(inventory.map(ref => ref.sourceId)).size !== inventory.length
    || new Set(inventory.map(ref => ref.path)).size !== inventory.length) throw new Error('Duplicate source reference.');
  if (inventory.some(ref => ref.path.split('/').slice(0, 2).join('/') !== ref.targetId)) throw new Error('Source path does not belong to its target.');
  const documents = new Map<string, string>();
  for (const document of input.documents) {
    if (documents.has(document.sourceId) || !inventory.some(ref => ref.sourceId === document.sourceId)) throw new Error('Unexpected source content.');
    documents.set(document.sourceId, document.content);
  }
  const evidence: Array<z.infer<typeof sourceRef> & { startByte: 0; endByte: number; content: string }> = [];
  const gaps: Array<{ sourceId: string; reason: 'not-provided' | 'context-limit' | 'batch-limit' }> = [];
  let includedBytes = 0;
  for (const ref of inventory) {
    const content = documents.get(ref.sourceId);
    if (content === undefined) { gaps.push({ sourceId: ref.sourceId, reason: 'not-provided' }); continue; }
    const encoded = bytes(content);
    const blob = new Uint8Array([...bytes(`blob ${encoded.byteLength}\0`), ...encoded]);
    if (await hash(encoded) !== ref.contentDigest || await hash(blob, 'SHA-1') !== ref.blobOid) throw new Error('Source content does not match its pinned reference.');
    if (encoded.byteLength > 32000) { gaps.push({ sourceId: ref.sourceId, reason: 'context-limit' }); continue; }
    if (evidence.length >= 32 || includedBytes + encoded.byteLength > 128000) { gaps.push({ sourceId: ref.sourceId, reason: 'batch-limit' }); continue; }
    evidence.push({ ...ref, startByte: 0, endByte: encoded.byteLength, content }); includedBytes += encoded.byteLength;
  }
  const inventoryDigest = await fingerprint(['steer-scope-inventory/v1', inventory]);
  const snapshot = {
    organizationId: input.organizationId, productId: input.productId, repository: input.repository,
    branch: input.branch, head: input.head, permissionsRevision: input.permissionsRevision,
    retrievalConfigurationRevision: input.retrievalConfigurationRevision, inventoryDigest,
  };
  const coverage = {
    inventoryComplete: input.inventoryComplete, inventoryCount: inventory.length, includedCount: evidence.length,
    accessGapCount: input.accessGapCount, gaps,
    complete: input.inventoryComplete && input.accessGapCount === 0 && gaps.length === 0,
  };
  const sourceSnapshotDigest = await fingerprint(['steer-source-snapshot/v1', snapshot, coverage]);
  const assessmentInputDigest = await fingerprint(['steer-scope-assessment-input/v1', input.scopeInputDigest, sourceSnapshotDigest]);
  return deepFreeze({ kind: 'steer-intent-evidence/v1' as const, snapshot, scopeInputDigest: input.scopeInputDigest,
    sourceSnapshotDigest, assessmentInputDigest, coverage, evidence,
    semanticReviewComplete: false as const, authoritativeClearance: false as const });
}
export type IntentEvidenceEnvelope = Awaited<ReturnType<typeof buildIntentEvidenceEnvelope>>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
}

const citation = z.strictObject({
  sourceId: id, startByte: z.number().int().min(0), endByte: z.number().int().positive(),
  quote: text(32000).refine(value => value.length > 0),
});
const assessment = z.strictObject({
  assessmentInputDigest: digest, configurationRevision: id,
  findings: z.array(z.strictObject({
    targetId: id, assessedSourceIds: z.array(id).min(1).max(32),
    relation: z.enum(['already-covered', 'partial', 'related-distinct', 'no-match-in-assessed-scope', 'insufficient-evidence']),
    overlapExplanation: text(3000).refine(value => value.trim().length > 0),
    missingScopeExplanation: text(3000).refine(value => value.trim().length > 0),
    citations: z.array(citation).min(1).max(64),
  })).max(32),
});
export const intentScopeAssessmentSchema = assessment;

/** Valid citations do NOT prove semantic quality, independence, newness or authority. */
export function validateIntentScopeAssessment(envelope: IntentEvidenceEnvelope, value: unknown, configurationRevision: string) {
  const result = assessment.parse(value);
  if (result.assessmentInputDigest !== envelope.assessmentInputDigest || result.configurationRevision !== configurationRevision) throw new Error('Stale assessment binding.');
  const sources = new Map(envelope.evidence.map(source => [source.sourceId, source]));
  const assessed = new Set<string>(), targets = new Set<string>();
  for (const finding of result.findings) {
    if (targets.has(finding.targetId)) throw new Error('Duplicate assessment target.');
    targets.add(finding.targetId);
    for (const sourceId of finding.assessedSourceIds) {
      const source = sources.get(sourceId);
      if (!source || source.targetId !== finding.targetId || assessed.has(sourceId)) throw new Error('Unknown or duplicated assessed source.');
      assessed.add(sourceId);
    }
    const cited = new Set<string>();
    for (const ref of finding.citations) {
      const source = sources.get(ref.sourceId);
      if (!source || !finding.assessedSourceIds.includes(ref.sourceId) || ref.startByte >= ref.endByte || ref.endByte > source.endByte) throw new Error('Invalid citation range or source.');
      let actual: string;
      // BOM is source content too. The default decoder silently strips it at
      // the start of ANY slice, rejecting exact quotes and accepting omissions.
      try { actual = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes(source.content).subarray(ref.startByte, ref.endByte)); }
      catch { throw new Error('Citation splits a UTF-8 character.'); }
      if (actual !== ref.quote) throw new Error('Citation does not match source bytes.');
      cited.add(ref.sourceId);
    }
    if (finding.assessedSourceIds.some(sourceId => !cited.has(sourceId))) throw new Error('Assessed source has no citation.');
  }
  const complete = envelope.coverage.complete && assessed.size === sources.size
    && result.findings.every(finding => finding.relation !== 'insufficient-evidence');
  return deepFreeze({ ...result, kind: 'steer-validated-scope-assessment/v1' as const,
    state: complete ? 'assessed-declared-scope' as const : 'incomplete' as const,
    unassessedSourceIds: [...sources.keys()].filter(sourceId => !assessed.has(sourceId)),
    authoritativeClearance: false as const });
}
