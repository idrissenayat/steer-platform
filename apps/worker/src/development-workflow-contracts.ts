import { parseCandidateSaveTarget } from './candidate-save-contracts.ts';

/** Reference-only protocol. No draft, model settings, grant or credential enters history. */
export interface DevelopmentTarget { organizationId: string; operationId: string; inputDigest: string }
export type DevelopmentRole = 'architect' | 'test-agent';
export interface DevelopmentStepTarget extends DevelopmentTarget { role: DevelopmentRole }
export interface DevelopmentStepResult {
  kind: 'steer-development-step-outcome/v1'; operationId: string; inputDigest: string; role: DevelopmentRole;
  outcome: 'succeeded' | 'needs-clarification' | 'superseded' | 'attention-required' | 'busy';
  resultRef: string | null; resultDigest: string | null;
  gateSigned: false; executionAuthorized: false; retryAuthorized: false;
}
export interface DevelopmentWorkflowActivities { developIntentStep(target: DevelopmentStepTarget): Promise<DevelopmentStepResult> }
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const role = (v: unknown): v is DevelopmentRole => v === 'architect' || v === 'test-agent';
const uuid = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/.test(v);
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}(?![\s\S])/.test(v);
export function parseDevelopmentTarget(raw: unknown): DevelopmentTarget {
  // Shared identifier validation only; no candidate-save behavior or authority.
  try { return parseCandidateSaveTarget(raw); } catch { throw new Error('Invalid development reference.'); }
}
export function developmentWorkflowId(raw: unknown) {
  const target = parseDevelopmentTarget(raw);
  // Revision drift cannot create a second workflow identity for the operation.
  return `steer-development/v1/${encodeURIComponent(target.organizationId)}/${target.operationId}`;
}
export function parseDevelopmentStepTarget(raw: unknown): DevelopmentStepTarget {
  if (!exact(raw, ['organizationId', 'operationId', 'inputDigest', 'role']) || !role(raw.role)) throw new Error('Invalid development reference.');
  return Object.freeze({ ...parseDevelopmentTarget({ organizationId: raw.organizationId, operationId: raw.operationId, inputDigest: raw.inputDigest }), role: raw.role });
}
export function parseDevelopmentStepResult(raw: unknown, target: DevelopmentStepTarget): DevelopmentStepResult {
  if (!exact(raw, ['kind', 'operationId', 'inputDigest', 'role', 'outcome', 'resultRef', 'resultDigest', 'gateSigned', 'executionAuthorized', 'retryAuthorized'])
    || raw.kind !== 'steer-development-step-outcome/v1' || raw.operationId !== target.operationId || raw.inputDigest !== target.inputDigest || raw.role !== target.role
    || !['succeeded', 'needs-clarification', 'superseded', 'attention-required', 'busy'].includes(raw.outcome as string)
    || raw.gateSigned !== false || raw.executionAuthorized !== false || raw.retryAuthorized !== false
    || (raw.outcome === 'needs-clarification' && target.role !== 'architect')) throw new Error('Invalid development result.');
  const checkpoint = ['succeeded', 'needs-clarification', 'superseded'].includes(raw.outcome as string);
  if (checkpoint ? !uuid(raw.resultRef) || !digest(raw.resultDigest) : raw.resultRef !== null || raw.resultDigest !== null) throw new Error('Invalid development result.');
  return Object.freeze({ kind: 'steer-development-step-outcome/v1', operationId: target.operationId, inputDigest: target.inputDigest, role: target.role,
    outcome: raw.outcome as DevelopmentStepResult['outcome'], resultRef: raw.resultRef as string | null, resultDigest: raw.resultDigest as string | null,
    gateSigned: false, executionAuthorized: false, retryAuthorized: false });
}
