import assert from 'node:assert/strict';
import type { Pool, PoolClient } from 'pg';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
import type { CandidateSavePreviewer, CandidateSavePreviewOutput } from '@steer/tool-registry/candidate-save-preview-contracts';
import type { IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { candidateSavePrepareInputSchema, verifyCandidateSavePrepare } from '@steer/tool-registry/candidate-save-prepare-contracts';
import { createRecordedCandidateSavePreparer } from '../src/runtime.ts';
import { createDurableCandidateBundleStore } from '../../worker/src/candidate-bundle-runtime.ts';
import { createCandidateOriginalStore } from '@steer/data/candidate-originals';
import type { DatabasePool } from '@steer/data/runtime-pool';
import { describeCandidateSavePreview } from '@steer/tool-registry/candidate-save-preview-contracts';
import { createApi } from '../src/app.ts';

/** Real SQL, actual 34-source SDK history and HTTP; authority/keys/provider
 * records are synthetic. This never calls a real model or code host. */
export async function testCandidateConfirmationWithHistory(f: Awaited<ReturnType<typeof scopeStepIntegrationFixture>>,
  drafts: IntentDraftService, previewer: CandidateSavePreviewer, preview: CandidateSavePreviewOutput, admin: Pool) {
  const input = candidateSavePrepareInputSchema.parse({ organizationId: f.config.organizationId, preview: preview.input,
    previewDigest: preview.previewDigest, confirmation: preview.proposedConfirmation, confirm: true });
  const binding = { organizationId: f.config.organizationId, repositoryId: Number(f.config.repository.split(':')[1]),
    installationId: 1, owner: 'synthetic', repository: 'fixture', branch: f.config.branch };
  const publication = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository,
    branch: f.config.branch, serviceCommitter: 'app:synthetic', itemIds: [preview.input.itemId], platformRevision: 'b'.repeat(40), gate2DecisionDigest: 'c'.repeat(64) };
  const execution = { ...f.config, configurationRevision: 'synthetic-candidate-save-r1', action: 'candidate-save', budget: null, expiresAt: new Date(Date.now() + 3600000).toISOString() };
  let loseAdmission = true, loseOriginal = true, denied = false, late = false, previewCalls = 0;
  const spy = (pool: DatabasePool, table: string, lose: () => boolean): DatabasePool => ({ async connect() {
    const c = await pool.connect(); let inserted = false;
    return { query: async (sql: string, values?: unknown[]) => {
      const result = await c.query(sql, values); if (sql.includes(`INSERT INTO ${table}`)) inserted = true;
      if (sql === 'COMMIT' && inserted && lose()) throw new Error('Synthetic lost acknowledgement'); return result;
    }, release: (broken: boolean) => c.release(broken) } as PoolClient;
  } });
  const pools = {
    execution: spy(f.pools.execution, 'steer_execution.intent_operations', () => { const value = loseAdmission; loseAdmission = false; return value; }),
    drafts: spy(f.pools.drafts, 'steer_drafts.candidate_originals', () => { const value = loseOriginal; loseOriginal = false; return value; }),
  };
  const records = { authorize: async () => { if (denied) throw new Error('PRIVATE records denial'); },
    lifecycle: f.lifecycle.lifecycle, keyForDraft: f.deps.records.originals.keyForDraft };
  const make = () => createRecordedCandidateSavePreparer(pools, binding, { records: f.config, execution }, publication, {
    drafts, previewer: { scope: previewer.scope, preview: async (...args) => {
      previewCalls++; if (late && previewCalls % 2 === 0) throw new Error('Synthetic late destination authority loss');
      return previewer.preview(...args);
    } },
    authorizeConfirmation: async (value, observed) => { assert.deepEqual(value, input); assert.deepEqual(observed, preview); },
    authorizeOperation: async () => {}, records,
  });
  const principal = { organizationId: f.config.organizationId, subject: f.config.subject, type: 'human', hats: [],
    toolGrants: ['intent.candidate.save.prepare'], expiresAt: new Date(Date.now() + 600000).toISOString() };
  const post = async () => {
    const service = make(), app = createApi({ authenticate: async () => principal, services: { candidateSavePreparer: service } });
    try {
      const response = await app.request('/v1/tools/intent.candidate.save.prepare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      assert.equal(response.status, 200, await response.clone().text());
      return verifyCandidateSavePrepare(input, await response.json());
    } finally { service.close(); }
  };
  const count = async (table: string) => (await admin.query(`SELECT count(*)::int AS n FROM ${table} WHERE organization_id=$1`, [f.config.organizationId])).rows[0].n;
  const before = { operations: await count('steer_execution.intent_operations'), steps: await count('steer_execution.intent_steps'), reservations: await f.reservations() };
  const first = await post(); assert.equal(first.outcome, 'unknown'); assert.equal(first.reference, null);
  assert.equal(await count('steer_execution.intent_operations'), before.operations + 1);
  assert.equal(await count('steer_drafts.candidate_originals'), 0);
  const second = await post(); assert.equal(second.outcome, 'unknown'); assert.ok(second.reference);
  assert.equal(await count('steer_drafts.candidate_originals'), 1);
  const row = async () => (await admin.query('SELECT * FROM steer_drafts.candidate_originals WHERE organization_id=$1', [f.config.organizationId])).rows[0];
  const encrypted = await row();
  assert.doesNotMatch(JSON.stringify(encrypted), /EXAM-MARKER-NOT-FOR-SCOPE|Current corrected Brief|originalText/);
  const third = await post(); assert.equal(third.outcome, 'prepared'); assert.deepEqual(third.reference, second.reference);
  assert.equal(third.originalPreserved, true); assert.equal(third.savedToGit, false); assert.equal(third.executionAuthorized, false);
  assert.deepEqual(await row(), encrypted);
  const described = await describeCandidateSavePreview(preview.input, preview.review, f.content.documents, preview.generation, preview.destination, publication.serviceCommitter);
  const deny = async () => { throw new Error('No provider access'); };
  const worker = createDurableCandidateBundleStore(f.pools.execution, binding, { execution, publication }, {
    fetch: deny, appJwt: deny, authorizeRead: deny, authorizeOperation: async () => {}, evaluateDispatch: deny });
  const originals = createCandidateOriginalStore(f.pools.drafts, f.config, { ...records, verifyOriginal: worker.verifyOriginal });
  try {
    const same = await worker.prepare(described.submission); assert.equal(same.outcome, 'prepared');
    if (same.outcome !== 'prepared') throw new Error('Expected worker admission');
    assert.equal(same.request.bundle.operationId, third.reference!.operationId);
    const original = await originals.read({ organizationId: f.config.organizationId, operationId: third.reference!.operationId, inputDigest: third.reference!.inputDigest });
    assert.deepEqual(original, same.request); assert.deepEqual(original.bundle.documents, f.content.documents);
    late = true; previewCalls = 0; const moved = await post(); assert.equal(moved.outcome, 'unknown'); assert.deepEqual(moved.reference, third.reference);
    late = false; denied = true; assert.equal((await post()).outcome, 'unknown');
    assert.equal(await count('steer_execution.intent_operations'), before.operations + 1);
    assert.equal(await count('steer_drafts.candidate_originals'), 1); assert.deepEqual(await row(), encrypted);
    assert.equal(await count('steer_execution.intent_steps'), before.steps); assert.equal(await f.reservations(), before.reservations);
  } finally { originals.close(); worker.close(); }
  console.log('PASS composed candidate confirmation: lost admission/original acknowledgements recover one exact encrypted original; API/worker IDs match; late authority loss withholds success; no dispatch or budget reservation');
  // A separate synthetic start phase must establish its own current authority.
  // Restoring this fixture grant does not schedule or dispatch the original.
  denied = false;
  return { binding, publication, execution, records, reference: third.reference! };
}
