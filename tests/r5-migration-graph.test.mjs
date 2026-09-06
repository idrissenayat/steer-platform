import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createMigrationGraphVerifier, policyDigest } from '../intent/0062/migration-graph.candidate.mjs';
import { createMigrationTimeVerifier, policyDigest as exactPolicyDigest } from '../intent/0090/migration-time.candidate.mjs';
import { exactInstant, formatExactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { createMigrationCompatibilityVerifier, modelDigest as compatibilityModelDigest, policyDigest as compatibilityPolicyDigest } from '../intent/0091/migration-compatibility.candidate.mjs';
import { createDualColumnModel } from '../intent/0091/dual-column.candidate.mjs';
import { humanAuthorityBindingDigest } from '../intent/0058/human-authority.candidate.mjs';
import { manifestBytes, manifestDigest } from '../intent/0060/protected-actions.candidate.mjs';
import { makeHumanAuthorityBundle, makeMigrationEvidence } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { migrationDecision as frozen } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, TARGET_REVISION, TARGET_EXAM_SHA, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, AUTHORIZATION_POLICY_BYTES, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const at = (second) => new Date(Date.parse('2026-09-04T12:00:00Z') + second * 1000).toISOString().replace('.000Z', 'Z');
const evaluation = at(60), until = at(180);
const sourceFields = ['itemBytesBase64', 'signatureBytesBase64', 'attemptBytesBase64', 'auditBytesBase64', 'releaseBytesBase64', 'evidenceBytesBase64'];
const keys = new Map();
// Only synthetic module-private fixture keys; no real credential or provider access.
function seal(input, domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), keys.get(domain)).toString('base64') } };
}
const scope = { organization: 'steer-platform', tenant: 'steer-platform', repositoryId: 'steer-platform', installationId: 'fixture-installation', item: '0001-flight-deck-foundation' };
const target = { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: 'e'.repeat(40), authorizationPolicyPath: AUTHORIZATION_POLICY_PATH,
  authorizationPolicyRevision: TARGET_REVISION, authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA, authorizationPolicyBytes: AUTHORIZATION_POLICY_BYTES };
function fixture(options = {}) {
  const at = (second) => formatExactInstant(exactInstant('2026-09-04T12:00:00Z') + BigInt(second) * BigInt(options.tickNanoseconds ?? 1000000000) + BigInt(options.nanoseconds ?? 0));
  const evaluation = options.evaluationTime ?? at(60), until = at(options.horizon ?? 180), policyDigest = options.exact ? exactPolicyDigest : originalPolicyDigest;
  const phase = options.phase ?? 'expand', edits = options.edits ?? {}, edit = (key, value) => { edits[key]?.(value); return value; };
  const schemaFrom = options.successorTuple ? 'schema-v2' : 'schema-v1', schemaTo = options.successorTuple ? 'schema-v3' : 'schema-v2';
  const oldAppVersion = options.successorTuple ? 'app-v2' : 'app-v1', newAppVersion = options.successorTuple ? 'app-v3' : 'app-v2';
  const definition = { planId: 'plan-1', executionId: 'execution-1', phase, batch: 'batch-1', checkpoint: 'checkpoint-1', schemaFrom, schemaTo,
    oldAppVersion, newAppVersion, columns: [phase === 'contract' ? 'old' : 'new'],
    dataOperations: [phase === 'expand' ? { kind: 'add-column', column: 'new', defaultValue: null } : phase === 'backfill' ? { kind: 'copy-column', sourceColumn: 'old', targetColumn: 'new' } : { kind: 'drop-column', column: 'old' }],
    affectedTenants: [scope.tenant], batchRowIds: phase === 'backfill' ? ['row-1'] : ['row-1', 'row-2'], supportedReaders: [oldAppVersion, newAppVersion], supportedWriters: [oldAppVersion, newAppVersion],
    allowedRollbacks: ['none', 'before-backfill', 'during-backfill', 'after-backfill'] };
  edit('definition', definition);
  const data = { schemaVersion: schemaFrom, columns: phase === 'expand' ? ['old'] : ['new', 'old'], rows: ['row-1', 'row-2'].map((rowId, index) => ({ rowId,
    values: phase === 'expand' ? { old: `value-${index}` } : { new: phase === 'contract' ? `value-${index}` : null, old: `value-${index}` } })) };
  edit('before-data', data);
  const before = { ...Object.fromEntries(sourceFields.map((key) => [key, Buffer.from(`${key}: original e\u0301\n\0`, 'utf8').toString('base64')])), dataBytes: jcs(data) };
  const beforeTruthBytes = jcs(before);
  const config = { version: options.exact ? 'steer-migration-context/v2' : 'steer-migration-context/v1', implementationRevision: target.implementationRevision, repositoryId: scope.repositoryId, installationId: scope.installationId,
    database: 'fixture-db', schema: 'public', actorSubject: 'service:schema-migration-runner', upstreamSubject: 'authority:migration', providerBindingId: 'fixture-provider-a-binding',
    approvedDefinitionDigest: sha256(jcs(definition)), approvedBeforeTruthDigest: sha256(beforeTruthBytes) };
  edit('config', config); const configBytes = jcs(config), configDigest = sha256(configBytes);
  const proof = (kind, fields, domain, second) => seal(edit(kind, { kind, configDigest, ...fields, recordedAt: at(second) }), options.domains?.[kind] ?? domain);
  const plan = proof('plan', { definition, validThrough: until }, 'authority', 0);
  const beforeProof = proof('before', { planDigest: plan.recordDigest, truthDigest: sha256(beforeTruthBytes) }, 'provider-a', 1);
  const backupTruthBytes = options.backupTruthBytes ?? beforeTruthBytes;
  const backup = proof('backup', { planDigest: plan.recordDigest, beforeProofDigest: beforeProof.recordDigest, truthDigest: sha256(backupTruthBytes), backupId: 'backup-1' }, 'provider-a', 2);
  const rehearsalTruthBytes = options.rehearsalTruthBytes ?? backupTruthBytes;
  const rehearsal = proof('rehearsal', { planDigest: plan.recordDigest, backupDigest: backup.recordDigest, restoredTruthDigest: sha256(rehearsalTruthBytes), status: 'identical' }, 'verifier', 3);
  const mode = { interruption: options.interruption ?? 'none', rollback: options.rollback ?? 'none' };
  const inputs = { configDigest, policyDigest, mode, planBytes: jcs(plan), beforeTruthBytes, beforeProofBytes: jcs(beforeProof), backupTruthBytes, backupProofBytes: jcs(backup),
    rehearsalTruthBytes, rehearsalProofBytes: jcs(rehearsal) }, inputDigest = sha256(jcs(inputs));
  let authorityDigest = plan.recordDigest, cleanupBundleBytes = '';
  if (phase === 'contract') {
    const bundle = makeHumanAuthorityBundle(), prior = JSON.parse(bundle.authorityBytes);
    const inventory = seal({ inventoryId: 'migration-inventory', organization: scope.organization, tenant: scope.tenant, item: scope.item, capturedAt: at(4), executionId: definition.executionId,
      planDigest: plan.recordDigest, backupDigest: backup.recordDigest, items: [{ copyId: definition.executionId, provider: 'fixture-provider-a', objectDigest: sha256(jcs({ database: config.database, schema: config.schema,
        columns: definition.columns, dataOperations: definition.dataOperations, affectedTenants: definition.affectedTenants })) }] }, 'record');
    const identity = seal({ ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(4) }, 'provider');
    const authority = edit('human', { ...prior, authorityType: 'disposition-authorization', eraseMethod: 'provider-delete', terminalEventId: definition.planId,
      allowedCopyProviders: ['fixture-provider-a'], copyInventoryDigest: inventory.recordDigest, identityEvidenceDigest: identity.recordDigest, authenticatedAt: at(4), decidedAt: at(5),
      conditions: [`migration-execution:${definition.executionId}`, `plan:${plan.recordDigest}`, `backup:${backup.recordDigest}`, `columns:${sha256(jcs(definition.columns))}`,
        `operations:${sha256(jcs(definition.dataOperations))}`, `tenants:${sha256(jcs(definition.affectedTenants))}`, `input:${inputDigest}`] });
    const provider = seal({ ...JSON.parse(bundle.providerProofBytes), authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }, 'human-provider');
    const full = seal({ ...authority, providerProofDigest: provider.recordDigest }, 'authority'); authorityDigest = full.recordDigest;
    Object.assign(bundle, { authorityBytes: jcs(full), providerProofBytes: jcs(provider), inventoryBytes: jcs(inventory), identityEvidenceBytes: jcs(identity),
      casHeadBytes: jcs(seal({ ...JSON.parse(bundle.casHeadBytes), snapshotAt: at(5), validThrough: until }, 'cas-authority')),
      replayLedgerBytes: jcs(seal({ ...JSON.parse(bundle.replayLedgerBytes), snapshotAt: at(5), validThrough: until }, 'replay-authority')),
      casReservationBytes: jcs(seal({ ...JSON.parse(bundle.casReservationBytes), requestDigest: full.recordDigest, authorityDigest: full.recordDigest, recordedAt: at(6), validThrough: until }, 'cas-authority')), evaluationTime: evaluation });
    edit('human-bundle', bundle); cleanupBundleBytes = jcs(bundle);
  }
  const action = `migration.${phase}`, resources = { database: config.database, schema: config.schema, ...Object.fromEntries(['schemaFrom', 'schemaTo', 'oldAppVersion', 'newAppVersion', 'batch', 'checkpoint', 'executionId'].map((key) => [key, definition[key]])), planDigest: plan.recordDigest };
  const grant = { grantId: definition.executionId, action, actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject, provider: 'fixture-provider-a', resourceDomain: 'provider-a', resources, authorityEvidenceDigest: authorityDigest, inputDigest };
  const context = edit('context', { version: 'steer-protected-action-context/v1', manifestDigest, trustRegistryBytes: jcs(TRUST_REGISTRY), target: structuredClone(target), scope: structuredClone(scope), grants: [structuredClone(grant)] });
  const contextDigest = sha256(jcs(context)), operation = edit('operation', { requestId: 'request-1', grantId: definition.executionId, idempotencyKey: 'idem-1', casHead: 'a'.repeat(64), requestedAt: at(15) });
  const operationDigest = sha256(jcs({ contextDigest, operation })), records = {}, rule = JSON.parse(manifestBytes).actions.find((entry) => entry.action === action);
  const emit = (kind, fields, domain, second = 10) => records[kind] = seal(edit(`action-${kind}`, { kind, contextDigest, operationDigest, recordedAt: at(second), validThrough: until, ...fields }), options.domains?.[`action-${kind}`] ?? domain);
  const selectorsDigest = sha256(jcs({ scope, target, grant }));
  const up = emit('upstream', { credentialId: 'up-1', principal: rule.upstreamPrincipal, subject: grant.upstreamSubject, provider: 'steer-identity', action: rule.upstreamAction, oneUse: true, lastUsedAt: at(14), selectorsDigest }, 'upstream');
  const down = emit('downstream', { credentialId: 'down-1', principal: rule.principal, subject: grant.actorSubject, provider: grant.provider, action, oneUse: true, lastUsedAt: at(14), selectorsDigest }, 'downstream');
  const delegation = emit('delegation', { delegationId: 'delegation-1', issuerPrincipal: up.principal, issuerSubject: up.subject, recipientPrincipal: down.principal, recipientSubject: down.subject, upstreamDigest: up.recordDigest, downstreamDigest: down.recordDigest }, 'delegation', 11);
  const assignment = emit('assignment', { assignmentId: 'assignment-1', actorSubject: grant.actorSubject, actorRole: rule.role, status: 'current' }, 'assignment');
  const authority = emit('authority', { authorityId: 'authority-1', actorSubject: grant.actorSubject, actorRole: rule.role, action, authorityEvidenceDigest: authorityDigest, assignmentDigest: assignment.recordDigest, decision: 'authorized' }, 'authority', 12);
  const resourceProof = emit('resources', { snapshotId: 'resources-1', provider: grant.provider, resources: structuredClone(resources) }, 'provider-a');
  const request = emit('request', { operation, upstreamDigest: up.recordDigest, downstreamDigest: down.recordDigest, delegationDigest: delegation.recordDigest, assignmentDigest: assignment.recordDigest, authorityDigest: authority.recordDigest, resourcesDigest: resourceProof.recordDigest }, 'record', 15);
  // Independently constructed expected states; deliberately do not call the candidate transform.
  const expected = structuredClone(data);
  const noEffect = mode.interruption === 'before-effect', restored = mode.rollback !== 'none';
  if (!noEffect && !restored) {
    expected.schemaVersion = schemaTo;
    if (phase === 'expand') { expected.columns = ['new', 'old']; for (const row of expected.rows) row.values.new = null; }
    if (phase === 'backfill') expected.rows[0].values.new = expected.rows[0].values.old;
    if (phase === 'contract') { expected.columns = ['new']; for (const row of expected.rows) delete row.values.old; }
  }
  const afterTruth = edit('after-truth', { ...before, dataBytes: jcs(expected) }), afterTruthBytes = jcs(afterTruth);
  const rollbackTruthBytes = restored ? options.rollbackTruthBytes ?? beforeTruthBytes : '';
  const rollback = restored ? proof('rollback', { requestDigest: request.recordDigest, backupDigest: backup.recordDigest, truthDigest: sha256(rollbackTruthBytes), status: 'identical' }, 'recovery-provider', 20) : null;
  const count = noEffect ? 0 : 1, status = noEffect ? 'refused' : restored ? 'rolled-back' : 'committed';
  const afterProof = proof('after', { planDigest: plan.recordDigest, requestDigest: request.recordDigest, truthDigest: sha256(afterTruthBytes), effectCount: count, status, transactionId: 'transaction-1' }, 'provider-a', 21);
  const journal = proof('journal', { source: 'authoritative-migration-journal', planDigest: plan.recordDigest, requestDigest: request.recordDigest, beforeProofDigest: beforeProof.recordDigest, afterProofDigest: afterProof.recordDigest,
    phase, batch: definition.batch, checkpoint: definition.checkpoint, effectCount: count, attempt: 1, status }, 'provider', 22);
  const result = proof('result', { requestDigest: request.recordDigest, journalDigest: journal.recordDigest, afterProofDigest: afterProof.recordDigest, effectCount: count, status }, 'provider-a', 23);
  const replay = emit('replay', { ledgerId: 'replay-1', source: 'authoritative-replay-store', requestDigest: request.recordDigest, idempotencyKey: operation.idempotencyKey,
    status: options.replay ? 'committed' : 'unused', resultDigest: options.replay ? result.recordDigest : null, headId: 'head-1' }, 'replay-authority', options.replay ? 24 : 16);
  const head = emit('head', { headId: 'head-1', source: 'authoritative-cas-store', requestDigest: request.recordDigest, head: operation.casHead, previousHead: '9'.repeat(64), sequence: 4 }, 'cas-authority', 16);
  emit('reservation', { reservationId: 'reservation-1', source: 'authoritative-cas-store', requestDigest: request.recordDigest, headId: head.headId, headDigest: head.recordDigest,
    replayDigest: replay.recordDigest, expectedHead: head.head, idempotencyKey: operation.idempotencyKey, winner: !options.replay, status: options.replay ? 'already-committed' : 'reserved' }, 'cas-authority', options.replay ? 25 : 17);
  const actionBundle = edit('action-bundle', { version: 'steer-protected-action-bundle/v1', contextDigest, ...Object.fromEntries(Object.entries(records).map(([kind, record]) => [`${kind}Bytes`, jcs(record)])) });
  const graph = edit('graph', { version: options.exact ? 'steer-migration-graph/v2' : 'steer-migration-graph/v1', ...inputs, cleanupBundleBytes, actionBundleBytes: jcs(actionBundle), afterTruthBytes, afterProofBytes: jcs(afterProof),
    rollbackTruthBytes, rollbackProofBytes: rollback ? jcs(rollback) : '', journalBytes: jcs(journal), resultBytes: jcs(result) });
  return { bytes: jcs(graph), graph, config, configBytes, exact: options.exact === true, evaluationTime: evaluation,
    verifier: (options.exact ? createMigrationTimeVerifier : createMigrationGraphVerifier)(configBytes) };
}
const originalPolicyDigest = policyDigest;
const denied = (value, now = value.evaluationTime) => assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'MIGRATION_GRAPH_INVALID', effects: zeroEffects(), journalEffects: 0,
  ...(value.exact ? { executionAuthorized: false } : {}) });

function compatibilityFixture(options = {}, edits = {}) {
  const value = fixture({ exact: true, ...options }), context = { version: 'steer-migration-compatibility-context/v1', modelDigest: compatibilityModelDigest,
    migrationConfigBytes: value.configBytes, sourceColumn: 'old', targetColumn: 'new' };
  edits.context?.(context); const contextBytes = jcs(context), verifier = createMigrationCompatibilityVerifier(contextBytes);
  const envelope = { version: 'steer-migration-compatibility/v1', configDigest: sha256(contextBytes), policyDigest: compatibilityPolicyDigest, graphBytes: value.bytes };
  edits.envelope?.(envelope);
  return { ...value, contextBytes, envelope, compatibilityBytes: jcs(envelope), compatibilityVerifier: verifier };
}
function compatibilityDenied(value) {
  assert.deepEqual(value.compatibilityVerifier.verify(value.compatibilityBytes, value.evaluationTime), { state: 'blocked', firstError: 'MIGRATION_COMPATIBILITY_INVALID',
    executionAuthorized: false, effects: zeroEffects(), journalEffects: 0 });
}

test('0091: complete signed migration runs every bounded old/new interleaving on both actual states', () => {
  for (const successorTuple of [false, true]) for (const phase of ['expand', 'backfill', 'contract']) for (const replay of [false, true]) for (const interruption of ['none', 'before-effect', 'after-effect']) {
    const value = compatibilityFixture({ successorTuple, phase, replay, interruption, tickNanoseconds: 1 }), result = value.compatibilityVerifier.verify(value.compatibilityBytes, value.evaluationTime);
    assert.equal(result.state, 'verified-migration-model-compatibility'); assert.equal(result.caseCount, 104);
    assert.equal(result.executionAuthorized, false); assert.equal(result.liveCompatibilityVerified, false); assert.equal(result.factOnly, true);
    assert.deepEqual(result.effects, zeroEffects()); assert.equal(result.journalEffects, 0); assert.equal(result.graphDigest, sha256(value.bytes));
    assert.deepEqual(result.supportedClients, successorTuple ? ['app-v2', 'app-v3'] : ['app-v1', 'app-v2']); assert.match(result.traceDigest, /^[a-f0-9]{64}$/);
    assert.deepEqual(value.compatibilityVerifier.verify(value.compatibilityBytes, value.evaluationTime), result);
  }
  for (const rollback of ['before-backfill', 'during-backfill', 'after-backfill']) {
    const value = compatibilityFixture({ phase: 'backfill', rollback });
    assert.equal(value.compatibilityVerifier.verify(value.compatibilityBytes, value.evaluationTime).state, 'verified-migration-model-compatibility');
  }
});

test('0091: each client executes real projection and mirrored writes, including null and source-only/target-only shapes', () => {
  for (const columns of [['old'], ['new', 'old'], ['new']]) {
    const data = { schemaVersion: 'schema-v1', columns, rows: ['row-1', 'row-2'].map((rowId) => ({ rowId, values: Object.fromEntries(columns.map((column) => [column, column === 'new' && columns.includes('old') ? null : 'original'])) })) };
    const bytes = jcs(data), model = createDualColumnModel(bytes, 'old', 'new');
    assert.deepEqual(model.read('old', 'row-1'), { value: 'original', revision: 0 }); assert.deepEqual(model.read('new', 'row-1'), { value: 'original', revision: 0 });
    assert.deepEqual(model.write('old', 'row-1', 'changed', 0, 'command-1'), { status: 'committed', revision: 1 });
    let snapshot = JSON.parse(model.snapshot());
    for (const column of columns) assert.equal(snapshot.rows[0].values[column], 'changed');
    assert.deepEqual(snapshot.rows[1], data.rows[1]); assert.deepEqual(model.read('new', 'row-1'), { value: 'changed', revision: 1 });
    assert.deepEqual(model.write('new', 'row-1', null, 1, 'command-2'), { status: 'committed', revision: 2 });
    snapshot = JSON.parse(model.snapshot()); for (const column of columns) assert.equal(snapshot.rows[0].values[column], null);
    assert.deepEqual(model.read('old', 'row-1'), { value: null, revision: 2 }); assert.deepEqual(model.read('new', 'row-1'), { value: null, revision: 2 });
    assert.equal(jcs(data), bytes);
  }
});

test('0091: competing row snapshots yield one winner; stale loser, same-byte replay and key drift never mutate', () => {
  const data = jcs({ schemaVersion: 'v1', columns: ['new', 'old'], rows: [{ rowId: 'r1', values: { new: null, old: 'initial' } }] });
  for (const [winner, loser] of [['old', 'new'], ['new', 'old']]) {
    const model = createDualColumnModel(data, 'old', 'new'), observed = [model.read(winner, 'r1'), model.read(loser, 'r1')];
    assert.equal(model.write(winner, 'r1', 'winner', observed[0].revision, 'winner').status, 'committed'); const committed = model.snapshot();
    assert.equal(model.write(loser, 'r1', 'loser', observed[1].revision, 'loser').status, 'rejected-stale-revision'); assert.equal(model.snapshot(), committed);
    assert.equal(model.write(winner, 'r1', 'winner', 0, 'winner').status, 'replay-noop'); assert.equal(model.snapshot(), committed);
    for (const [client, content, revision] of [[winner, 'drift', 0], [loser, 'winner', 0], [winner, 'winner', 1]]) {
      assert.equal(model.write(client, 'r1', content, revision, 'winner').status, 'rejected-key-conflict'); assert.equal(model.snapshot(), committed);
    }
    assert.deepEqual(model.write(loser, 'r1', 'retry', 1, 'retry'), { status: 'committed', revision: 2 });
    assert.deepEqual(model.read(winner, 'r1'), { value: 'retry', revision: 2 });
  }
});

test('0091: declarative compatibility cannot conceal conflicting representations or data loss on contract', () => {
  const lost = compatibilityFixture({ phase: 'contract', edits: { 'before-data': (data) => { data.rows[0].values.new = null; } } });
  assert.equal(lost.verifier.verify(lost.bytes, lost.evaluationTime).state, 'validated-migration-candidate'); compatibilityDenied(lost);
  const stale = compatibilityFixture({ phase: 'backfill', edits: { 'before-data': (data) => { data.rows[1].values.new = 'stale'; } } });
  assert.equal(stale.verifier.verify(stale.bytes, stale.evaluationTime).state, 'validated-migration-candidate'); compatibilityDenied(stale);
  const wrongMapping = compatibilityFixture({}, { context: (context) => { context.sourceColumn = 'other'; } }); compatibilityDenied(wrongMapping);
  const forged = compatibilityFixture({}, { envelope: (envelope) => { envelope.compatible = true; } }); compatibilityDenied(forged);
  const unknownVersion = compatibilityFixture({ edits: { definition: (record) => { record.newAppVersion = 'unlisted-app'; record.supportedReaders[1] = record.newAppVersion; record.supportedWriters[1] = record.newAppVersion; } } });
  assert.equal(unknownVersion.verifier.verify(unknownVersion.bytes, unknownVersion.evaluationTime).state, 'validated-migration-candidate'); compatibilityDenied(unknownVersion);
});

test('0091: every signed migration prerequisite, exact clock and approved source pin remain mandatory', () => {
  for (const field of ['planBytes', 'beforeProofBytes', 'backupProofBytes', 'rehearsalProofBytes', 'actionBundleBytes', 'afterProofBytes', 'journalBytes', 'resultBytes'])
    compatibilityDenied(compatibilityFixture({ edits: { graph: (graph) => { graph[field] = '{}'; } } }));
  compatibilityDenied(compatibilityFixture({ phase: 'contract', edits: { 'human-bundle': (bundle) => { bundle.providerProofBytes = '{}'; } } }));
  compatibilityDenied(compatibilityFixture({ edits: { 'action-reservation': (record) => { record.winner = false; } } }));
  compatibilityDenied(compatibilityFixture({ edits: { config: (record) => { record.approvedBeforeTruthDigest = 'f'.repeat(64); } } }));
  const value = compatibilityFixture();
  for (const now of [undefined, '2026-09-04T12:03:00Z', '2026-09-04T12:01:00.000Z']) assert.equal(value.compatibilityVerifier.verify(value.compatibilityBytes, now).state, 'blocked');
});

test('0091: the selected executable model, context and schema bounds are closed and cannot become caller code', () => {
  for (const mutate of [(context) => { context.modelDigest = 'f'.repeat(64); }, (context) => { context.sourceColumn = '__proto__'; },
    (context) => { context.targetColumn = context.sourceColumn; }, (context) => { context.reader = 'return true'; },
    (context) => { context.migrationConfigBytes = fixture().configBytes; }])
    assert.throws(() => compatibilityFixture({}, { context: mutate }), /MIGRATION_COMPATIBILITY_CONFIGURATION_INVALID/);
  const value = compatibilityFixture({}, { envelope: (envelope) => { envelope.graphBytes = '{}'; } }); compatibilityDenied(value);
  const base = { schemaVersion: 'v1', columns: ['new', 'old'], rows: [{ rowId: 'r1', values: { new: null, old: 'initial' } }] };
  for (const mutate of [(data) => { data.rows.push(data.rows[0]); }, (data) => { data.rows[0].values.extra = true; },
    (data) => { data.rows[0].values.old = 'x'.repeat(4097); }, (data) => { data.columns.reverse(); },
    (data) => { data.rows[0].values.new = 'inconsistent'; }]) {
    const data = structuredClone(base); mutate(data); assert.throws(() => createDualColumnModel(jcs(data), 'old', 'new'), /MIGRATION_COMPATIBILITY_INVALID/);
  }
  const model = createDualColumnModel(jcs(base), 'old', 'new'), original = model.snapshot();
  assert.throws(() => model.write('other', 'r1', 'bad', 0, 'key'), /MIGRATION_COMPATIBILITY_INVALID/);
  assert.throws(() => model.write('old', 'other-tenant-row', 'bad', 0, 'key'), /MIGRATION_COMPATIBILITY_INVALID/); assert.equal(model.snapshot(), original);
});

test('0091: every row is covered at the 128-row bound and the model replay store has a finite mutation limit', () => {
  const rowIds = Array.from({ length: 128 }, (_, index) => `row-${String(index).padStart(3, '0')}`);
  const value = compatibilityFixture({ edits: { definition: (record) => { record.batchRowIds = rowIds; },
    'before-data': (data) => { data.rows = rowIds.map((rowId) => ({ rowId, values: { old: rowId } })); } } });
  const result = value.compatibilityVerifier.verify(value.compatibilityBytes, value.evaluationTime);
  assert.equal(result.state, 'verified-migration-model-compatibility'); assert.equal(result.caseCount, 6656);
  const model = createDualColumnModel(jcs({ schemaVersion: 'v1', columns: ['old'], rows: [{ rowId: 'r1', values: { old: 'initial' } }] }), 'old', 'new');
  for (let index = 0; index < 256; index++) assert.equal(model.write('old', 'r1', String(index), index, `command-${index}`).status, 'committed');
  const snapshot = model.snapshot();
  assert.throws(() => model.write('old', 'r1', 'overflow', 256, 'overflow'), /MIGRATION_COMPATIBILITY_INVALID/); assert.equal(model.snapshot(), snapshot);
  assert.equal(model.write('old', 'r1', '0', 0, 'command-0').status, 'replay-noop'); assert.equal(model.snapshot(), snapshot);
  const oversized = jcs({ schemaVersion: 'v1', columns: ['old'], rows: Array.from({ length: 10 }, (_, index) => ({ rowId: `r${index}`, values: { old: '😀'.repeat(2000) } })) });
  assert.ok(oversized.length < 65536 && Buffer.byteLength(oversized, 'utf8') > 65536);
  assert.throws(() => createDualColumnModel(oversized, 'old', 'new'), /MIGRATION_COMPATIBILITY_INVALID/);
});

test('0090: full nanosecond migration evidence verifies every phase, first/replay and supported interruption', () => {
  for (const phase of ['expand', 'backfill', 'contract']) for (const replay of [false, true]) for (const interruption of ['none', 'before-effect', 'after-effect']) {
    const value = fixture({ exact: true, phase, replay, interruption, tickNanoseconds: 1 }), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, replay ? 'replay-noop' : interruption === 'before-effect' ? 'validated-safe-non-result' : 'validated-migration-candidate');
    assert.equal(result.executionAuthorized, false); assert.equal(result.journalEffects, 0); assert.deepEqual(result.effects, zeroEffects());
  }
  for (const phase of ['expand', 'backfill', 'contract']) for (const replay of [false, true]) for (const rollback of ['before-backfill', 'during-backfill', 'after-backfill']) {
    const value = fixture({ exact: true, phase, replay, rollback, tickNanoseconds: 1 }), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, replay ? 'replay-noop' : 'validated-migration-candidate'); assert.equal(result.executionAuthorized, false);
  }
});

test('0090: nanosecond chronology rejects preparation, approval, restoration and terminal record inversions', () => {
  const instant = (second, delta = 0n) => formatExactInstant(exactInstant(at(second)) + delta);
  for (const [name, field, replacement, extra] of [
    ['before', 'recordedAt', instant(0, -1n), {}], ['backup', 'recordedAt', instant(1, -1n), {}],
    ['rehearsal', 'recordedAt', instant(2), {}], ['human', 'decidedAt', instant(3, -1n), { phase: 'contract' }],
    ['operation', 'requestedAt', instant(3, -1n), {}], ['rollback', 'recordedAt', instant(17), { rollback: 'during-backfill' }],
    ['after', 'recordedAt', instant(17), {}], ['after', 'recordedAt', instant(20), { rollback: 'after-backfill' }],
    ['journal', 'recordedAt', instant(21), {}], ['result', 'recordedAt', instant(22), {}],
    ['result', 'recordedAt', instant(24, 1n), { replay: true }],
  ]) denied(fixture({ exact: true, ...extra, edits: { [name]: (record) => { record[field] = replacement; } } }));
  const ordered = fixture({ exact: true, edits: { journal: (record) => { record.recordedAt = instant(21, 1n); }, result: (record) => { record.recordedAt = instant(21, 2n); } } });
  assert.equal(ordered.verifier.verify(ordered.bytes, ordered.evaluationTime).state, 'validated-migration-candidate');
});

test('0090: exact 300-second age and half-open plan expiry never round or use an implicit clock', () => {
  const edge = fixture({ exact: true, edits: { plan: (record) => { record.recordedAt = at(-240); } } });
  assert.equal(edge.verifier.verify(edge.bytes, edge.evaluationTime).state, 'validated-migration-candidate');
  denied(fixture({ exact: true, edits: { plan: (record) => { record.recordedAt = formatExactInstant(exactInstant(at(-240)) - 1n); } } }));
  const alive = fixture({ exact: true, edits: { plan: (record) => { record.validThrough = formatExactInstant(exactInstant(evaluation) + 1n); } } });
  assert.equal(alive.verifier.verify(alive.bytes, alive.evaluationTime).state, 'validated-migration-candidate');
  denied(fixture({ exact: true, edits: { plan: (record) => { record.validThrough = evaluation; } } }));
  const value = fixture({ exact: true });
  for (const now of [undefined, null, '', '2026-09-04T12:01:00.000Z', '2026-09-04T12:01:00+00:00', '2026-02-30T12:00:00Z', '2026-09-04T12:00:22.999999999Z'])
    assert.equal(value.verifier.verify(value.bytes, now).state, 'blocked');
});

test('0090: exact profile retains complete shared authorization and separate contract owner evidence', () => {
  for (const phase of ['expand', 'backfill', 'contract']) {
    for (const field of ['requestBytes', 'upstreamBytes', 'downstreamBytes', 'delegationBytes', 'assignmentBytes', 'authorityBytes', 'resourcesBytes', 'replayBytes', 'headBytes', 'reservationBytes'])
      denied(fixture({ exact: true, phase, tickNanoseconds: 1, edits: { 'action-bundle': (record) => { record[field] = '{}'; } } }));
    denied(fixture({ exact: true, phase, edits: { 'action-reservation': (record) => { record.winner = false; } } }));
  }
  for (const field of ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes', 'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'])
    denied(fixture({ exact: true, phase: 'contract', edits: { 'human-bundle': (record) => { record[field] = '{}'; } } }));
});

test('0090: supplied truth, backup, restoration and journal lineage cannot be bypassed by precise timestamps', () => {
  for (const field of sourceFields) denied(fixture({ exact: true, edits: { 'after-truth': (record) => { record[field] = Buffer.from('changed').toString('base64'); } } }));
  for (const field of ['beforeProofBytes', 'backupProofBytes', 'rehearsalProofBytes', 'afterProofBytes', 'journalBytes', 'resultBytes'])
    denied(fixture({ exact: true, edits: { graph: (record) => { record[field] = '{}'; } } }));
  denied(fixture({ exact: true, edits: { 'after-truth': (record) => { const data = JSON.parse(record.dataBytes); data.rows[0].values.old = 'changed'; record.dataBytes = jcs(data); } } }));
  denied(fixture({ exact: true, rollback: 'after-backfill', edits: { rollback: (record) => { record.truthDigest = 'f'.repeat(64); } } }));
  denied(fixture({ exact: true, replay: true, edits: { 'action-replay': (record) => { record.resultDigest = 'f'.repeat(64); } } }));
});

test('0090: trusted exact context and graph cannot select legacy policy or change the approved starting point', () => {
  const old = fixture(), exact = fixture({ exact: true });
  assert.throws(() => createMigrationTimeVerifier(old.configBytes), /MIGRATION_CONFIGURATION_INVALID/);
  assert.throws(() => createMigrationGraphVerifier(exact.configBytes), /MIGRATION_CONFIGURATION_INVALID/);
  for (const edits of [
    { graph: (record) => { record.version = 'steer-migration-graph/v1'; } },
    { graph: (record) => { record.policyDigest = policyDigest; } },
    { config: (record) => { record.approvedDefinitionDigest = 'f'.repeat(64); } },
    { config: (record) => { record.approvedBeforeTruthDigest = 'f'.repeat(64); } },
  ]) denied(fixture({ exact: true, edits }));
  assert.equal(old.verifier.verify(old.bytes, old.evaluationTime).state, 'validated-migration-candidate');
  const fractionalOld = fixture({ nanoseconds: 1 }); denied(fractionalOld);
  assert.equal(Object.hasOwn(old.verifier.verify(old.bytes, old.evaluationTime), 'executionAuthorized'), false);
});

test('all three phases verify actual transformed rows, preservation, authoritative replay and no-effect interruption', () => {
  for (const phase of ['expand', 'backfill', 'contract']) for (const replay of [false, true]) for (const interruption of ['none', 'before-effect', 'after-effect']) {
    const value = fixture({ phase, replay, interruption }), result = value.verifier.verify(value.bytes, evaluation);
    assert.equal(result.state, replay ? 'replay-noop' : interruption === 'before-effect' ? 'validated-safe-non-result' : 'validated-migration-candidate', JSON.stringify({ phase, replay, interruption, result }));
    assert.deepEqual(result.effects, zeroEffects()); assert.equal(result.journalEffects, 0); assert.equal(result.action, `migration.${phase}`);
    assert.equal(result.observedEffectCount, interruption === 'before-effect' ? 0 : 1);
  }
  for (const phase of ['expand', 'backfill', 'contract']) for (const rollback of ['before-backfill', 'during-backfill', 'after-backfill']) {
    const value = fixture({ phase, rollback }); assert.equal(value.verifier.verify(value.bytes, evaluation).state, 'validated-migration-candidate');
  }
  const preserved = fixture(), before = JSON.parse(preserved.graph.beforeTruthBytes), after = JSON.parse(preserved.graph.afterTruthBytes);
  for (const key of sourceFields) {
    assert.deepEqual(Buffer.from(after[key], 'base64'), Buffer.from(`${key}: original e\u0301\n\0`, 'utf8'));
    assert.equal(before[key], after[key]);
  }
});

test('the frozen target-free boolean-winner graph is rejected and every shared proof is required in every phase', () => {
  const old = makeMigrationEvidence(); assert.equal(frozen(old).state, 'journaled'); denied({ ...fixture(), bytes: old });
  for (const phase of ['expand', 'backfill', 'contract']) {
    for (const field of ['request', 'upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources', 'replay', 'head', 'reservation'])
      denied(fixture({ phase, edits: { 'action-bundle': (bundle) => { delete bundle[`${field}Bytes`]; } } }));
    for (const [kind, field, value] of [['downstream', 'oneUse', false], ['assignment', 'actorRole', 'builder'], ['authority', 'decision', 'denied'], ['reservation', 'winner', false],
      ['head', 'validThrough', at(60)], ['head', 'head', 'f'.repeat(64)], ['replay', 'requestDigest', 'f'.repeat(64)], ['resources', 'provider', 'other-provider']])
      denied(fixture({ phase, edits: { [`action-${kind}`]: (record) => { record[field] = value; } } }));
    denied(fixture({ phase, domains: { 'action-replay': 'record' } })); denied(fixture({ phase, domains: { 'action-head': 'record' } }));
    denied(fixture({ phase, edits: { context: (context) => { context.target.implementationRevision = 'f'.repeat(40); } } }));
  }
});

test('actual byte and row drift is detected even after all provider evidence is re-signed', () => {
  for (const phase of ['expand', 'backfill', 'contract']) {
    for (const field of sourceFields) denied(fixture({ phase, edits: { 'after-truth': (truth) => { truth[field] = Buffer.from('changed source bytes').toString('base64'); } } }));
    for (const mutation of [
      (data) => { data.rows.pop(); }, (data) => { data.rows[0].values[data.columns[0]] = 'silent-data-drift'; },
      (data) => { data.schemaVersion = 'caller-version'; }, (data) => { data.rows.reverse(); },
    ]) denied(fixture({ phase, edits: { 'after-truth': (truth) => { const data = JSON.parse(truth.dataBytes); mutation(data); truth.dataBytes = jcs(data); } } }));
  }
  denied(fixture({ backupTruthBytes: '{}' })); denied(fixture({ rehearsalTruthBytes: '{}' }));
  denied(fixture({ rollback: 'during-backfill', rollbackTruthBytes: '{}' }));
  denied(fixture({ edits: { config: (config) => { config.approvedDefinitionDigest = 'f'.repeat(64); } } }));
  denied(fixture({ edits: { config: (config) => { config.approvedBeforeTruthDigest = 'f'.repeat(64); } } }));
  denied(fixture({ phase: 'backfill', edits: { 'after-truth': (truth) => {
    const data = JSON.parse(truth.dataBytes); data.rows[1].values.new = data.rows[1].values.old; truth.dataBytes = jcs(data);
  } } }));
});

test('contract needs full current human proof for exact columns, operations, tenants, plan and backup', () => {
  const phase = 'contract';
  denied(fixture({ phase, edits: { graph: (graph) => { graph.cleanupBundleBytes = ''; } } }));
  for (const [field, value] of [['terminalEventId', 'other-plan'], ['eraseMethod', 'cryptographic-erase'], ['conditions', ['unscoped']], ['allowedCopyProviders', ['other-provider']], ['safeguards', ['a', 'b', 'c', 'd']]])
    denied(fixture({ phase, edits: { human: (record) => { record[field] = value; } } }));
  denied(fixture({ phase, edits: { 'human-bundle': (bundle) => {
    const authority = seal({ ...JSON.parse(bundle.authorityBytes), sessionId: 'substituted-session' }, 'authority'); bundle.authorityBytes = jcs(authority);
    bundle.casReservationBytes = jcs(seal({ ...JSON.parse(bundle.casReservationBytes), requestDigest: authority.recordDigest, authorityDigest: authority.recordDigest }, 'cas-authority'));
  } } }));
});

test('every provider/journal proof requires exact request/plan lineage, proper domain and explicit times', () => {
  for (const kind of ['plan', 'before', 'backup', 'rehearsal', 'after', 'journal', 'result']) {
    denied(fixture({ domains: { [kind]: 'record' } }));
    denied(fixture({ edits: { [kind]: (record) => { record.recordedAt = '2000-01-01T00:00:00Z'; } } }));
    denied(fixture({ edits: { [kind]: (record) => { record.extra = 'must-not-appear-in-errors'; } } }));
  }
  for (const [kind, field, value] of [['before', 'truthDigest', 'f'.repeat(64)], ['backup', 'beforeProofDigest', 'f'.repeat(64)], ['rehearsal', 'backupDigest', 'f'.repeat(64)],
    ['after', 'requestDigest', 'f'.repeat(64)], ['after', 'status', 'partial'], ['after', 'effectCount', 0], ['journal', 'attempt', 0], ['journal', 'checkpoint', 'other-checkpoint'],
    ['journal', 'source', 'caller-journal'], ['journal', 'afterProofDigest', 'f'.repeat(64)], ['result', 'journalDigest', 'f'.repeat(64)], ['result', 'status', 'unknown']])
    denied(fixture({ edits: { [kind]: (record) => { record[field] = value; } } }));
  denied(fixture({ replay: true, edits: { 'action-replay': (record) => { record.resultDigest = 'f'.repeat(64); } } }));
  denied(fixture({ rollback: 'during-backfill', edits: { rollback: (record) => { record.recordedAt = at(16); } } }));
});

test('untrusted target/policy overrides, unsupported transformations and malformed envelopes fail closed', () => {
  const value = fixture();
  for (const field of ['target', 'casWinner', 'authorizationPolicyBytes', 'evaluationTime', 'authorizationDecision']) denied({ ...value, bytes: jcs({ ...value.graph, [field]: true }) });
  for (const bytes of [value.bytes + ' ', '{}', 'x'.repeat(8388609)]) denied({ ...value, bytes });
  assert.equal(value.verifier.verify(value.bytes).state, 'blocked'); denied(value, '2027-09-01T00:00:00Z');
  for (const field of Object.keys(value.graph)) { const graph = { ...value.graph }; delete graph[field]; denied({ ...value, bytes: jcs(graph) }); }
  denied(fixture({ edits: { definition: (definition) => { definition.dataOperations = [{ kind: 'execute-sql', sql: 'arbitrary' }]; } } }));
  denied(fixture({ edits: { definition: (definition) => { definition.affectedTenants.push('foreign-tenant'); } } }));
  denied(fixture({ edits: { definition: (definition) => { definition.dataOperations[0].column = '__proto__'; } } }));
  const config = { ...value.config, extra: true }; assert.throws(() => createMigrationGraphVerifier(jcs(config)), /MIGRATION_CONFIGURATION_INVALID/);
});
