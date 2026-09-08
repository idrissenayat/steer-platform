/** Pure transaction planning only. No storage, model calls or dispatch authority. */
export interface IntentStepBinding {
  organizationId: string;
  operationId: string;
  stepId: string;
  subject: string;
  draftId: string;
  draftRevision: number;
  inputDigest: string;
  configurationRevision: string;
}
export interface IntentStepRecord {
  binding: IntentStepBinding;
  state: 'unclaimed' | 'claimed' | 'dispatch-committed' | 'outcome-unknown' | 'succeeded' | 'failed-known';
  fencingToken: number;
  owner: string | null;
  reservationId: string | null;
  leaseUntil: number | null;
  updatedAt: number;
  resultDigest: string | null;
}
export type IntentStepEvent =
  | { type: 'claim'; owner: string; reservationId: string; leaseMs: number }
  | { type: 'commit-dispatch'; owner: string; fencingToken: number }
  | { type: 'checkpoint'; owner: string; fencingToken: number; resultDigest: string }
  | { type: 'known-failure'; owner: string; fencingToken: number }
  | { type: 'outcome-unknown'; fencingToken: number };

function requireId(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\uD800-\uDFFF]/u.test(value)) throw new Error('Invalid step identifier.');
}
function requireDigest(value: string) { if (!/^[a-f0-9]{64}(?![\s\S])/.test(value)) throw new Error('Invalid step digest.'); }
function requireTime(value: number) { if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid step clock.'); }
const bindingKeys = ['organizationId', 'operationId', 'stepId', 'subject', 'draftId', 'draftRevision', 'inputDigest', 'configurationRevision'] as const;
function requireBindingKeys(binding: IntentStepBinding) {
  if (!binding || typeof binding !== 'object' || Object.keys(binding).length !== bindingKeys.length
    || Object.keys(binding).some(key => !(bindingKeys as readonly string[]).includes(key))) throw new Error('Unexpected step binding fields.');
}

export function newIntentStep(binding: IntentStepBinding, now: number): IntentStepRecord {
  requireBindingKeys(binding);
  for (const value of [binding.organizationId, binding.operationId, binding.stepId, binding.subject,
    binding.draftId, binding.configurationRevision]) requireId(value);
  requireDigest(binding.inputDigest); requireTime(now);
  if (!Number.isSafeInteger(binding.draftRevision) || binding.draftRevision < 1) throw new Error('Invalid draft revision.');
  return Object.freeze({ binding: Object.freeze({ ...binding }), state: 'unclaimed', fencingToken: 0,
    owner: null, reservationId: null, leaseUntil: null, updatedAt: now, resultDigest: null });
}

export function assertIntentStepBinding(record: IntentStepRecord, requested: IntentStepBinding) {
  requireBindingKeys(record.binding); requireBindingKeys(requested);
  if (bindingKeys.some(key => record.binding[key] !== requested[key])) throw new Error('Step binding changed.');
}

/**
 * The adapter must CAS the exact previous state/fencing token. For claim, it must
 * also insert/reuse the unique reservation in that SAME budget-locked transaction.
 * Only a newly applied commit-dispatch transition with an unambiguous DB COMMIT
 * acknowledgement permits dispatch. Planning a transition, reading its state,
 * retrying a command, or an unknown COMMIT acknowledgement NEVER permits a call.
 */
export function planIntentStepTransition(record: IntentStepRecord, requested: IntentStepBinding, event: IntentStepEvent, now: number): IntentStepRecord {
  assertIntentStepBinding(record, requested); requireTime(now);
  if (now < record.updatedAt) throw new Error('Step clock regressed.');
  const next = { ...record, binding: Object.freeze({ ...record.binding }), updatedAt: now };
  if (event.type === 'claim') {
    requireId(event.owner); requireId(event.reservationId);
    if (!Number.isSafeInteger(event.leaseMs) || event.leaseMs < 1 || event.leaseMs > 300000
      || !Number.isSafeInteger(now + event.leaseMs)) throw new Error('Invalid claim lease.');
    if (record.state !== 'unclaimed' && !(record.state === 'claimed' && record.leaseUntil !== null && now >= record.leaseUntil)) throw new Error('Step cannot be claimed or reassigned.');
    if (record.reservationId !== null && event.reservationId !== record.reservationId) throw new Error('A takeover must reuse its reservation.');
    if (!Number.isSafeInteger(record.fencingToken + 1)) throw new Error('Fencing token exhausted.');
    return Object.freeze({ ...next, state: 'claimed', owner: event.owner, reservationId: event.reservationId,
      fencingToken: record.fencingToken + 1, leaseUntil: now + event.leaseMs });
  }
  if (event.fencingToken !== record.fencingToken || !record.reservationId) throw new Error('Stale step owner.');
  if (event.type === 'outcome-unknown') {
    if (record.state !== 'dispatch-committed') throw new Error('Step has no uncertain dispatch to quarantine.');
    return Object.freeze({ ...next, state: 'outcome-unknown', leaseUntil: null });
  }
  if (event.owner !== record.owner) throw new Error('Stale step owner.');
  if (event.type === 'commit-dispatch') {
    if (record.state !== 'claimed' || record.leaseUntil === null || now >= record.leaseUntil) throw new Error('Step cannot cross the dispatch boundary.');
    return Object.freeze({ ...next, state: 'dispatch-committed', leaseUntil: null });
  }
  if (record.state !== 'dispatch-committed') throw new Error('Step outcome cannot be published or replayed.');
  if (event.type === 'checkpoint') {
    requireDigest(event.resultDigest);
    return Object.freeze({ ...next, state: 'succeeded', resultDigest: event.resultDigest });
  }
  if (event.type === 'known-failure') return Object.freeze({ ...next, state: 'failed-known' });
  throw new Error('Unknown step transition.');
}

/** Versioned, unambiguous Temporal identity; metadata references, never source text. */
export function intentDevelopmentWorkflowId(organizationId: string, draftId: string, operationId: string) {
  for (const value of [organizationId, draftId, operationId]) requireId(value);
  return `steer-intent-development/v1/${[organizationId, draftId, operationId].map(value => encodeURIComponent(value)).join('/')}`;
}
