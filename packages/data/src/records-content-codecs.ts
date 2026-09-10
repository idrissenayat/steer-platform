import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { describeIntentDraftRevision } from '@steer/tool-registry/intent-draft-content';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { draftRevisionCodec } from './draft-revisions.ts';
import { scopeOriginalCodec } from './scope-review-originals.ts';
import { developmentOriginalCodec, developmentRecordsConfigurationSchema } from './development-originals.ts';
import { developmentResultCodec } from './development-results.ts';
import { developmentObservationCodec } from './development-observations.ts';
import { scopeObservationCodec } from './scope-review-observations.ts';
import { candidateOriginalCodec } from './candidate-originals.ts';
import { describeScopeOriginal } from './scope-original-contracts.ts';
import { describeDevelopmentOriginal, developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';
import { draftEnvelopeSchema, openDraft, type DraftKey } from './draft-envelope.ts';
import { scopeOriginalEnvelopeSchema, openScopeOriginal } from './scope-original-envelope.ts';
import type { RecordsReadSetSnapshot } from './records-readset.ts';

const codecs = Object.freeze({ revisions: draftRevisionCodec, scope_originals: scopeOriginalCodec,
  development_originals: developmentOriginalCodec, development_results: developmentResultCodec,
  development_observations: developmentObservationCodec, scope_observations: scopeObservationCodec, candidate_originals: candidateOriginalCodec });
export type EncryptedRecordGroup = keyof typeof codecs;
export const encryptedRecordGroups = Object.freeze(Object.keys(codecs) as EncryptedRecordGroup[]);
type Configuration = z.infer<typeof developmentRecordsConfigurationSchema>;
type Row = Readonly<Record<string, unknown>>;
type Metadata<G extends EncryptedRecordGroup> = z.infer<(typeof codecs)[G]['metadata']>;
type Values = {
  revisions: z.infer<typeof draftRevisionCodec.payload>;
  scope_originals: Awaited<ReturnType<typeof describeScopeOriginal>>['original'];
  development_originals: Awaited<ReturnType<typeof describeDevelopmentOriginal>>['original'];
  development_results: z.infer<typeof developmentResultCodec.payload>;
  development_observations: z.infer<typeof developmentObservationCodec.payload>;
  scope_observations: z.infer<typeof scopeObservationCodec.payload>;
  candidate_originals: z.infer<typeof candidateOriginalCodec.payload>;
};
export type EncodedRecord = { [G in EncryptedRecordGroup]: Readonly<{ group: G; index: number; row: Row;
  metadata: Metadata<G>; envelope: unknown; keyId: string; aad: string }> }[EncryptedRecordGroup];
export type DecodedRecordGroups = { [G in EncryptedRecordGroup]: readonly Readonly<{ row: Row; metadata: Metadata<G>; value: Values[G] }>[] };
export type DecodedRecordContents = Readonly<{ decoded: DecodedRecordGroups; plaintextRows: number;
  sdkVerified: false; sourcePermissionsVerified: false; executionAuthorized: false; gateSigned: false }>;
const fail = () => new Error('Record contents could not be verified.');
const object = (raw: unknown): Row => { if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail(); return raw as Row; };
const time = (raw: unknown) => { const value = raw instanceof Date ? raw.getTime() : typeof raw === 'string' ? Date.parse(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < 0) throw fail(); return value; };
// JSONB can reorder object keys. Stored cryptographic hashes still use their
// original canonical codecs; structural readback equality must not rehash JSONB.
const equal = (actual: unknown, expected: unknown) => { if (!isDeepStrictEqual(actual, expected)) throw fail(); };
const columns = { organizationId: 'organization_id', subject: 'subject', productId: 'product_id', draftId: 'draft_id',
  operationId: 'operation_id', reviewId: 'review_id', stepId: 'step_id', batchId: 'batch_id', stage: 'stage',
  payloadDigest: 'payload_digest', resultRef: 'result_ref' } as const;

/** Pure canonical metadata/envelope inspection. Neither this plan nor a digest
 * proves permission to obtain keys or disclose recovered content. */
export function inspectEncryptedRecords(snapshot: RecordsReadSetSnapshot, rawConfiguration: unknown): readonly EncodedRecord[] {
  try {
    const config = developmentRecordsConfigurationSchema.parse(rawConfiguration), configurationDigest = hash(config), records: EncodedRecord[] = [];
    for (const group of encryptedRecordGroups) for (const [index, row] of snapshot.data[group].entries()) {
      const codec = codecs[group], metadata = group === 'candidate_originals' ? candidateOriginalCodec.metadata.parse({
        organizationId: row.organization_id, subject: row.subject, productId: row.product_id, operationId: row.operation_id,
        draftId: row.draft_id, draftRevision: Number(row.draft_revision), inputDigest: row.input_digest, payloadDigest: row.payload_digest,
        configurationDigest: row.configuration_digest, createdAt: time(row.draft_created_at), retentionDeadline: time(row.retention_deadline),
      }) : codec.metadata.parse(row.record);
      const fields = metadata as Row;
      for (const [field, column] of Object.entries(columns)) if (field in fields && fields[field] !== row[column]) throw fail();
      if (metadata.organizationId !== config.organizationId || metadata.subject !== config.subject || metadata.productId !== config.productId
        || metadata.draftId !== snapshot.target.draftId || ('draftConfigurationDigest' in metadata ? metadata.draftConfigurationDigest : metadata.configurationDigest) !== configurationDigest) throw fail();
      if ('revision' in metadata) {
        if (metadata.revision !== Number(row.revision) || metadata.mutationId !== row.mutation_id || metadata.commandDigest !== row.command_digest
          || metadata.parentRevision !== metadata.revision - 1 || (metadata.parentRevision === 0) !== (metadata.parentDigest === null)
          || metadata.sourceRevision > metadata.revision || metadata.draftCreatedAt !== new Date(time(snapshot.lifecycle.created_at)).toISOString()
          || draftRevisionCodec.revisionDigest(metadata) !== row.revision_digest) throw fail();
      } else if (metadata.draftRevision !== Number(row.draft_revision)) throw fail();
      if (group === 'development_originals' && fields.inputDigest !== row.input_digest) throw fail();
      if (group === 'scope_originals' && fields.preparationDigest !== row.preparation_digest) throw fail();
      if (group === 'development_results' && developmentResultCodec.resultDigest(metadata as Metadata<'development_results'>) !== row.result_digest) throw fail();
      if ('retentionDeadline' in metadata && metadata.retentionDeadline !== metadata.createdAt + 7 * 86400000) throw fail();
      const envelope = group === 'scope_originals' ? scopeOriginalEnvelopeSchema.parse(row.encrypted_value) : draftEnvelopeSchema.parse(row.encrypted_value);
      const keyId = 'chunks' in envelope ? envelope.chunks[0]!.keyId : envelope.keyId;
      if ('chunks' in envelope && envelope.chunks.some(chunk => chunk.keyId !== keyId)) throw fail();
      records.push(freeze({ group, index, row, metadata, envelope, keyId, aad: Reflect.apply(codec.aad, codec, [metadata]) }) as EncodedRecord);
    }
    return freeze(records);
  } catch { throw fail(); }
}

/** Pure local decoding with already-authorized key copies. Full current key,
 * records and source/SDK verification belongs to the enclosing owned read. */
export async function decodeRecordContents(snapshot: RecordsReadSetSnapshot, rawConfiguration: unknown, records: readonly EncodedRecord[],
  keyFor: (record: EncodedRecord) => DraftKey, check: () => void): Promise<DecodedRecordContents> {
  try {
    const config = developmentRecordsConfigurationSchema.parse(rawConfiguration), decoded = Object.fromEntries(encryptedRecordGroups.map(group => [group, []])) as unknown as {
      [G in EncryptedRecordGroup]: Array<{ row: Row; metadata: Metadata<G>; value: Values[G] }> };
    // Reject a forged, omitted, reordered or changed plan rather than trusting a caller's metadata.
    equal(records, inspectEncryptedRecords(snapshot, config));
    const configMatches = (other: Configuration) => { for (const field of Object.keys(config) as (keyof Configuration)[]) if (other[field] !== config[field]) throw fail(); };
    for (const record of records) {
      check(); const raw = record.group === 'scope_originals' ? openScopeOriginal(record.envelope, record.aad, keyFor(record)) : openDraft(record.envelope, record.aad, keyFor(record));
      check();
      if (record.group === 'revisions') {
        const value = draftRevisionCodec.payload.parse(raw); if (hash(value) !== record.metadata.contentDigest) throw fail();
        const described = await describeIntentDraftRevision({ ...config, draftId: record.metadata.draftId }, value, { content: value, sourceRevision: record.metadata.sourceRevision }); check();
        if (described.scopeInputDigest !== record.metadata.scopeInputDigest) throw fail(); decoded.revisions.push({ row: record.row, metadata: record.metadata, value });
      } else if (record.group === 'scope_originals') {
        const described = await describeScopeOriginal(raw); check(); const value = described.original; configMatches(value.configuration);
        const expected = scopeOriginalCodec.metadata.parse({ ...record.metadata, draftId: described.manifest.draftId, draftRevision: described.manifest.draftRevision,
          draftRevisionDigest: value.source.revisionDigest, scopeInputDigest: described.manifest.scopeInputDigest,
          preparationDigest: described.manifest.preparationDigest, executionConfigurationDigest: hash(value.configuration), payloadDigest: described.payloadDigest });
        equal(expected, record.metadata);
        const run = snapshot.data.scope_runs.find(row => row.review_id === record.metadata.reviewId); if (!run) throw fail(); equal(described.manifest, run.manifest);
        decoded.scope_originals.push({ row: record.row, metadata: record.metadata, value });
      } else if (record.group === 'development_originals') {
        const described = await describeDevelopmentOriginal(raw); check(); const value = described.original; configMatches(value.configuration);
        equal(developmentOriginalCodec.metadata.parse({ ...record.metadata, inputDigest: described.inputDigest, draftId: value.source.draftId,
          draftRevision: value.source.revision, draftRevisionDigest: value.source.revisionDigest, scopeInputDigest: value.source.scopeInputDigest,
          executionConfigurationDigest: hash(value.configuration) }), record.metadata); decoded.development_originals.push({ row: record.row, metadata: record.metadata, value });
      } else if (record.group === 'development_results') {
        const value = developmentResultCodec.payload.parse(raw); if (value.role !== record.metadata.stepId || hash(value) !== record.metadata.outputDigest) throw fail();
        decoded.development_results.push({ row: record.row, metadata: record.metadata, value });
      } else if (record.group === 'development_observations' || record.group === 'scope_observations') {
        const value = record.group === 'development_observations' ? developmentObservationCodec.payload.parse(raw) : scopeObservationCodec.payload.parse(raw);
        if (Buffer.byteLength(JSON.stringify(value)) > 786432 || value.stage !== record.metadata.stage || hash(value) !== record.metadata.payloadDigest
          || record.metadata.requestDigest !== (value.stage === 'response' ? value.requestDigest : null)
          || record.metadata.outputDigest !== (value.stage === 'response' ? hash(value.result) : null)) throw fail();
        if (value.stage === 'response') {
          const u = value.usage; if (u.inputTokens !== null && u.outputTokens !== null && u.totalTokens !== null && u.inputTokens + u.outputTokens !== u.totalTokens) throw fail();
          if ('stepId' in record.metadata && value.result.role !== record.metadata.stepId) throw fail();
          if ('batchId' in record.metadata && (!('batchId' in value.result) || value.result.batchId !== record.metadata.batchId)) throw fail();
        }
        if (record.group === 'development_observations') decoded.development_observations.push({ row: record.row, metadata: record.metadata, value: value as Values['development_observations'] });
        else decoded.scope_observations.push({ row: record.row, metadata: record.metadata, value: value as Values['scope_observations'] });
      } else {
        const value = candidateOriginalCodec.payload.parse(raw), plan = await planCandidateBundle(value.bundle, value.confirmation); check();
        for (const field of ['organizationId', 'productId', 'repository', 'branch'] as const) if (value.bundle[field] !== config[field]) throw fail();
        if (value.bundle.originatorSubject !== config.subject || value.bundle.operationId !== record.metadata.operationId
          || value.confirmation.draftId !== record.metadata.draftId || value.confirmation.draftRevision !== record.metadata.draftRevision
          || plan.inputDigest !== record.metadata.inputDigest || hash(value) !== record.metadata.payloadDigest) throw fail();
        decoded.candidate_originals.push({ row: record.row, metadata: record.metadata, value });
      }
    }
    // One typed snapshot replaces recursive original -> draft reconstruction.
    for (const record of decoded.scope_originals) {
      const source = record.value.source, draft = decoded.revisions.find(d => d.metadata.revision === source.revision); if (!draft) throw fail();
      if (draft.row.revision_digest !== source.revisionDigest || draft.metadata.scopeInputDigest !== record.metadata.scopeInputDigest
        || draft.metadata.sourceRevision !== source.scope.sourceRevision) throw fail();
      equal({ originalText: draft.value.originalText, clarificationTurns: draft.value.clarificationTurns,
        documents: draft.value.documents ? { brief: draft.value.documents.brief, spec: draft.value.documents.spec } : null },
      { originalText: source.scope.originalText, clarificationTurns: source.scope.clarificationTurns, documents: source.scope.documents });
    }
    for (const record of decoded.development_originals) {
      const source = record.value.source, draft = decoded.revisions.find(d => d.metadata.revision === source.revision); if (!draft) throw fail();
      if (draft.row.revision_digest !== source.revisionDigest || draft.metadata.scopeInputDigest !== source.scopeInputDigest || draft.metadata.sourceRevision !== source.sourceRevision) throw fail();
      equal(draft.value, source.content);
    }
    for (const result of decoded.development_results) {
      const original = decoded.development_originals.find(record => record.metadata.operationId === result.metadata.operationId); if (!original) throw fail();
      const source = original.value.source, m = result.metadata;
      if (m.configurationDigest !== hash(original.value.configuration) || m.inputDigest !== original.metadata.inputDigest || m.draftId !== source.draftId
        || m.draftRevision !== source.revision || m.draftRevisionDigest !== source.revisionDigest || m.scopeInputDigest !== source.scopeInputDigest) throw fail();
    }
    for (const group of ['development_observations', 'scope_observations'] as const) for (const record of decoded[group]) {
      if (record.value.stage !== 'response') continue;
      const request = decoded[group].find(r => r.metadata.stage === 'request' && ('operationId' in r.metadata
        ? 'operationId' in record.metadata && r.metadata.operationId === record.metadata.operationId && r.metadata.stepId === record.metadata.stepId
        : 'reviewId' in record.metadata && r.metadata.reviewId === record.metadata.reviewId && r.metadata.batchId === record.metadata.batchId));
      if (!request || request.metadata.payloadDigest !== record.value.requestDigest) throw fail();
      const step = group === 'development_observations'
        ? snapshot.data.steps.find(row => 'operationId' in record.metadata && row.operation_id === record.metadata.operationId && row.step_id === record.metadata.stepId)
        : snapshot.data.scope_batches.find(row => 'reviewId' in record.metadata && row.review_id === record.metadata.reviewId && row.batch_id === record.metadata.batchId);
      if (!step) throw fail(); const state = object(step.record), binding = object(state.binding);
      for (const observed of [request, record]) if (observed.metadata.owner !== state.owner || observed.metadata.fencingToken !== state.fencingToken
        || observed.metadata.reservationId !== state.reservationId || observed.metadata.stepInputDigest !== binding.inputDigest) throw fail();
    }
    check(); return freeze({ decoded, plaintextRows: records.length, sdkVerified: false, sourcePermissionsVerified: false, executionAuthorized: false, gateSigned: false });
  } catch { throw fail(); }
}
