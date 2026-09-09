import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { DatabasePool } from '@steer/data/runtime-pool';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
import type { testCandidateConfirmationWithHistory } from './candidate-save-prepare.integration.ts';
import type { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';
import type { testConfirmedNativeCandidateSave } from '../../worker/test/native-candidate-save.integration.ts';
import { createDurableCandidateBundleStore } from '../../worker/src/candidate-bundle-runtime.ts';
import { createRecordedCandidatePublicationRecorder } from '../src/runtime.ts';
import { now } from '../../../packages/adapters/test/github-brief-fixture.ts';

/** Final phase of the joined native Git/SQL/SDK/Temporal scenario, AFTER retained
 * history checks. Clock authority and records adoption are explicitly synthetic.
 * The stable fixture timestamp is not a claim about provider commit time. */
export async function testCandidatePublication(f: Awaited<ReturnType<typeof scopeStepIntegrationFixture>>,
  confirmed: Awaited<ReturnType<typeof testCandidateConfirmationWithHistory>>, native: ReturnType<typeof nativeCandidateJourneyFixture>,
  saved: Awaited<ReturnType<typeof testConfirmedNativeCandidateSave>>, admin: Pool) {
  const { binding, publication, execution, records } = confirmed, { input, receipt } = saved;
  const deny = async () => { throw new Error('No provider mutation allowed'); };
  const verifier = createDurableCandidateBundleStore(f.pools.execution, binding, { execution, publication }, {
    fetch: deny, appJwt: deny, authorizeRead: deny, authorizeOperation: async () => {}, evaluateDispatch: deny });
  const row = async () => (await admin.query('SELECT * FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2',
    [f.config.organizationId, f.draftId])).rows[0];
  const originals = async () => (await admin.query('SELECT * FROM steer_drafts.candidate_originals WHERE organization_id=$1', [f.config.organizationId])).rows;
  const snapshot = async () => (await admin.query(`SELECT
    (SELECT count(*) FROM steer_execution.intent_operations WHERE organization_id=$1) AS operations,
    (SELECT count(*) FROM steer_drafts.candidate_originals WHERE organization_id=$1) AS originals,
    (SELECT count(*) FROM steer_usage.model_reservations WHERE organization_id=$1) AS reservations`, [f.config.organizationId])).rows[0];
  const before = await row(), encrypted = await originals(), counts = await snapshot(), head = native.git.head();
  assert.equal(before.published_at, null, 'Status, checkpoint and exact reopen must not silently record publication');
  let lose = true, updates = 0, clockCalls = 0, allowed = false, clockDrift = false;
  const clock = new Date(Number((await admin.query('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms')).rows[0].clock_ms)).toISOString();
  const pool: DatabasePool = { async connect() {
    const client = await f.pools.drafts.connect(); let publicationUpdated = false;
    return { query: async (sql: string, values?: unknown[]) => {
      const result = await client.query(sql, values);
      if (sql.includes('UPDATE steer_drafts.draft_lifecycles SET published_at')) { publicationUpdated = true; updates++; }
      if (sql === 'COMMIT' && publicationUpdated && lose) { lose = false; throw new Error('PRIVATE lost publication acknowledgement'); }
      return result;
    }, release: (broken: boolean) => client.release(broken) } as PoolClient;
  } };
  const make = () => createRecordedCandidatePublicationRecorder(pool, binding, f.config, publication, {
    records: { ...records, verifyOriginal: verifier.verifyOriginal },
    provider: { fetch: native.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now, authorizeRead: async () => {} },
    authorizeRecord: async context => {
      assert.deepEqual(context, { configuration: f.config, input }); if (!allowed) throw new Error('PRIVATE synthetic records denied');
    },
    verifyPublicationClock: async context => {
      assert.deepEqual(context, { configuration: f.config, input, receipt }); clockCalls++;
      return { configuration: f.config, input, reference: receipt.reference, confirmationDigest: receipt.confirmationDigest,
        publishedAt: clockDrift ? new Date(Date.parse(clock) + 1).toISOString() : clock };
    },
  });
  const run = async () => { const recorder = make(); try { return await recorder.record(input, async () => {}); } finally { recorder.close(); } };
  try {
    assert.deepEqual(await run(), { outcome: 'unavailable' }); assert.equal(clockCalls, 0); assert.equal(updates, 0);
    assert.deepEqual(await row(), before); allowed = true;
    assert.deepEqual(await run(), { outcome: 'unknown' }); assert.equal(lose, false); assert.equal(updates, 1);
    const recorded = await row(); assert.equal(recorded.published_at.toISOString(), clock);
    assert.equal(recorded.publication_operation, input.operationId); assert.equal(recorded.publication_input, input.inputDigest);
    assert.equal(recorded.use_until.getTime(), Math.min(before.use_until.getTime(), Date.parse(clock) + 60000));
    assert.equal(recorded.created_at.getTime(), before.created_at.getTime()); assert.equal(recorded.retention_deadline.getTime(), before.retention_deadline.getTime());
    const recovered = await run(); assert.equal(recovered.outcome, 'ok'); if (recovered.outcome !== 'ok') throw new Error('Expected publication recovery');
    assert.deepEqual(recovered, { outcome: 'ok', reference: receipt.reference, publishedAt: clock,
      useUntil: recorded.use_until.toISOString(), held: false, expired: false });
    assert.deepEqual(await row(), recorded); assert.equal(updates, 2);
    clockDrift = true; assert.deepEqual(await run(), { outcome: 'conflict' }); assert.deepEqual(await row(), recorded); clockDrift = false;
    assert.equal(updates, 2, 'Changed clock cannot renew the immutable publication timestamp');
    const after = await originals(); assert.equal(after.length, encrypted.length);
    for (let i = 0; i < after.length; i++) {
      const { use_until: beforeUse, ...originalBytes } = encrypted[i], { use_until: afterUse, ...retainedBytes } = after[i];
      assert.deepEqual(retainedBytes, originalBytes); assert.equal(afterUse.getTime(), recorded.use_until.getTime()); assert.ok(afterUse <= beforeUse);
    }
    const hold = await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() }); assert.equal(hold.outcome, 'ok');
    const held = await row(); assert.equal(held.held, true); assert.equal(held.use_until.getTime(), recorded.use_until.getTime());
    const previousClockCalls = clockCalls; assert.deepEqual(await run(), { outcome: 'unavailable' }); assert.equal(clockCalls, previousClockCalls);
    assert.deepEqual(await row(), held); assert.equal(updates, 2);
    assert.deepEqual(await snapshot(), counts); assert.equal(native.git.head(), head); assert.equal(native.git.mutations(), 1);
    console.log('PASS joined publication records: original-bound native receipt plus stable synthetic clock, lost SQL acknowledgement and reconstructed recovery, no expiry renewal, no repeated Git save, immutable encrypted payload and sticky hold denial');
  } finally { verifier.close(); }
}
