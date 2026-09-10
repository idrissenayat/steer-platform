import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { draftRevisionMetadataSchema } from '../../../packages/data/src/draft-revisions.ts';
import { scopeOriginalMetadataSchema } from '../../../packages/data/src/scope-review-originals.ts';
import { developmentOriginalMetadataSchema } from '../../../packages/data/src/development-originals.ts';
import { describeScopeOriginal } from '../../../packages/data/src/scope-original-contracts.ts';
import { describeDevelopmentOriginal } from '../../../packages/data/src/development-original-contracts.ts';
import { openScopeOriginal } from '../../../packages/data/src/scope-original-envelope.ts';
import { openDraft, type DraftKey } from '../../../packages/data/src/draft-envelope.ts';
import { scopeReviewObservationSchema } from '../../../packages/data/src/scope-review-observations.ts';
import { developmentObservationSchema } from '../../../packages/data/src/development-observations.ts';
import { renderDevelopmentRequest } from '../../../packages/data/src/development-requests.ts';
import { intentRoleResultSchema } from '@steer/tool-registry/intent-role-result';
import { createRecordedMastraVerifier, createRecordedScopeMastraVerifier } from '@steer/agents/recorded-mastra';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import type { readRecordsReadsetPrototype } from '../../../packages/data/test/records-readset-prototype.ts';

type Snapshot = Awaited<ReturnType<typeof readRecordsReadsetPrototype>>;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// TEST ONLY canonical field ordering for private metadata codecs. Hash/AEAD and
// original SDK verifiers detect disagreement; these are not production exports.
const ordered = (row: any, fields: string) => {
  const names = fields.split(' '); assert.deepEqual(Object.keys(row).sort(), [...names].sort());
  return Object.fromEntries(names.map(name => [name, row[name]]));
};
const observationPrefix = 'organizationId subject productId';
const observationSuffix = 'stage draftId draftRevision configurationDigest owner fencingToken reservationId stepInputDigest payloadDigest requestDigest outputDigest';
const resultFields = 'organizationId subject productId operationId stepId inputDigest stepInputDigest draftId draftRevision draftRevisionDigest scopeInputDigest configurationDigest draftConfigurationDigest owner fencingToken reservationId predecessorResultDigest outputDigest resultRef';

/** Decode each distinct encrypted row once, preserving original crypto/SDK
 * verification. No principal, current policy, admission or expiry is proven here. */
export async function decodeRecordsReadsetPrototype(snapshot: Snapshot, keys: Map<string, DraftKey>, profiles: Parameters<typeof createRecordedMastraVerifier>[0]) {
  const decoded: Record<string, any[]> = {}, counts = { plaintextRows: 0, scopeSdkExchanges: 0, developmentSdkExchanges: 0 };
  const keyFor = (row: any) => { const id = row.encrypted_value.keyId ?? row.encrypted_value.chunks[0].keyId;
    const key = keys.get(JSON.stringify([row.draft_id, id])); assert.ok(key); return key; };
  for (const group of ['revisions', 'scope_originals', 'development_originals', 'development_results', 'development_observations', 'scope_observations', 'candidate_originals']) {
    decoded[group] = [];
    for (const row of snapshot.data[group]!) {
      const key = keyFor(row); let metadata: any, label: string, value: any;
      if (group === 'revisions') { metadata = draftRevisionMetadataSchema.parse(row.record); label = 'steer-draft-revision-content/v1';
        assert.equal(hash(['steer-draft-revision/v1', metadata]), row.revision_digest); }
      else if (group === 'scope_originals') { metadata = scopeOriginalMetadataSchema.parse(row.record); label = 'steer-scope-original-content/v1'; }
      else if (group === 'development_originals') { metadata = developmentOriginalMetadataSchema.parse(row.record); label = 'steer-development-original-content/v1'; }
      else if (group === 'development_results') { metadata = ordered(row.record, resultFields); label = 'steer-development-result-content/v1';
        assert.equal(hash(['steer-development-result/v1', metadata]), row.result_digest); }
      else if (group === 'development_observations') { metadata = ordered(row.record, `${observationPrefix} operationId inputDigest stepId ${observationSuffix}`); label = 'steer-development-observation/v1'; }
      else if (group === 'scope_observations') { metadata = ordered(row.record, `${observationPrefix} reviewId preparationDigest batchId ${observationSuffix}`); label = 'steer-scope-observation/v1'; }
      else { metadata = { organizationId: row.organization_id, subject: row.subject, productId: row.product_id,
        operationId: row.operation_id, draftId: row.draft_id, draftRevision: Number(row.draft_revision), inputDigest: row.input_digest,
        payloadDigest: row.payload_digest, configurationDigest: row.configuration_digest,
        createdAt: Date.parse(row.draft_created_at), retentionDeadline: Date.parse(row.retention_deadline) }; label = 'steer-candidate-original/v1'; }
      const aad = JSON.stringify([label, metadata]);
      for (const [field, column] of Object.entries({ organizationId: 'organization_id', subject: 'subject', productId: 'product_id',
        draftId: 'draft_id', operationId: 'operation_id', reviewId: 'review_id', stepId: 'step_id', batchId: 'batch_id',
        stage: 'stage', inputDigest: 'input_digest', payloadDigest: 'payload_digest', preparationDigest: 'preparation_digest' })) {
        if (field in metadata && column in row) assert.equal(metadata[field], row[column]);
      }
      if ('draftRevision' in metadata) assert.equal(metadata.draftRevision, Number(row.draft_revision));
      value = group === 'scope_originals' ? openScopeOriginal(row.encrypted_value, aad, key) : openDraft(row.encrypted_value, aad, key);
      if (group === 'revisions') assert.equal(hash(value), metadata.contentDigest);
      if (group === 'scope_originals') { const described = await describeScopeOriginal(value); value = described.original;
        assert.equal(described.payloadDigest, row.payload_digest); assert.equal(described.manifest.preparationDigest, row.preparation_digest);
        assert.deepEqual(described.manifest, snapshot.data.scope_runs!.find(r => r.review_id === row.review_id)!.manifest); }
      if (group === 'development_originals') { const described = await describeDevelopmentOriginal(value); value = described.original;
        assert.equal(described.inputDigest, row.input_digest); }
      if (group === 'development_results') { value = intentRoleResultSchema.parse(value); assert.equal(hash(value), metadata.outputDigest); }
      if (group.endsWith('_observations')) { value = group === 'scope_observations' ? scopeReviewObservationSchema.parse(value) : developmentObservationSchema.parse(value);
        assert.equal(hash(value), metadata.payloadDigest); assert.equal(row.payload_digest, metadata.payloadDigest); }
      if (group === 'candidate_originals') { assert.equal(hash(value), row.payload_digest);
        const plan = await planCandidateBundle(value.bundle, value.confirmation); assert.equal(plan.inputDigest, row.input_digest); }
      decoded[group]!.push({ row, metadata, value }); counts.plaintextRows++;
    }
  }
  for (const original of decoded.scope_originals!) {
    const draft = decoded.revisions!.find(r => r.metadata.revision === original.value.source.revision); assert.ok(draft);
    assert.equal(draft.row.revision_digest, original.value.source.revisionDigest);
    assert.equal(draft.metadata.scopeInputDigest, original.metadata.scopeInputDigest);
    const verifier = await createRecordedScopeMastraVerifier({ scope: original.value.source.scope, evidence: original.value.evidence, profile: original.value.profile });
    const rows = decoded.scope_observations!.filter(r => r.row.review_id === original.row.review_id);
    for (const request of rows.filter(r => r.value.stage === 'request')) {
      const response = rows.find(r => r.row.batch_id === request.row.batch_id && r.value.stage === 'response'); assert.ok(response);
      assert.equal(response.value.requestDigest, request.metadata.payloadDigest);
      const wire = { adapterRevision: request.value.adapterRevision, protocol: request.value.protocol, requestBody: request.value.requestBody };
      verifier.verifyRequest(request.row.batch_id, wire); verifier.verify(request.row.batch_id, wire, {
        responseBody: response.value.responseBody, providerRequestId: response.value.providerRequestId,
        usage: response.value.usage, result: response.value.result }); counts.scopeSdkExchanges++;
      const step = snapshot.data.scope_batches!.find(r => r.review_id === original.row.review_id && r.batch_id === request.row.batch_id)!;
      assert.equal(step.record.state, 'succeeded'); assert.equal(step.record.resultDigest, response.metadata.payloadDigest);
    }
  }
  const verifier = createRecordedMastraVerifier(profiles);
  for (const original of decoded.development_originals!) {
    const draft = decoded.revisions!.find(r => r.metadata.revision === original.value.source.revision); assert.ok(draft);
    assert.equal(draft.row.revision_digest, original.value.source.revisionDigest); assert.deepEqual(draft.value, original.value.source.content);
    for (const role of ['architect', 'test-agent'] as const) {
      const rows = decoded.development_observations!.filter(r => r.row.operation_id === original.row.operation_id && r.row.step_id === role);
      const request = rows.find(r => r.value.stage === 'request'), response = rows.find(r => r.value.stage === 'response'); assert.ok(request && response);
      assert.equal(response.value.requestDigest, request.metadata.payloadDigest);
      const priorResult = decoded.development_results!.find(r => r.row.operation_id === original.row.operation_id && r.row.step_id === 'architect');
      const priorStep = snapshot.data.steps!.find(r => r.operation_id === original.row.operation_id && r.step_id === 'architect');
      const predecessor = role === 'architect' ? null : { checkpoint: { binding: priorStep!.record.binding,
        resultRef: priorResult!.row.result_ref, resultDigest: priorResult!.row.result_digest,
        recordsPolicyDigest: original.value.configuration.recordsPolicyDigest }, result: priorResult!.value };
      const prepared = await renderDevelopmentRequest({ original: original.value, operationId: original.row.operation_id, role, predecessor });
      assert.deepEqual(prepared.rendered, request.value.rendered);
      verifier.verify(role, prepared.rendered.request, request.value, response.value); counts.developmentSdkExchanges++;
      const result = decoded.development_results!.find(r => r.row.operation_id === original.row.operation_id && r.row.step_id === role)!;
      assert.deepEqual(response.value.result, result.value);
      const step = snapshot.data.steps!.find(r => r.operation_id === original.row.operation_id && r.step_id === role)!;
      assert.equal(step.record.state, 'succeeded'); assert.equal(step.record.resultDigest, result.row.result_digest);
      assert.equal(step.record.binding.inputDigest, prepared.stepReference.stepInputDigest);
      assert.equal(step.predecessor_result_digest, prepared.stepReference.predecessorResultDigest);
      assert.equal(step.result_ref, result.row.result_ref);
      if (role === 'test-agent') { const prior = decoded.development_results!.find(r => r.row.operation_id === original.row.operation_id && r.row.step_id === 'architect')!;
        assert.equal(result.metadata.predecessorResultDigest, prior.row.result_digest); }
    }
  }
  return { decoded, counts };
}
