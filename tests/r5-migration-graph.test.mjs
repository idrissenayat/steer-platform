import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createMigrationGraphVerifier, policyDigest } from '../intent/0062/migration-graph.candidate.mjs';
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
  const phase = options.phase ?? 'expand', edits = options.edits ?? {}, edit = (key, value) => { edits[key]?.(value); return value; };
  const definition = { planId: 'plan-1', executionId: 'execution-1', phase, batch: 'batch-1', checkpoint: 'checkpoint-1', schemaFrom: 'schema-v1', schemaTo: 'schema-v2',
    oldAppVersion: 'app-v1', newAppVersion: 'app-v2', columns: [phase === 'contract' ? 'old' : 'new'],
    dataOperations: [phase === 'expand' ? { kind: 'add-column', column: 'new', defaultValue: null } : phase === 'backfill' ? { kind: 'copy-column', sourceColumn: 'old', targetColumn: 'new' } : { kind: 'drop-column', column: 'old' }],
    affectedTenants: [scope.tenant], batchRowIds: phase === 'backfill' ? ['row-1'] : ['row-1', 'row-2'], supportedReaders: ['app-v1', 'app-v2'], supportedWriters: ['app-v1', 'app-v2'],
    allowedRollbacks: ['none', 'before-backfill', 'during-backfill', 'after-backfill'] };
  edit('definition', definition);
  const data = { schemaVersion: 'schema-v1', columns: phase === 'expand' ? ['old'] : ['new', 'old'], rows: ['row-1', 'row-2'].map((rowId, index) => ({ rowId,
    values: phase === 'expand' ? { old: `value-${index}` } : { new: phase === 'contract' ? `value-${index}` : null, old: `value-${index}` } })) };
  const before = { ...Object.fromEntries(sourceFields.map((key) => [key, Buffer.from(`${key}: original e\u0301\n\0`, 'utf8').toString('base64')])), dataBytes: jcs(data) };
  const beforeTruthBytes = jcs(before);
  const config = { version: 'steer-migration-context/v1', implementationRevision: target.implementationRevision, repositoryId: scope.repositoryId, installationId: scope.installationId,
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
    expected.schemaVersion = 'schema-v2';
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
  const graph = edit('graph', { version: 'steer-migration-graph/v1', ...inputs, cleanupBundleBytes, actionBundleBytes: jcs(actionBundle), afterTruthBytes, afterProofBytes: jcs(afterProof),
    rollbackTruthBytes, rollbackProofBytes: rollback ? jcs(rollback) : '', journalBytes: jcs(journal), resultBytes: jcs(result) });
  return { bytes: jcs(graph), graph, config, configBytes, verifier: createMigrationGraphVerifier(configBytes) };
}
const denied = (value, now = evaluation) => assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'MIGRATION_GRAPH_INVALID', effects: zeroEffects(), journalEffects: 0 });

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
