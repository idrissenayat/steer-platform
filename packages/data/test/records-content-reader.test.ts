import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { scopeReviewFixture } from '../../tool-registry/test/intent-scope-review.fixture.ts';
import { describeIntentDraftRevision } from '../../tool-registry/src/intent-draft-content.ts';
import { draftRevisionCodec } from '../src/draft-revisions.ts';
import { scopeOriginalCodec } from '../src/scope-review-originals.ts';
import { describeScopeOriginal } from '../src/scope-original-contracts.ts';
import { developmentOriginalHash as hash } from '../src/development-original-contracts.ts';
import { sealDraft } from '../src/draft-envelope.ts';
import { sealScopeOriginal } from '../src/scope-original-envelope.ts';
import { createRecordsContentReader, type RecordsKeyServices, type RecordsContentLease } from '../src/records-content-reader.ts';
import { inspectEncryptedRecords, decodeRecordContents, encryptedRecordGroups } from '../src/records-content-codecs.ts';
import type { RecordsReadSetAuthority, RecordsReadSetGroup, RecordsReadSetSnapshot } from '../src/records-readset.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';
import { recordsReadsetGroups } from './records-readset-prototype.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const deferred = () => { let resolve = () => {}; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise<void>(r => setImmediate(r));

test('content startReadSet drain waits for an outstanding key lookup after the result is cancelled', async () => {
  const f = await fixture(), reader = f.owner(), gate = deferred(), reached = deferred(), signal = new AbortController();
  f.onKey(async () => { reached.resolve(); await gate.promise; });
  const read = reader.startReadSet(f.target, async () => {}, async lease => { await lease.recheck(); }, signal.signal);
  const rejected = assert.rejects(read.result); let drained = false; void read.drained.then(() => { drained = true; });
  try {
    await reached.promise; signal.abort(); await rejected; await tick(); assert.equal(drained, false);
    gate.resolve(); await read.drained; assert.equal(drained, true);
    assert.deepEqual(f.key.bytes, f.originalKey, 'Provider-owned bytes remain untouched.');
  } finally { gate.resolve(); await reader.shutdown(); f.key.bytes.fill(0); }
});
async function fixture() {
  const f = await scopeReviewFixture(2);
  const config = { organizationId: f.scope.organizationId, subject: 'synthetic-human', productId: f.scope.productId,
    repository: f.scope.repository, branch: f.evidence.branch, configurationRevision: 'test-r1', recordsPolicyDigest: 'a'.repeat(64) };
  const target = { draftId: f.scope.draftId, operationIds: [randomUUID()], reviewIds: [randomUUID()], revisions: [1], budgetId: randomUUID() };
  const key = { keyId: 'fixture-key', bytes: randomBytes(32) }, originalKey = Buffer.from(key.bytes);
  const owner = { organization_id: config.organizationId, subject: config.subject, product_id: config.productId };
  const header = { ...owner, draft_id: target.draftId, configuration_digest: hash(config), held: false,
    created_at: new Date(Date.now() - 10000).toISOString(), use_until: new Date(Date.now() + 60000).toISOString(), clock_ms: Date.now() };
  const content = { originalText: f.scope.originalText, clarificationTurns: f.scope.clarificationTurns,
    documents: { ...f.scope.documents, exam: '# Exam only, not in scope input.' } };
  const described = await describeIntentDraftRevision({ ...config, draftId: target.draftId }, content, null);
  const revision = draftRevisionCodec.metadata.parse({ organizationId: config.organizationId, subject: config.subject, productId: config.productId,
    draftId: target.draftId, revision: 1, mutationId: randomUUID(), commandDigest: 'b'.repeat(64), parentRevision: 0, parentDigest: null,
    sourceRevision: 1, contentDigest: hash(described.content), scopeInputDigest: described.scopeInputDigest,
    configurationDigest: hash(config), draftCreatedAt: header.created_at });
  const execution = { ...config, expiresAt: new Date(Date.now() + 60000).toISOString(),
    budget: { organizationId: config.organizationId, subject: config.subject, configurationRevision: config.configurationRevision,
      budgetId: target.budgetId, approvalDigest: 'b'.repeat(64), capMicrousd: 30, architectMicrousd: 3, testAgentMicrousd: 2 },
    scopeTerms: { approvalDigest: 'c'.repeat(64), profileDigest: f.prepared.batches[0]!.packet.profileDigest, amountMicrousd: 4 } };
  const scope = await describeScopeOriginal({ kind: 'steer-scope-original/v1', configuration: execution,
    source: { revision: 1, revisionDigest: draftRevisionCodec.revisionDigest(revision), scope: f.scope }, evidence: f.evidence, profile: f.profile });
  const sm = scopeOriginalCodec.metadata.parse({ organizationId: config.organizationId, subject: config.subject, productId: config.productId,
    reviewId: target.reviewIds[0], preparationDigest: scope.manifest.preparationDigest, draftId: target.draftId, draftRevision: 1,
    draftRevisionDigest: draftRevisionCodec.revisionDigest(revision), scopeInputDigest: described.scopeInputDigest,
    configurationDigest: hash(config), executionConfigurationDigest: hash(scope.original.configuration), payloadDigest: scope.payloadDigest });
  const data = Object.fromEntries(recordsReadsetGroups.map(({ name }) => [name, []])) as unknown as Record<RecordsReadSetGroup, any[]>;
  data.revisions = [{ ...owner, draft_id: target.draftId, revision: 1, mutation_id: revision.mutationId, command_digest: revision.commandDigest,
    revision_digest: draftRevisionCodec.revisionDigest(revision), record: revision, encrypted_value: sealDraft(described.content, draftRevisionCodec.aad(revision), key) }];
  data.latest_revision = [{ ...owner, revision: 1 }];
  data.scope_originals = [{ ...owner, draft_id: target.draftId, draft_revision: 1, review_id: target.reviewIds[0],
    preparation_digest: sm.preparationDigest, payload_digest: sm.payloadDigest, record: sm, encrypted_value: sealScopeOriginal(scope.original, scopeOriginalCodec.aad(sm), key) }];
  data.operations = [{ organization_id: config.organizationId, subject: config.subject, draft_id: target.draftId, operation_id: target.operationIds[0] }];
  data.scope_runs = [{ ...owner, draft_id: target.draftId, review_id: target.reviewIds[0], manifest: scope.manifest }];
  for (const group of ['budget', 'scope_terms'] as const) data[group] = [{ organization_id: config.organizationId, subject: config.subject, budget_id: target.budgetId }];
  let keyCalls = 0, now = 100, beforeKey: (() => Promise<void>) | undefined, beforePolicy: ((group: string) => Promise<void>) | undefined;
  const events: string[] = [], queries: string[] = [];
  const authority: RecordsReadSetAuthority = { async authorize() { return { permissionsRevision: 'fixture-r1' }; },
    records: Object.fromEntries(recordsReadsetGroups.map(({ name }) => [name, async () => {}])) as unknown as RecordsReadSetAuthority['records'] };
  const provider = { async keyForDraft(reference: unknown, keyId: string) {
    assert.deepEqual(reference, { ...config, draftId: target.draftId }); assert.equal(keyId, key.keyId);
    keyCalls++; events.push('key'); await beforeKey?.(); return key;
  } };
  const services = Object.fromEntries(encryptedRecordGroups.map(group => [group, { provider, async authorize(context: any) {
    assert.equal(this, services[group]); assert.equal(context.group, group); assert.equal(context.keyId, key.keyId);
    assert.ok(Object.isFrozen(context.metadata)); events.push(group); await beforePolicy?.(group);
  } }])) as unknown as RecordsKeyServices;
  const pools = Object.fromEntries((['drafts', 'execution'] as const).map(role => [role, { async connect() {
    const actor = role === 'drafts' ? 'steer_draft_runtime' : 'steer_app';
    return { async query(sql: string) {
      queries.push(sql);
      if (sql.includes('FROM pg_roles')) return { rows: [{ rolname: actor, login_role: actor, rolsuper: false, rolbypassrls: false, owns_objects: false }] };
      if (sql.includes('FROM steer_drafts.draft_lifecycles')) return { rows: [clone(header)] };
      if (sql.startsWith('WITH requested')) return { rows: [{ clock_ms: header.clock_ms, data: Object.fromEntries(Object.entries(data)
        .filter(([name]) => sql.includes(`'${name}',`)).map(([name, rows]) => [name, clone(rows).map(row => {
          if (sql.includes(" - 'encrypted_value'")) delete row.encrypted_value; return row;
        })])) }] };
      return { rows: [] };
    }, release() {} } as unknown as PoolClient;
  } } as DatabasePool])) as { drafts: DatabasePool; execution: DatabasePool };
  return { config, target, key, originalKey, header, data, content, scope, services, provider, events, queries,
    owner: () => createRecordsContentReader(pools, config, authority, services, { monotonicNow: () => now }),
    keyCalls: () => keyCalls, onKey: (v: typeof beforeKey) => { beforeKey = v; }, onPolicy: (v: typeof beforePolicy) => { beforePolicy = v; },
    clock: (v: number) => { now = v; }, snapshot: () => ({ data: clone(data), target, lifecycle: header, digest: 'synthetic', keys: [], plaintextVerified: false }) as RecordsReadSetSnapshot };
}
const consume = async (lease: RecordsContentLease) => { await lease.recheck(); return lease.contents; };
const current = async () => {};

test('the enclosing final caller revalidation retains the content lease until public return', async () => {
  const f = await fixture(), owner = f.owner(); let check = () => {};
  try {
    const result = await owner.withReadSet(f.target, async () => { check(); }, async lease => {
      check = lease.check; return consume(lease);
    });
    assert.equal(result.value.plaintextRows, 2); assert.throws(check);
  } finally { await owner.shutdown(); }
});

test('canonical content reader preserves exact bytes, separate authority flags and per-purpose grants with one shared key', async () => {
  const f = await fixture(), owner = f.owner();
  try {
    const result = await owner.withReadSet(f.target, current, consume);
    assert.deepEqual(result.value.decoded.revisions[0]!.value, f.content);
    assert.deepEqual(result.value.decoded.scope_originals[0]!.value, f.scope.original);
    assert.equal(result.value.plaintextRows, 2); assert.equal(result.value.sdkVerified, false); assert.equal(result.value.sourcePermissionsVerified, false);
    assert.ok(Object.isFrozen(result.value.decoded.revisions[0]!.value));
    assert.deepEqual(f.events, ['revisions', 'scope_originals', 'key', 'revisions', 'scope_originals', 'key']);
    assert.equal(result.metrics.physicalKeyReads, 2); assert.equal(result.metrics.keyPolicyChecks, 4); assert.equal(result.metrics.statements, 51);
    await owner.withReadSet(f.target, current, consume); assert.equal(f.keyCalls(), 4); assert.deepEqual(f.key.bytes, f.originalKey);
  } finally { await owner.shutdown(); }
});

test('same key ID on independent providers is not shared; each purpose must be granted before any lookup', async () => {
  const f = await fixture(), otherKey = { keyId: f.key.keyId, bytes: randomBytes(32) }; let otherCalls = 0;
  f.data.scope_originals[0].encrypted_value = sealScopeOriginal(f.scope.original, scopeOriginalCodec.aad(f.data.scope_originals[0].record), otherKey);
  f.services.scope_originals.provider = { async keyForDraft() { otherCalls++; return otherKey; } };
  const owner = f.owner();
  try { await owner.withReadSet(f.target, current, consume); assert.equal(f.keyCalls(), 2); assert.equal(otherCalls, 2); }
  finally { await owner.shutdown(); }
  const denied = await fixture(); denied.onPolicy(async group => { if (group === 'scope_originals') throw new Error('private denial'); });
  const blocked = denied.owner(); try { await assert.rejects(blocked.withReadSet(denied.target, current, consume)); assert.equal(denied.keyCalls(), 0); }
  finally { await blocked.shutdown(); }
});

test('JSONB key ordering does not change canonical stored hashes or decoded content', async () => {
  const f = await fixture();
  const reorder = (value: any): any => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  for (const group of Object.keys(f.data) as RecordsReadSetGroup[]) f.data[group] = reorder(f.data[group]);
  const owner = f.owner(); try { const result = await owner.withReadSet(f.target, current, consume);
    assert.deepEqual(result.value.decoded.scope_originals[0]!.value, f.scope.original); }
  finally { await owner.shutdown(); }
});

test('owned key copies are wiped on success and late failure while provider buffers stay untouched', async () => {
  for (const deny of [false, true]) {
    const f = await fixture(), owner = f.owner(), copies: Uint8Array[] = [], from = Buffer.from;
    // Test-only observation of copies of this one synthetic provider-owned buffer.
    Buffer.from = function(...args: any[]) { const bytes = Reflect.apply(from, Buffer, args);
      if (args[0] === f.key.bytes) copies.push(bytes); return bytes;
    } as typeof Buffer.from;
    try {
      const work = owner.withReadSet(f.target, current, async lease => {
        assert.equal(copies.length, 1); assert.deepEqual(copies[0], f.originalKey);
        if (deny) f.onPolicy(async () => { throw new Error('denied'); });
        await lease.recheck(); return 'checked';
      });
      if (deny) await assert.rejects(work); else assert.equal((await work).value, 'checked');
      assert.ok(copies.length > 0); for (const copy of copies) assert.ok(copy.every(byte => byte === 0));
      assert.deepEqual(f.key.bytes, f.originalKey);
    } finally { Buffer.from = from; await owner.shutdown(); }
  }
});

test('missing services and non-void caller grants deny before key dispatch', async () => {
  const f = await fixture(), owner = f.owner();
  try { await assert.rejects(owner.withReadSet(f.target, async () => true as unknown as void, consume)); assert.equal(f.keyCalls(), 0); }
  finally { await owner.shutdown(); }
  delete (f.services as Partial<RecordsKeyServices>).scope_originals; assert.throws(() => f.owner());
});

test('denied or replaced key policies, provider identity and changed/malformed key material cannot release contents', async () => {
  for (const change of ['policy', 'provider', 'method', 'key-bytes', 'key-id', 'short-key', 'grant-return', 'expiry', 'hold', 'ciphertext'] as const) {
    const f = await fixture(), owner = f.owner(); let reached = false;
    try {
      await assert.rejects(owner.withReadSet(f.target, current, async lease => {
        reached = true;
        if (change === 'policy') f.onPolicy(async () => { throw new Error('secret-policy-denial'); });
        if (change === 'provider') f.services.scope_originals.provider = { ...f.provider };
        if (change === 'method') f.provider.keyForDraft = async () => f.key;
        if (change === 'key-bytes') f.key.bytes[0] = f.key.bytes[0]! ^ 255;
        if (change === 'key-id') f.key.keyId = 'other-key';
        if (change === 'short-key') f.key.bytes = randomBytes(31);
        if (change === 'grant-return') f.services.scope_originals.authorize = async () => true as unknown as void;
        if (change === 'expiry') f.clock(100000);
        if (change === 'hold') f.header.held = true;
        if (change === 'ciphertext') f.data.scope_originals[0].encrypted_value.chunks[0].tag = 'a'.repeat(22);
        await lease.recheck(); return lease.contents;
      }), /complete record contents could not be verified/);
      assert.equal(reached, true, change);
    } finally { await owner.shutdown(); }
  }
});

test('recheck is mandatory, one-use and scoped to the current invocation', async () => {
  const f = await fixture(), owner = f.owner(); let retained: RecordsContentLease | undefined;
  try {
    await assert.rejects(owner.withReadSet(f.target, current, async lease => { retained = lease; return lease.contents; }));
    assert.throws(() => retained!.check()); await assert.rejects(retained!.recheck());
    await assert.rejects(owner.withReadSet(f.target, current, async lease => { await lease.recheck(); await assert.rejects(lease.recheck()); return 'no'; }));
    assert.deepEqual(f.key.bytes, f.originalKey);
  } finally { await owner.shutdown(); }
});

test('pending key lookups retain all four admission slots through cancellation and shutdown', async () => {
  const f = await fixture(), held = deferred(), entered = deferred();
  f.onKey(async () => { if (f.keyCalls() === 4) entered.resolve(); await held.promise; });
  const owner = f.owner(), controller = new AbortController(); let consumed = 0;
  const calls = Array.from({ length: 4 }, () => owner.withReadSet(f.target, current, async lease => { consumed++; return consume(lease); }, controller.signal));
  const denied = calls.map(call => assert.rejects(call));
  await entered.promise; controller.abort(); await Promise.all(denied);
  await assert.rejects(owner.withReadSet(f.target, current, consume)); assert.equal(f.keyCalls(), 4);
  let drained = false; const shutdown = owner.shutdown().then(() => { drained = true; }); await tick(); assert.equal(drained, false);
  held.resolve(); await shutdown; assert.equal(consumed, 0); assert.deepEqual(f.key.bytes, f.originalKey);
});

test('forgotten pending key recheck is drained before owner shutdown and cannot release a result', async () => {
  const f = await fixture(), held = deferred(), entered = deferred();
  f.onKey(async () => { if (f.keyCalls() === 2) { entered.resolve(); await held.promise; } });
  const owner = f.owner(); let child: Promise<void> | undefined;
  const work = owner.withReadSet(f.target, current, async lease => { child = lease.recheck(); void child.catch(() => {}); await entered.promise; return 'unawaited'; });
  const rejected = assert.rejects(work); await entered.promise;
  let drained = false; const shutdown = owner.shutdown().then(() => { drained = true; }); await tick(); assert.equal(drained, false);
  held.resolve(); await rejected; await shutdown; await assert.rejects(child!); assert.deepEqual(f.key.bytes, f.originalKey);
});

test('canonical metadata, envelope, payload, retained source and forged decode plans fail closed', async () => {
  for (const change of ['owner-column', 'missing-column', 'revision-hash', 'source-revision', 'scope-digest', 'payload-digest', 'scope-manifest', 'ciphertext', 'plan-omission'] as const) {
    const f = await fixture(), snapshot = f.snapshot();
    if (change === 'owner-column') f.data.revisions[0].subject = 'someone-else';
    if (change === 'missing-column') delete f.data.scope_originals[0].preparation_digest;
    if (change === 'revision-hash') f.data.revisions[0].revision_digest = 'c'.repeat(64);
    if (change === 'source-revision' || change === 'scope-digest') {
      const row = f.data.revisions[0]; row.record = { ...row.record, [change === 'source-revision' ? 'sourceRevision' : 'scopeInputDigest']: change === 'source-revision' ? 2 : 'e'.repeat(64) };
      row.revision_digest = draftRevisionCodec.revisionDigest(row.record);
      row.encrypted_value = sealDraft(f.content, draftRevisionCodec.aad(row.record), f.key);
    }
    if (change === 'payload-digest') f.data.scope_originals[0].payload_digest = 'd'.repeat(64);
    if (change === 'scope-manifest') f.data.scope_runs[0].manifest = {};
    if (change === 'ciphertext') f.data.revisions[0].encrypted_value.tag = 'a'.repeat(22);
    const changed = change === 'plan-omission' ? snapshot : f.snapshot();
    await assert.rejects(async () => {
      const plan = inspectEncryptedRecords(changed, f.config);
      await decodeRecordContents(changed, f.config, change === 'plan-omission' ? plan.slice(1) : plan, () => f.key, () => {});
    }, /Record contents could not be verified/);
    assert.deepEqual(f.key.bytes, f.originalKey);
  }
});
