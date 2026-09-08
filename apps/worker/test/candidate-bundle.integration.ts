import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool, PoolClient } from 'pg';
import type { DatabasePool } from '@steer/data/runtime-pool';
import { createCandidateOriginalStore } from '@steer/data/candidate-originals';
import { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import { createDurableCandidateBundleStore } from '../src/candidate-bundle-runtime.ts';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createGitHubReader } from '@steer/adapters/github';
import { createCandidateBundleReader } from '@steer/adapters/candidate-bundle-reader';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { testCandidateSaveWorkflow } from './candidate-save.integration.ts';
import { testCandidateOriginals } from './candidate-originals.integration.ts';

export async function testDurableCandidateBundles({ app, admin, connect, check }: {
  app: Pool; admin: Pool; connect(user: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const cleanups: Array<() => void> = [];
  const setup = async () => {
    const git = fixture({ after: run => cleanups.push(run) }, 'candidate-bundle');
    const publication = { organizationId: binding.organizationId, productId: 'product', repository: 'github:52', branch: binding.branch,
      serviceCommitter: 'app:123', itemIds: ['0210-synthetic'], platformRevision: 'b'.repeat(40), gate2DecisionDigest: 'c'.repeat(64) };
    const execution = { organizationId: publication.organizationId, subject: 'synthetic-human', productId: publication.productId,
      repository: publication.repository, branch: publication.branch, action: 'candidate-save', budget: null,
      configurationRevision: 'candidate-save-r1', recordsPolicyDigest: 'd'.repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString() };
    const bundle = { organizationId: publication.organizationId, productId: publication.productId, repository: publication.repository,
      branch: publication.branch, itemId: publication.itemIds[0]!, bundleId: randomUUID(), purpose: 'new-candidate', previousBundleDigest: null,
      amendment: null, relationship: null, originatorSubject: execution.subject, serviceCommitter: publication.serviceCommitter,
      architectConfigurationRevision: 'architect-r1', examConfigurationRevision: 'exam-r1', editedDocuments: [],
      scopeInputDigest: 'a'.repeat(64), sourceSnapshotDigest: 'b'.repeat(64), assessmentDigest: 'c'.repeat(64), dispositionDigest: 'd'.repeat(64),
      specConformance: 'unreviewed', examReview: 'unreviewed', expectedHead: git.head(),
      documents: { brief: '# Synthetic Brief\n🌸\n', spec: '# Synthetic Spec\nAC-01\n', exam: '# Candidate Exam\nNOT RUN\n' } };
    const plan = await planCandidateBundle({ ...bundle, operationId: randomUUID() });
    const confirmation = { kind: 'steer-intent-save-binding/v1', organizationId: bundle.organizationId, productId: bundle.productId,
      subject: bundle.originatorSubject, draftId: randomUUID() as string, draftRevision: 1, repository: bundle.repository, branch: bundle.branch,
      item: `items/${bundle.itemId}`, expectedHead: bundle.expectedHead, bundleManifestDigest: plan.manifestDigest,
      scopeInputDigest: bundle.scopeInputDigest, sourceSnapshotDigest: bundle.sourceSnapshotDigest,
      assessmentDigest: bundle.assessmentDigest, dispositionDigest: bundle.dispositionDigest };
    const make = (overrides: { pool?: DatabasePool; proof?: (p: Record<string, unknown>) => unknown;
      authorizeOperation?: () => Promise<void>; authorizeRead?: () => Promise<void>; authorizeReconciliation?: () => Promise<void>;
      execution?: object; publication?: object } = {}) => {
      const store = createDurableCandidateBundleStore(overrides.pool ?? app, binding,
        { execution: { ...execution, ...overrides.execution }, publication: { ...publication, ...overrides.publication } }, {
          fetch: git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now,
          authorizeRead: overrides.authorizeRead ?? (async () => {}), authorizeOperation: overrides.authorizeOperation ?? (async () => {}),
          ...(overrides.authorizeReconciliation ? { authorizeReconciliation: overrides.authorizeReconciliation } : {}),
          evaluateDispatch: async p => {
            git.recordSyntheticApproval();
            const proof = { kind: 'steer-candidate-bundle-dispatch-proof/v1', operationId: p.request.bundle.operationId, inputDigest: p.plan.inputDigest,
              currentBinding: p.request.confirmation, authorizationRevision: p.plan.expectedHead, sourceReviewRevision: p.plan.expectedHead,
              lifecycleRevision: p.plan.expectedHead, lifecycle: p.plan.requiredLifecycle, platformRevision: publication.platformRevision,
              gate2DecisionDigest: publication.gate2DecisionDigest, evaluatedAt: now.toISOString(), validThrough: new Date(now.getTime() + 5000).toISOString() };
            return overrides.proof ? overrides.proof(proof) : proof;
          } });
      cleanups.push(() => store.close()); return store;
    };
    const prepare = async () => {
      const prepared = await make().prepare({ bundle, confirmation }); assert.equal(prepared.outcome, 'prepared');
      if (prepared.outcome !== 'prepared') throw new Error('Synthetic admission unavailable'); return prepared.request;
    };
    const state = async (operationId: string) => (await admin.query('SELECT record FROM steer_execution.intent_steps WHERE organization_id=$1 AND operation_id=$2',
      [binding.organizationId, operationId])).rows[0]?.record.state;
    return { git, bundle, confirmation, publication, execution, make, prepare, state };
  };
  try {
    await check('bundle admission mints one durable ID before receipt planning and refuses changed or caller-selected IDs', async () => {
      const f = await setup();
      const results = await Promise.all(Array.from({ length: 4 }, () => f.make({ pool: connect('steer_app') }).prepare({ bundle: f.bundle, confirmation: f.confirmation })));
      assert.ok(results.every(r => r.outcome === 'prepared'));
      const ids = results.map(r => r.outcome === 'prepared' ? r.request.bundle.operationId : ''); assert.equal(new Set(ids).size, 1);
      assert.notEqual(ids[0], '00000000-0000-4000-8000-000000000000'); assert.equal(f.git.calls.length, 0);
      assert.equal((await f.make().prepare({ bundle: f.bundle, confirmation: f.confirmation })).outcome, 'prepared');
      assert.equal((await f.make().prepare({ bundle: { ...f.bundle, architectConfigurationRevision: 'changed' }, confirmation: {
        ...f.confirmation, bundleManifestDigest: (await planCandidateBundle({ ...f.bundle, architectConfigurationRevision: 'changed', operationId: ids[0] })).manifestDigest,
      } })).outcome, 'conflict');
      await assert.rejects(f.make().prepare({ bundle: { ...f.bundle, operationId: ids[0] }, confirmation: f.confirmation }));
      const request = await f.prepare(), plan = await planCandidateBundle(request.bundle, request.confirmation);
      assert.ok(plan.files.at(-1)!.path.includes(request.bundle.operationId));
      assert.equal(JSON.parse(plan.files.at(-1)!.content).inputDigest, plan.inputDigest);
      const stored = (await admin.query('SELECT binding FROM steer_execution.intent_operations WHERE operation_id=$1', [ids[0]])).rows[0].binding;
      assert.notEqual(stored.inputDigest, plan.inputDigest); assert.equal(JSON.stringify(stored).includes('Synthetic Brief'), false);
    });
    await check('real PostgreSQL claims compose with native Git CAS for one seven-file save and exact three-document reopen', async () => {
      const f = await setup(), request = await f.prepare();
      const results = await Promise.all(Array.from({ length: 4 }, () => f.make({ pool: connect('steer_app') }).compareAndWrite(request)));
      assert.ok(results.some(r => r.outcome === 'committed')); assert.equal(f.git.mutations(), 1);
      assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed');
      const original = await f.make().inspect(request); assert.equal(original.outcome, 'committed');
      const before = f.git.calls.length;
      assert.deepEqual(await f.make().compareAndWrite(request), original); assert.equal(f.git.mutations(), 1);
      assert.equal(f.git.calls.slice(before).some(c => c.path === '/graphql'), false);
      const reader = createCandidateBundleReader(createGitHubReader(binding, { fetch: f.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now }),
        { organizationId: f.publication.organizationId, productId: f.publication.productId, repository: f.publication.repository,
          branch: binding.branch, itemIds: f.publication.itemIds }, async () => {});
      const saved = await reader.readPointer({ organizationId: f.publication.organizationId, productId: f.publication.productId,
        repository: f.publication.repository, branch: binding.branch, itemId: f.bundle.itemId, proposalId: null, revision: f.git.head() });
      assert.deepEqual(saved.documents, f.bundle.documents);
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_usage.model_reservations WHERE operation_id=$1', [request.bundle.operationId])).rows[0].n, 0);
    });
    await check('lost native Git acknowledgement recovers the original operation receipt without a second dispatch', async () => {
      const f = await setup(), request = await f.prepare(); f.git.loseAck();
      assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 1);
      assert.deepEqual(await f.prepare(), request);
      assert.equal((await f.make().inspect(request)).outcome, 'committed');
      assert.equal((await f.make().compareAndWrite(request)).outcome, 'committed'); assert.equal(f.git.mutations(), 1);
    });
    await check('provider rejection or a head race remains non-retryable after reconstruction despite an absent receipt', async () => {
      for (const race of [false, true]) {
        const f = await setup(), request = await f.prepare(); if (race) f.git.race(); else f.git.deny();
        assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 1);
        assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed');
        for (let i = 0; i < 2; i++) {
          const result = await f.make().compareAndWrite(request); assert.equal(result.outcome, 'unknown'); assert.equal(result.retryAuthorized, false);
        }
        assert.equal(f.git.mutations(), 1);
      }
    });
    await check('lost database dispatch acknowledgement cannot reach Git and reconstructed status cannot resend', async () => {
      const f = await setup(), request = await f.prepare();
      const uncertain: DatabasePool = { async connect() {
        const client = await app.connect(); let dispatch = false;
        return { query: async (sql: string, values?: unknown[]) => {
          const result = await client.query(sql, values);
          if (sql.startsWith('UPDATE steer_execution.intent_steps') && String(values?.[0]).includes('dispatch-committed')) dispatch = true;
          if (sql === 'COMMIT' && dispatch) throw new Error('Synthetic lost dispatch acknowledgement'); return result;
        }, release: (broken: boolean) => client.release(broken) } as PoolClient;
      } };
      assert.equal((await f.make({ pool: uncertain }).compareAndWrite(request)).outcome, 'unknown');
      assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed'); assert.equal(f.git.mutations(), 0);
      assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 0);
    });
    await check('missing current source, consent, lifecycle or gate proof cannot consume a durable dispatch', async () => {
      for (const patch of [{ sourceReviewRevision: 'f'.repeat(40) }, { gate2DecisionDigest: 'f'.repeat(64) },
        { lifecycle: 'candidate-not-pulled' }, { validThrough: now.toISOString() }, { inputDigest: 'f'.repeat(64) }]) {
        const f = await setup(), request = await f.prepare();
        assert.equal((await f.make({ proof: p => ({ ...p, ...patch }) }).compareAndWrite(request)).outcome, 'unknown');
        assert.equal(await f.state(request.bundle.operationId), undefined); assert.equal(f.git.mutations(), 0);
      }
    });
    await check('post-commit authorization loss withholds Git dispatch even though the durable step remains sent', async () => {
      const f = await setup(), request = await f.prepare(); let calls = 0;
      const store = f.make({ authorizeOperation: async () => { if (++calls === 6) throw new Error('Synthetic revocation'); } });
      assert.equal((await store.compareAndWrite(request)).outcome, 'unknown'); assert.equal(calls, 6);
      assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed'); assert.equal(f.git.mutations(), 0);
      assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 0);
    });
    await check('foreign owner, missing operation, changed configuration and stale consent stop before provider access', async () => {
      const f = await setup(), request = await f.prepare();
      await assert.rejects(f.make({ execution: { subject: 'foreign' } }).compareAndWrite(request));
      assert.equal((await f.make().compareAndWrite({ ...request, bundle: { ...request.bundle, operationId: randomUUID() } })).outcome, 'unknown');
      assert.equal((await f.make({ execution: { configurationRevision: 'changed' } }).compareAndWrite(request)).outcome, 'conflict');
      assert.equal((await f.make({ publication: { gate2DecisionDigest: 'e'.repeat(64) } }).compareAndWrite(request)).outcome, 'conflict');
      assert.equal((await f.make().compareAndWrite({ ...request, confirmation: { ...request.confirmation, draftRevision: 2 } })).outcome, 'conflict');
      assert.equal(f.git.calls.length, 0);
      assert.equal((await f.make({ authorizeRead: async () => { throw new Error('Synthetic revoked source'); } }).compareAndWrite(request)).outcome, 'unknown');
      assert.equal(f.git.calls.length, 0); assert.equal(await f.state(request.bundle.operationId), undefined);
      const store = f.make(); store.close(); assert.equal((await store.compareAndWrite(request)).outcome, 'unknown');
    });
    await check('receipt reconciliation needs its own grant, records verified success and replays idempotently without writing Git', async () => {
      const f = await setup(), request = await f.prepare(); assert.equal((await f.make().compareAndWrite(request)).outcome, 'committed');
      const before = f.git.calls.length;
      assert.equal((await f.make().reconcile(request)).outcome, 'unavailable'); assert.equal(f.git.calls.length, before);
      assert.equal((await f.make().inspect(request)).outcome, 'committed'); assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed');
      const result = await f.make({ authorizeReconciliation: async () => {} }).reconcile(request);
      assert.equal(result.outcome, 'recorded'); assert.equal(result.revision, f.git.head()); assert.equal(result.retryAuthorized, false);
      assert.equal(result.executionAuthorized, false); assert.equal(result.gateSigned, false);
      assert.equal(await f.state(request.bundle.operationId), 'succeeded');
      const row = (await admin.query('SELECT record,result_ref FROM steer_execution.intent_steps WHERE organization_id=$1 AND operation_id=$2', [binding.organizationId, request.bundle.operationId])).rows[0];
      assert.equal(row.record.resultDigest, result.resultDigest); assert.equal(row.result_ref, request.bundle.operationId);
      assert.equal(JSON.stringify(row).includes('Synthetic Brief'), false);
      const later = f.git.add([{ path: 'unrelated-later.md', content: 'Synthetic unrelated commit\n' }]); assert.notEqual(later, result.revision);
      assert.deepEqual(await f.make({ authorizeReconciliation: async () => {} }).reconcile(request), result);
      assert.equal((await f.make().compareAndWrite(request)).outcome, 'committed'); assert.equal(f.git.mutations(), 1);
    });
    await check('uncertain Git acknowledgement becomes a verified SQL checkpoint without another external send', async () => {
      const f = await setup(), request = await f.prepare(); f.git.loseAck();
      assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown');
      const result = await f.make({ authorizeReconciliation: async () => {} }).reconcile(request);
      assert.equal(result.outcome, 'recorded'); assert.equal(await f.state(request.bundle.operationId), 'succeeded'); assert.equal(f.git.mutations(), 1);
    });
    await check('absent or substituted provider receipts never promote SQL state or manufacture retry permission', async () => {
      for (const corrupt of [false, true]) {
        const f = await setup(), request = await f.prepare(); if (!corrupt) f.git.deny();
        await f.make().compareAndWrite(request);
        if (corrupt) f.git.add([{ path: `.steer/authoring/bundle-operations/${request.bundle.operationId}.json`, content: '{}\n' }]);
        const result = await f.make({ authorizeReconciliation: async () => {} }).reconcile(request);
        assert.equal(result.outcome, corrupt ? 'conflict' : 'unknown'); assert.equal(result.retryAuthorized, false);
        assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed'); assert.equal(f.git.mutations(), 1);
      }
    });
    await check('lost checkpoint COMMIT acknowledgement preserves the SQL result and fresh reconciliation never rewrites the save', async () => {
      const f = await setup(), request = await f.prepare(); await f.make().compareAndWrite(request);
      const uncertain: DatabasePool = { async connect() {
        const client = await app.connect(); let checkpoint = false;
        return { query: async (sql: string, values?: unknown[]) => {
          const result = await client.query(sql, values);
          if (sql.startsWith('UPDATE steer_execution.intent_steps') && String(values?.[0]).includes('succeeded')) checkpoint = true;
          if (sql === 'COMMIT' && checkpoint) throw new Error('Synthetic lost checkpoint acknowledgement'); return result;
        }, release: (broken: boolean) => client.release(broken) } as PoolClient;
      } };
      assert.equal((await f.make({ pool: uncertain, authorizeReconciliation: async () => {} }).reconcile(request)).outcome, 'unknown');
      assert.equal(await f.state(request.bundle.operationId), 'succeeded');
      assert.equal((await f.make({ authorizeReconciliation: async () => {} }).reconcile(request)).outcome, 'recorded'); assert.equal(f.git.mutations(), 1);
    });
    await check('reconciliation authority loss before SQL or before result release withholds a checkpoint acknowledgement', async () => {
      for (const revokeAt of [2, 3]) {
        const f = await setup(), request = await f.prepare(); await f.make().compareAndWrite(request); let calls = 0;
        const result = await f.make({ authorizeReconciliation: async () => { if (++calls === revokeAt) throw new Error('Synthetic reconciliation grant revoked'); } }).reconcile(request);
        assert.equal(result.outcome, 'unknown'); assert.equal(result.revision, null);
        assert.equal(await f.state(request.bundle.operationId), revokeAt === 2 ? 'dispatch-committed' : 'succeeded'); assert.equal(f.git.mutations(), 1);
      }
    });
    await check('closing reconciliation during an authority read cannot produce a late SQL success', async () => {
      const f = await setup(), request = await f.prepare(); await f.make().compareAndWrite(request);
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>(resolve => { entered = resolve; });
      const store = f.make({ authorizeReconciliation: async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); } });
      const pending = store.reconcile(request); await started; store.close(); release();
      assert.equal((await pending).outcome, 'unknown'); assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed');
      assert.equal((await store.reconcile(request)).outcome, 'unavailable'); assert.equal(f.git.mutations(), 1);
    });
    await check('reconciliation cannot erase a known failure or manually quarantined outcome even when Git has a receipt', async () => {
      for (const state of ['failed-known', 'outcome-unknown']) {
        const f = await setup(), request = await f.prepare(); await f.make().compareAndWrite(request);
        await admin.query("UPDATE steer_execution.intent_steps SET record=jsonb_set(record,'{state}',to_jsonb($3::text)) WHERE organization_id=$1 AND operation_id=$2",
          [binding.organizationId, request.bundle.operationId, state]);
        const before = f.git.calls.length;
        assert.equal((await f.make({ authorizeReconciliation: async () => {} }).reconcile(request)).outcome, 'unavailable');
        assert.equal(f.git.calls.length, before); assert.equal(await f.state(request.bundle.operationId), state);
      }
    });
    await check('an expired prefetched receipt proof cannot become a SQL checkpoint after delayed current authority checks', async () => {
      const f = await setup(), request = await f.prepare(); await f.make().compareAndWrite(request); let calls = 0, delayRead = false;
      const store = f.make({ authorizeReconciliation: async () => { if (++calls === 2) { await delay(3500); delayRead = true; } },
        authorizeRead: async () => { if (delayRead) { delayRead = false; await delay(1800); } } });
      assert.equal((await store.reconcile(request)).outcome, 'unknown'); assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed');
      assert.equal(f.git.mutations(), 1);
    });
    await check('timed-out reconciliation retains admission until the actual authority dependency drains', async () => {
      const f = await setup(), request = await f.prepare(); await f.make().compareAndWrite(request); let first = true, release!: () => void;
      const store = f.make({ authorizeReconciliation: async () => { if (first) { first = false; await new Promise<void>(resolve => { release = resolve; }); } } });
      assert.equal((await store.reconcile(request)).outcome, 'unknown');
      const before = f.git.calls.length;
      assert.equal((await store.reconcile(request)).outcome, 'unavailable'); assert.equal((await store.inspect(request)).outcome, 'unknown');
      assert.equal(f.git.calls.length, before); assert.equal(await f.state(request.bundle.operationId), 'dispatch-committed');
      release(); await new Promise(resolve => setImmediate(resolve));
      assert.equal((await store.reconcile(request)).outcome, 'recorded'); assert.equal(f.git.mutations(), 1);
    });
    await testCandidateOriginals(setup, admin, connect, check);
    await testCandidateSaveWorkflow(async () => {
      const f = await setup(), key = { keyId: `synthetic-${randomUUID()}`, bytes: randomBytes(32) };
      const { organizationId, subject, productId, repository, branch, configurationRevision, recordsPolicyDigest } = f.execution;
      const config = { organizationId, subject, productId, repository, branch, configurationRevision, recordsPolicyDigest };
      const lifecycles = () => createDraftLifecycleStore(connect('steer_draft_runtime'), config, { authorize: async () => {}, verifyHold: async () => {} });
      const creator = lifecycles();
      try {
        const created = await creator.create({ requestId: randomUUID() }); assert.equal(created.outcome, 'ok');
        if (created.outcome !== 'ok') throw new Error('Synthetic draft creation unavailable');
        f.confirmation.draftId = created.value.draftId;
      } finally { creator.close(); }
      const originals = () => createCandidateOriginalStore(connect('steer_draft_runtime'), config, {
        authorize: async () => {}, verifyOriginal: request => f.make().verifyOriginal(request),
        lifecycle: async ref => { const store = lifecycles(); try { return await store.lifecycle(ref); } finally { store.close(); } },
        keyForDraft: async (_ref, keyId) => { assert.ok(keyId === null || keyId === key.keyId); return key; },
      });
      return { ...f, prepare: async () => {
        const request = await f.prepare(), store = originals();
        try { assert.equal((await store.put(request)).outcome, 'stored'); } finally { store.close(); }
        return request;
      }, loadOriginal: async (target: unknown) => {
        const store = originals(); try { return await store.read(target); } finally { store.close(); }
      }, holdDraft: async () => {
        const store = lifecycles(); try {
          assert.equal((await store.hold({ draftId: f.confirmation.draftId, holdReference: randomUUID() })).outcome, 'ok');
        } finally { store.close(); }
      } };
    }, check);
  } finally { for (const cleanup of cleanups.reverse()) cleanup(); }
}
