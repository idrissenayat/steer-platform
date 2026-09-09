import { z } from 'zod';
import { intentRunDiscoveryInputSchema, intentRunDiscoveryOutputSchema, intentRunEntrySchema, intentRunCursorSchema, compareRunCursors } from './intent-run-discovery-contracts.ts';

const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
export const admissionCursorSchema = intentRunCursorSchema.extend({ bindingSetDigest: digest });
export const intentAdmissionInputSchema = intentRunDiscoveryInputSchema.extend({ cursor: admissionCursorSchema.nullable() });
const diagnostic = { originalRecord: z.enum(['present-metadata', 'not-observed']), executionExpired: z.boolean() };
export const intentAdmissionEntrySchema = z.discriminatedUnion('kind', [
  intentRunEntrySchema.options[0].extend(diagnostic), intentRunEntrySchema.options[1].extend(diagnostic),
]);
export const intentAdmissionOutputSchema = intentAdmissionInputSchema.extend({
  kind: z.literal('steer-admission-discovery/v1'), bindingSetDigest: digest, configuredExecutionCount: z.number().int().min(1).max(16),
  observedAt: z.iso.datetime({ precision: 3 }), useUntil: z.iso.datetime({ precision: 3 }),
  latest: intentRunDiscoveryOutputSchema.shape.latest, entries: z.array(intentAdmissionEntrySchema).max(10), nextCursor: admissionCursorSchema.nullable(),
  coverage: z.literal('configured-scope-and-development-bindings-only'), originalContentVerified: z.literal(false),
  executionState: z.literal('not-inspected'), retryAuthorized: z.literal(false), executionAuthorized: z.literal(false), savedToGit: z.literal(false), gateSigned: z.literal(false),
}).superRefine((value, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Invalid admission diagnostics.' });
  if (Date.parse(value.useUntil) <= Date.parse(value.observedAt) || (value.cursor && (value.cursor.bindingSetDigest !== value.bindingSetDigest
    || value.cursor.latestRevisionDigest !== value.latest.revisionDigest))) fail();
  let previous = value.cursor;
  const revisions = new Map<number, string>(), identities = new Set<string>();
  for (const entry of value.entries) {
    const cursor = { revision: entry.source.revision, kind: entry.kind, runId: entry.kind === 'scope' ? entry.reviewId : entry.operationId,
      latestRevisionDigest: value.latest.revisionDigest, bindingSetDigest: value.bindingSetDigest };
    const source = JSON.stringify(entry.source);
    const identity = `${entry.kind}:${cursor.runId}`;
    if (identities.has(identity)) fail(); identities.add(identity);
    if (entry.source.revision > value.latest.revision || (entry.source.revision === value.latest.revision && source !== JSON.stringify(value.latest))
      || (previous && compareRunCursors(cursor, previous) >= 0) || (revisions.has(entry.source.revision) && revisions.get(entry.source.revision) !== source)) fail();
    revisions.set(entry.source.revision, source); previous = cursor;
  }
  if (value.nextCursor && (value.entries.length !== 10 || JSON.stringify(value.nextCursor) !== JSON.stringify(previous))) fail();
});
export type IntentAdmissionInput = z.infer<typeof intentAdmissionInputSchema>;
export type IntentAdmissionOutput = z.infer<typeof intentAdmissionOutputSchema>;
export type IntentAdmissionEntry = z.infer<typeof intentAdmissionEntrySchema>;
export interface IntentAdmissionDiscovery {
  readonly scope: Readonly<Pick<IntentAdmissionInput, 'organizationId' | 'productId' | 'repository'> & { subject: string }>;
  discover(input: IntentAdmissionInput, current: () => Promise<void>): Promise<unknown>;
}
export function verifyIntentAdmissionDiscovery(raw: unknown, result: unknown): IntentAdmissionOutput {
  const input = intentAdmissionInputSchema.parse(raw), output = intentAdmissionOutputSchema.parse(result);
  if ((Object.keys(input) as Array<keyof typeof input>).some(k => JSON.stringify(input[k]) !== JSON.stringify(output[k]))) throw new Error('Admission diagnostics changed.');
  return output;
}
