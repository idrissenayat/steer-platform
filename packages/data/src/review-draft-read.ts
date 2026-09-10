import { developmentOriginalHash as hash } from './development-original-contracts.ts';
import { intentDraftReadInputSchema } from '@steer/tool-registry/intent-draft-contracts';

type Reader = { scope: unknown; read: Function };
type Read = () => Promise<unknown>;
type Invoke = (reader: Reader, input: unknown, fallback: Read) => Promise<unknown>;
declare const brand: unique symbol;
export type ReviewDraftRead = Readonly<{ [brand]: never }>;
const reads = new WeakMap<ReviewDraftRead, Invoke>();
const fail = () => new Error('Review draft read is unavailable.');
const register = (invoke: Invoke): ReviewDraftRead => {
  const token = Object.freeze({}) as ReviewDraftRead; reads.set(token, invoke); return token;
};

/** Private lexical loan from an already-owned draft phase, not a permission or
 * ambient/request cache. The enclosing owner must keep the loan read-only and
 * perform complete final native validation after every dependent review closes. */
export function lendReviewDraftRead(reader: Reader, raw: unknown, read: Read, guard: () => void): ReviewDraftRead {
  const input = hash(intentDraftReadInputSchema.parse(raw)), method = reader.read, scope = reader.scope, digest = hash(scope);
  return register(async (consumer, rawInput, fallback) => {
    guard(); if (reader.read !== method || reader.scope !== scope || hash(scope) !== digest) throw fail();
    const same = consumer === reader && hash(intentDraftReadInputSchema.parse(rawInput)) === input;
    const value = await (same ? read() : fallback());
    guard(); if (reader.read !== method || reader.scope !== scope || hash(scope) !== digest) throw fail();
    return value;
  });
}

/** Each nested review adds its own lifetime, failure and actual-work ownership.
 * Copying a token or wrapping a public service cannot create a loan. */
export function forwardReviewDraftRead(token: ReviewDraftRead | undefined, run: (work: Read) => Promise<unknown>): ReviewDraftRead | undefined {
  const invoke = token && reads.get(token);
  return invoke ? register((reader, input, fallback) => run(() => invoke(reader, input, fallback))) : undefined;
}

export function readReviewDraft(token: ReviewDraftRead | undefined, reader: Reader, input: unknown, fallback: Read): Promise<unknown> {
  const invoke = token && reads.get(token);
  return invoke ? invoke(reader, input, fallback) : fallback();
}
