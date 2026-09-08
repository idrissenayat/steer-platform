/** Deterministic, content-free Temporal values. Authority and draft bytes stay in activities. */
export interface CandidateSaveTarget { organizationId: string; operationId: string; inputDigest: string }
export interface CandidateSaveResult {
  operationId: string; inputDigest: string; outcome: 'committed' | 'unknown' | 'conflict' | 'not-found'; revision: string | null;
}
export interface CandidateSaveWorkflowActivities { saveCandidateBundle(target: CandidateSaveTarget): Promise<CandidateSaveResult> }
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === 'string' && v.length === 36 && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && v.length === 64 && /^[a-f0-9]{64}$/.test(v);
export function parseCandidateSaveTarget(v: unknown): CandidateSaveTarget {
  if (!exact(v, ['organizationId', 'operationId', 'inputDigest']) || typeof v.organizationId !== 'string'
    || v.organizationId.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(v.organizationId) || /\s/.test(v.organizationId)
    || !uuid(v.operationId) || !digest(v.inputDigest)) throw new Error('Invalid candidate save reference.');
  return Object.freeze({ organizationId: v.organizationId, operationId: v.operationId, inputDigest: v.inputDigest });
}
export function candidateSaveWorkflowId(raw: unknown) {
  const v = parseCandidateSaveTarget(raw);
  // Input drift must not create a second workflow identity for the same operation.
  return `steer-candidate-save/v1/${encodeURIComponent(v.organizationId)}/${v.operationId}`;
}
export function parseCandidateSaveResult(raw: unknown, target: CandidateSaveTarget): CandidateSaveResult {
  if (!exact(raw, ['operationId', 'inputDigest', 'outcome', 'revision']) || raw.operationId !== target.operationId || raw.inputDigest !== target.inputDigest
    || !['committed', 'unknown', 'conflict', 'not-found'].includes(raw.outcome as string)
    || (raw.outcome === 'committed' ? typeof raw.revision !== 'string' || raw.revision.length !== 40 || !/^[a-f0-9]{40}$/.test(raw.revision) : raw.revision !== null))
    throw new Error('Invalid candidate save result.');
  return Object.freeze({ operationId: target.operationId, inputDigest: target.inputDigest,
    outcome: raw.outcome as CandidateSaveResult['outcome'], revision: raw.revision as string | null });
}
