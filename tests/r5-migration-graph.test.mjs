import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createMigrationGraphVerifier, createStagedMigrationGraphVerifier, stagedPolicyDigest as stagedMigrationPolicyDigest, policyDigest } from '../intent/0062/migration-graph.candidate.mjs';
import { createMigrationTimeVerifier, policyDigest as exactPolicyDigest } from '../intent/0090/migration-time.candidate.mjs';
import { exactInstant, formatExactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { createMigrationCompatibilityVerifier, createStagedMigrationCompatibilityVerifier, stagedPolicyDigest as stagedCompatibilityPolicyDigest,
  modelDigest as compatibilityModelDigest, policyDigest as compatibilityPolicyDigest } from '../intent/0091/migration-compatibility.candidate.mjs';
import { createDualColumnModel } from '../intent/0091/dual-column.candidate.mjs';
import { createMigrationChainVerifier, policyDigest as chainPolicyDigest } from '../intent/0092/migration-chain.candidate.mjs';
import { createMigrationCheckpointVerifier, policyDigest as checkpointPolicyDigest } from '../intent/0093/migration-checkpoint.candidate.mjs';
import { createMigrationChainObservationVerifier, policyDigest as observationPolicyDigest } from '../intent/0094/current-chain.candidate.mjs';
import { createMigrationCheckpointSequenceVerifier, policyDigest as sequencePolicyDigest } from '../intent/0095/checkpoint-sequence.candidate.mjs';
import { createLatestMigrationCheckpointVerifier, policyDigest as latestCheckpointPolicyDigest } from '../intent/0096/latest-checkpoint.candidate.mjs';
import { createCurrentMigrationObservationVerifier } from '../intent/0094/migration-observation.candidate.mjs';
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
  const at = (second) => formatExactInstant(exactInstant('2026-09-04T12:00:00Z') + BigInt(second) * BigInt(options.tickNanoseconds ?? 1000000000) + BigInt(options.nanoseconds ?? 0) + BigInt(options.timeOffset ?? 0) * 1000000000n);
  const evaluation = options.evaluationTime ?? at(60), until = at(options.horizon ?? 180), policyDigest = options.staged ? stagedMigrationPolicyDigest : options.exact ? exactPolicyDigest : originalPolicyDigest;
  const phase = options.phase ?? 'expand', edits = options.edits ?? {}, edit = (key, value) => { edits[key]?.(value); return value; };
  const baseVersion = options.successorTuple ? 2 : 1;
  const schemaFrom = `schema-v${baseVersion + (options.staged && phase !== 'expand' ? 1 : 0)}`,
    schemaTo = `schema-v${baseVersion + (options.staged && phase === 'contract' ? 2 : 1)}`;
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
  const config = { version: options.staged ? 'steer-migration-context/v3' : options.exact ? 'steer-migration-context/v2' : 'steer-migration-context/v1', implementationRevision: target.implementationRevision, repositoryId: scope.repositoryId, installationId: scope.installationId,
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
      ...(options.humanIdentity ? { authorityId: `${options.humanIdentity}-authority`, providerRecordId: `${options.humanIdentity}-provider`, idempotencyKey: `${options.humanIdentity}-idempotency` } : {}),
      allowedCopyProviders: ['fixture-provider-a'], copyInventoryDigest: inventory.recordDigest, identityEvidenceDigest: identity.recordDigest, authenticatedAt: at(4), decidedAt: at(5),
      conditions: [`migration-execution:${definition.executionId}`, `plan:${plan.recordDigest}`, `backup:${backup.recordDigest}`, `columns:${sha256(jcs(definition.columns))}`,
        `operations:${sha256(jcs(definition.dataOperations))}`, `tenants:${sha256(jcs(definition.affectedTenants))}`, `input:${inputDigest}`] });
    const provider = seal({ ...JSON.parse(bundle.providerProofBytes), providerRecordId: authority.providerRecordId, authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }, 'human-provider');
    const full = seal({ ...authority, providerProofDigest: provider.recordDigest }, 'authority'); authorityDigest = full.recordDigest;
    const humanHeadId = options.humanIdentity ? `${options.humanIdentity}-head` : JSON.parse(bundle.casHeadBytes).headId;
    Object.assign(bundle, { authorityBytes: jcs(full), providerProofBytes: jcs(provider), inventoryBytes: jcs(inventory), identityEvidenceBytes: jcs(identity),
      casHeadBytes: jcs(seal({ ...JSON.parse(bundle.casHeadBytes), headId: humanHeadId, snapshotAt: at(5), validThrough: until }, 'cas-authority')),
      replayLedgerBytes: jcs(seal({ ...JSON.parse(bundle.replayLedgerBytes), headId: humanHeadId, snapshotAt: at(5), validThrough: until }, 'replay-authority')),
      casReservationBytes: jcs(seal({ ...JSON.parse(bundle.casReservationBytes), headId: humanHeadId, idempotencyKey: authority.idempotencyKey,
        ...(options.humanIdentity ? { reservationId: `${options.humanIdentity}-reservation` } : {}), requestDigest: full.recordDigest, authorityDigest: full.recordDigest, recordedAt: at(6), validThrough: until }, 'cas-authority')), evaluationTime: evaluation });
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
    if (phase === 'backfill') for (const row of expected.rows) if (definition.batchRowIds.includes(row.rowId)) row.values.new = row.values.old;
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
  const graph = edit('graph', { version: options.staged ? 'steer-migration-graph/v3' : options.exact ? 'steer-migration-graph/v2' : 'steer-migration-graph/v1', ...inputs, cleanupBundleBytes, actionBundleBytes: jcs(actionBundle), afterTruthBytes, afterProofBytes: jcs(afterProof),
    rollbackTruthBytes, rollbackProofBytes: rollback ? jcs(rollback) : '', journalBytes: jcs(journal), resultBytes: jcs(result) });
  return { bytes: jcs(graph), graph, config, configBytes, exact: options.staged === true || options.exact === true, evaluationTime: evaluation,
    verifier: (options.staged ? createStagedMigrationGraphVerifier : options.exact ? createMigrationTimeVerifier : createMigrationGraphVerifier)(configBytes) };
}
const originalPolicyDigest = policyDigest;
const denied = (value, now = value.evaluationTime) => assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'MIGRATION_GRAPH_INVALID', effects: zeroEffects(), journalEffects: 0,
  ...(value.exact ? { executionAuthorized: false } : {}) });

function compatibilityFixture(options = {}, edits = {}) {
  const value = fixture({ exact: true, ...options }), context = { version: options.staged ? 'steer-migration-compatibility-context/v2' : 'steer-migration-compatibility-context/v1', modelDigest: compatibilityModelDigest,
    migrationConfigBytes: value.configBytes, sourceColumn: 'old', targetColumn: 'new' };
  edits.context?.(context); const contextBytes = jcs(context), verifier = (options.staged ? createStagedMigrationCompatibilityVerifier : createMigrationCompatibilityVerifier)(contextBytes);
  const envelope = { version: options.staged ? 'steer-migration-compatibility/v2' : 'steer-migration-compatibility/v1', configDigest: sha256(contextBytes), policyDigest: options.staged ? stagedCompatibilityPolicyDigest : compatibilityPolicyDigest, graphBytes: value.bytes };
  edits.envelope?.(envelope);
  return { ...value, contextBytes, envelope, compatibilityBytes: jcs(envelope), compatibilityVerifier: verifier };
}
function compatibilityDenied(value) {
  assert.deepEqual(value.compatibilityVerifier.verify(value.compatibilityBytes, value.evaluationTime), { state: 'blocked', firstError: 'MIGRATION_COMPATIBILITY_INVALID',
    executionAuthorized: false, effects: zeroEffects(), journalEffects: 0 });
}

function chainFixture(options = {}, edits = {}) {
  const phases = ['expand', 'backfill', 'backfill', 'contract'], values = [], steps = [];
  let beforeData;
  for (const [index, phase] of phases.entries()) {
    const label = `step-${index + 1}`, additional = options.stepEdits?.[index] ?? {};
    const defaults = {
      definition: (record) => { record.planId = `plan-${label}`; record.executionId = `execution-${label}`; record.batch = `batch-${label}`; record.checkpoint = `checkpoint-${label}`;
        if (phase === 'backfill') record.batchRowIds = [`row-${index}`]; },
      'before-data': (data) => { if (beforeData) Object.assign(data, structuredClone(beforeData)); },
      operation: (record) => { record.requestId = `request-${label}`; record.idempotencyKey = `idem-${label}`; record.casHead = sha256(label); },
      'action-upstream': (record) => { record.credentialId = `up-${label}`; }, 'action-downstream': (record) => { record.credentialId = `down-${label}`; },
      'action-head': (record) => { record.headId = `head-${label}`; }, 'action-replay': (record) => { record.headId = `head-${label}`; },
      'action-reservation': (record) => { record.reservationId = `reservation-${label}`; }, after: (record) => { record.transactionId = `transaction-${label}`; },
    };
    const merged = Object.fromEntries([...new Set([...Object.keys(defaults), ...Object.keys(additional)])].map((key) => [key, (record) => { defaults[key]?.(record); additional[key]?.(record); }]));
    const value = compatibilityFixture({ staged: true, phase, successorTuple: options.successorTuple, timeOffset: options.timeOffsets?.[index] ?? index * 30, evaluationTime: options.evaluationTime ?? at(150), humanIdentity: options.humanIdentity, horizon: options.horizon,
      replay: options.replay, interruption: options.interruptionStep === index ? 'before-effect' : 'none', rollback: options.rollbackStep === index ? 'during-backfill' : 'none', edits: merged });
    values.push(value); steps.push({ stepId: label, phase, batch: `batch-${label}`, checkpoint: `checkpoint-${label}`, compatibilityContextBytes: value.contextBytes });
    beforeData = JSON.parse(JSON.parse(value.graph.afterTruthBytes).dataBytes);
  }
  const context = { version: 'steer-migration-chain-context/v1', chainId: 'migration-chain-1', initialTruthDigest: sha256(values[0].graph.beforeTruthBytes),
    finalTruthDigest: sha256(values.at(-1).graph.afterTruthBytes), steps };
  edits.context?.(context); const contextBytes = jcs(context), verifier = createMigrationChainVerifier(contextBytes);
  const envelope = { version: 'steer-migration-chain/v1', configDigest: sha256(contextBytes), policyDigest: chainPolicyDigest,
    attempts: values.map((value, index) => ({ stepId: `step-${index + 1}`, compatibilityBytes: value.compatibilityBytes })) };
  edits.envelope?.(envelope);
  return { values, context, contextBytes, envelope, bytes: jcs(envelope), evaluationTime: options.evaluationTime ?? at(150), verifier };
}
function chainDenied(value) {
  assert.deepEqual(value.verifier.verify(value.bytes, value.evaluationTime), { state: 'blocked', firstError: 'MIGRATION_CHAIN_INVALID', executionAuthorized: false, effects: zeroEffects(), journalEffects: 0 });
}

function checkpointFixture(options = {}, edits = {}) {
  const source = options.source ?? chainFixture({ ...options.chainOptions, replay: options.replay }, { envelope: (envelope) => { if (options.prefix) envelope.attempts = envelope.attempts.slice(0, options.prefix); } });
  const observedAt = options.observedAt ?? source.evaluationTime, selectedPolicy = options.sequence ? sequencePolicyDigest : checkpointPolicyDigest;
  const original = (options.sequence ? createMigrationChainObservationVerifier(source.contextBytes) : source.verifier).verify(source.bytes, observedAt);
  assert.ok(['verified-migration-chain', 'verified-migration-chain-pending'].includes(original.state));
  const edit = (label, record) => { edits[label]?.(record); return record; };
  const slot = options.slotId ?? '1';
  const context = edit('context', { version: options.sequence ? 'steer-migration-checkpoint-context/v2' : 'steer-migration-checkpoint-context/v1', chainContextBytes: source.contextBytes, checkpointId: `checkpoint-${slot}`,
    idempotencyKey: `checkpoint-command-${slot}`, headId: 'checkpoint-head-1', storeId: 'fixture-migration-store', objectKey: 'checkpoints/chain-1.json' });
  const contextBytes = jcs(context), configDigest = sha256(contextBytes), chainDigest = sha256(source.bytes);
  const predecessor = options.previous, previousStore = predecessor ? JSON.parse(predecessor.envelope.currentStoreBytes) : null;
  const previousHead = previousStore ? JSON.parse(previousStore.headBytes) : null, previousReservation = previousStore ? JSON.parse(previousStore.reservationBytes) : null;
  const predecessorDigest = predecessor ? sha256(jcs({ checkpointBytes: predecessor.bytes, checkpointDigest: JSON.parse(predecessor.envelope.checkpointBytes).recordDigest,
    headDigest: previousHead.recordDigest, reservationDigest: previousReservation.recordDigest })) : null;
  const binding = options.sequence ? { observationPolicyDigest, predecessorDigest } : {};
  const requestDigest = sha256(jcs({ configDigest, policyDigest: selectedPolicy, chainDigest, observedAt, ...binding }));
  const emit = (label, domain, fields, second, sourceName = 'authoritative-migration-checkpoint-cas') => seal(edit(label, {
    kind: `migration-checkpoint-${label}`, source: sourceName, configDigest, requestDigest, recordedAt: at(second + (options.clockOffset ?? 0)), validThrough: options.validThrough ?? at(180), ...binding, ...fields,
  }), options.domains?.[label] ?? domain);
  let checkpoint, retention;
  function store(phase, previous, second) {
    const opening = phase === 'opening', current = phase === 'current';
    const openingHead = previousHead?.head ?? sha256('opening-head'), openingPrevious = previousHead?.previousHead ?? sha256('prior-head');
    const head = emit(`${phase}-head`, 'cas-authority', { headId: context.headId, head: opening ? openingHead : sha256(options.sequence ? `terminal-head-${slot}` : 'terminal-head'),
      previousHead: opening ? openingPrevious : openingHead, sequence: (previousHead?.sequence ?? 4) + (opening ? 0 : 1),
      checkpointDigest: opening ? previousHead?.checkpointDigest ?? null : checkpoint.recordDigest, retentionDigest: opening ? previousHead?.retentionDigest ?? null : retention.recordDigest }, second);
    const replay = emit(`${phase}-replay`, 'replay-authority', { headDigest: head.recordDigest, idempotencyKey: context.idempotencyKey,
      status: opening ? 'unused' : 'committed', resultDigest: opening ? null : checkpoint.recordDigest }, second + 1);
    const reservation = emit(`${phase}-reservation`, 'cas-authority', { reservationId: options.sequence ? `checkpoint-${slot}-${phase}-reservation` : `checkpoint-${phase}-reservation`, headDigest: head.recordDigest,
      replayDigest: replay.recordDigest, previousReservationDigest: previous?.reservation.recordDigest ?? (opening ? previousReservation?.recordDigest ?? null : null),
      status: opening ? 'reserved' : current ? 'already-committed' : 'committed', winner: !current }, second + 2);
    return { head, replay, reservation, bytes: jcs(edit(`${phase}-store`, { headBytes: jcs(head), replayBytes: jcs(replay), reservationBytes: jcs(reservation) })) };
  }
  const opening = store('opening', null, 150);
  checkpoint = emit('checkpoint', 'record', { kind: 'migration-checkpoint', chainConfigDigest: source.verifier.configDigest, checkpointId: context.checkpointId,
    chainDigest, chainEvidenceDigest: original.evidenceDigest, observedAt, currentTruthDigest: original.currentTruthDigest, completedStepCount: original.completedStepCount,
    requiredStepCount: original.requiredStepCount, attemptCount: original.attemptCount, replayCount: original.replayCount,
    nextStepId: source.context.steps[original.completedStepCount]?.stepId ?? null, status: original.state === 'verified-migration-chain' ? 'complete' : 'pending',
    openingReservationDigest: opening.reservation.recordDigest }, 153, 'authoritative-migration-checkpoint-store');
  retention = emit('retention', 'provider', { checkpointDigest: checkpoint.recordDigest, retainedBytesDigest: chainDigest,
    storeId: context.storeId, objectKey: context.objectKey, objectVersion: `version-${slot}`, complete: true }, 154, 'authoritative-migration-checkpoint-storage');
  const terminal = store('terminal', opening, 155);
  const delivery = emit('delivery', 'recovery-provider', { checkpointDigest: checkpoint.recordDigest, terminalReservationDigest: terminal.reservation.recordDigest,
    outcome: options.delivery ?? 'acknowledgment-lost' }, 158, 'authoritative-migration-checkpoint-transport');
  const current = store('current', terminal, 160);
  const envelope = edit('envelope', { version: options.sequence ? 'steer-migration-checkpoint/v2' : 'steer-migration-checkpoint/v1', configDigest, policyDigest: selectedPolicy, chainBytes: source.bytes, observedAt,
    openingStoreBytes: opening.bytes, checkpointBytes: jcs(checkpoint), retentionBytes: jcs(retention), terminalStoreBytes: terminal.bytes, deliveryBytes: jcs(delivery), currentStoreBytes: current.bytes });
  return { source, contextBytes, envelope, bytes: jcs(envelope), evaluationTime: at(170), verifier: options.sequence ? undefined : createMigrationCheckpointVerifier(contextBytes) };
}
function checkpointDenied(value, now = value.evaluationTime) {
  assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'MIGRATION_CHECKPOINT_INVALID', executionAuthorized: false,
    resumeAuthorized: false, effects: zeroEffects(), journalEffects: 0 });
}

function sequenceFixture(options = {}, edits = {}) {
  const source = options.source ?? chainFixture({ timeOffsets: [0, 30, 90, 120], replay: options.replay, successorTuple: options.successorTuple });
  const prefix = { ...source, envelope: { ...source.envelope, attempts: source.envelope.attempts.slice(0, options.prefix ?? 2) } };
  prefix.bytes = jcs(prefix.envelope);
  const first = checkpointFixture({ sequence: true, source: prefix, observedAt: options.firstObservedAt ?? at(60),
    clockOffset: options.firstOffset ?? -90, validThrough: options.validThrough }, edits.first);
  const second = checkpointFixture({ sequence: true, source, previous: first, slotId: '2', observedAt: options.secondObservedAt ?? at(150),
    clockOffset: options.secondOffset ?? 0, validThrough: options.validThrough }, edits.second);
  const context = { version: 'steer-migration-checkpoint-sequence-context/v1', checkpointContextBytes: [first.contextBytes, second.contextBytes] };
  edits.context?.(context); const contextBytes = jcs(context), verifier = createMigrationCheckpointSequenceVerifier(contextBytes);
  const envelope = { version: 'steer-migration-checkpoint-sequence/v1', configDigest: sha256(contextBytes), policyDigest: sequencePolicyDigest, checkpoints: [first.bytes, second.bytes] };
  edits.envelope?.(envelope);
  return { source, first, second, context, contextBytes, envelope, bytes: jcs(envelope), verifier, evaluationTime: options.evaluationTime ?? at(170) };
}
function sequenceDenied(value, now = value.evaluationTime) {
  assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'MIGRATION_CHECKPOINT_SEQUENCE_INVALID', executionAuthorized: false,
    resumeAuthorized: false, effects: zeroEffects(), journalEffects: 0 });
}

function latestCheckpointFixture(options = {}, edits = {}) {
  const sequence = options.sequence ?? sequenceFixture({ replay: options.replay, successorTuple: options.successorTuple });
  const edit = (label, value) => { edits[label]?.(value); return value; };
  const context = edit('context', { version: 'steer-latest-migration-checkpoint-context/v1', sequenceContextBytes: sequence.contextBytes,
    queryId: 'latest-checkpoint-query-1', nonce: sha256('trusted-query-challenge-1'), requestedAt: at(164) });
  const contextBytes = jcs(context), configDigest = sha256(contextBytes), queryDigest = sha256(jcs({ configDigest, policyDigest: latestCheckpointPolicyDigest }));
  const tail = JSON.parse(JSON.parse(sequence.bytes).checkpoints.at(-1)), current = JSON.parse(tail.currentStoreBytes), headState = JSON.parse(current.headBytes), retention = JSON.parse(tail.retentionBytes);
  const inventory = JSON.parse(sequence.contextBytes), slot = JSON.parse(inventory.checkpointContextBytes[0]);
  const emit = (label, kind, source, domain, second, fields) => seal(edit(label, { kind, source, configDigest, queryDigest, queryId: context.queryId,
    nonce: context.nonce, recordedAt: at(second), validThrough: at(180), ...fields }), options.domains?.[label] ?? domain);
  const request = emit('request', 'migration-checkpoint-query', 'authoritative-migration-checkpoint-query', 'record', 164,
    { chainConfigDigest: sha256(slot.chainContextBytes), headId: slot.headId, storeId: slot.storeId, objectKey: slot.objectKey, mode: 'latest-canonical-head' });
  const headKeys = ['headId', 'head', 'previousHead', 'sequence', 'checkpointDigest', 'retentionDigest', 'status'];
  const head = emit('head', 'migration-checkpoint-latest-head', 'authoritative-migration-checkpoint-cas', 'cas-authority', 165,
    { requestRecordDigest: request.recordDigest, ...Object.fromEntries(headKeys.filter((key) => key !== 'status').map((key) => [key, headState[key]])), status: 'committed' });
  const object = emit('object', 'migration-checkpoint-object-read', 'authoritative-migration-checkpoint-storage', 'provider', 166,
    { requestRecordDigest: request.recordDigest, headRecordDigest: head.recordDigest, storeId: slot.storeId, objectKey: slot.objectKey, objectVersion: retention.objectVersion,
      checkpointDigest: head.checkpointDigest, retentionDigest: head.retentionDigest, retainedBytesDigest: sha256(tail.chainBytes), complete: true });
  const confirmation = emit('confirmation', 'migration-checkpoint-head-confirmation', 'authoritative-migration-checkpoint-cas', 'cas-authority', 167,
    { requestRecordDigest: request.recordDigest, headRecordDigest: head.recordDigest, objectRecordDigest: object.recordDigest, ...Object.fromEntries(headKeys.map((key) => [key, head[key]])) });
  const audit = emit('audit', 'migration-checkpoint-latest-audit', 'independent-migration-checkpoint-observer', 'verifier', 168,
    { requestRecordDigest: request.recordDigest, headRecordDigest: head.recordDigest, objectRecordDigest: object.recordDigest, confirmationDigest: confirmation.recordDigest, outcome: 'verified' });
  const envelope = edit('envelope', { version: 'steer-latest-migration-checkpoint/v1', configDigest, policyDigest: latestCheckpointPolicyDigest,
    sequenceBytes: sequence.bytes, retainedChainBytes: tail.chainBytes, requestBytes: jcs(request), headBytes: jcs(head), objectBytes: jcs(object), confirmationBytes: jcs(confirmation), auditBytes: jcs(audit) });
  return { sequence, contextBytes, envelope, bytes: jcs(envelope), evaluationTime: at(170), verifier: createLatestMigrationCheckpointVerifier(contextBytes) };
}
function latestCheckpointDenied(value, now = value.evaluationTime) {
  assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'LATEST_MIGRATION_CHECKPOINT_INVALID', executionAuthorized: false,
    resumeAuthorized: false, effects: zeroEffects(), journalEffects: 0 });
}

test('0096: fresh query, exact object and stable head confirmation verify without performing a store query or another effect', () => {
  for (const successorTuple of [false, true]) for (const replay of [false, true]) {
    const value = latestCheckpointFixture({ successorTuple, replay }), bytes = value.bytes, result = value.verifier.verify(bytes, value.evaluationTime);
    assert.equal(result.state, 'verified-latest-migration-checkpoint-evidence'); assert.equal(result.completedStepCount, 4); assert.equal(result.status, 'complete');
    assert.equal(result.headObservationVerified, true); assert.equal(result.liveStoreQueried, false); assert.equal(result.executionAuthorized, false); assert.equal(result.resumeAuthorized, false);
    assert.equal(result.decision, 'REPLAY_NOOP'); assert.equal(result.observedAt, at(167)); assert.equal(result.evaluatedAt, at(170));
    assert.equal(result.sequenceDigest, sha256(value.sequence.bytes)); assert.equal(result.checkpointCount, 2); assert.deepEqual(result.effects, zeroEffects());
    assert.equal(result.journalEffects, 0); assert.equal(value.bytes, bytes); assert.deepEqual(value.verifier.verify(bytes, value.evaluationTime), result);
  }
});

test('0096: an internally valid older sequence is rejected when the canonical head reports its successor', () => {
  const complete = sequenceFixture(), contextBytes = jcs({ ...complete.context, checkpointContextBytes: complete.context.checkpointContextBytes.slice(0, 1) });
  const bytes = jcs({ ...complete.envelope, configDigest: sha256(contextBytes), checkpoints: complete.envelope.checkpoints.slice(0, 1) });
  const sequence = { contextBytes, bytes }, selected = createMigrationCheckpointSequenceVerifier(contextBytes).verify(bytes, at(170));
  assert.equal(selected.state, 'verified-migration-checkpoint-sequence'); assert.equal(selected.status, 'pending');
  const current = latestCheckpointFixture({ sequence });
  assert.equal(current.verifier.verify(current.bytes, at(170)).status, 'pending');
  const newer = JSON.parse(JSON.parse(complete.second.envelope.currentStoreBytes).headBytes);
  latestCheckpointDenied(latestCheckpointFixture({ sequence }, { head: (record) => {
    for (const field of ['head', 'previousHead', 'sequence', 'checkpointDigest', 'retentionDigest']) record[field] = newer[field];
  } }));
});

test('0096: all five query/readback sources require complete signatures, correct domains and the trusted nonce', () => {
  for (const label of ['request', 'head', 'object', 'confirmation', 'audit']) {
    for (const forge of [false, true]) latestCheckpointDenied(latestCheckpointFixture({}, { envelope: (envelope) => {
      const field = `${label}Bytes`; if (!forge) envelope[field] = '{}';
      else { const record = JSON.parse(envelope[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); envelope[field] = jcs(record); }
    } }));
    latestCheckpointDenied(latestCheckpointFixture({ domains: { [label]: label === 'object' ? 'record' : 'provider' } }));
    for (const field of ['nonce', 'queryId', 'queryDigest', 'configDigest', 'source']) latestCheckpointDenied(latestCheckpointFixture({}, {
      [label]: (record) => { record[field] = field.endsWith('Digest') || field === 'nonce' ? 'f'.repeat(64) : 'other'; },
    }));
  }
});

test('0096: canonical scope and retained bytes cannot be replaced by matching-looking digest claims', () => {
  for (const [label, field, replacement] of [
    ['request', 'chainConfigDigest', 'f'.repeat(64)], ['request', 'headId', 'other'], ['request', 'storeId', 'other'], ['request', 'objectKey', 'other'], ['request', 'mode', 'selected-checkpoint'],
    ['head', 'headId', 'other'], ['head', 'sequence', 5], ['head', 'checkpointDigest', 'f'.repeat(64)], ['head', 'retentionDigest', 'f'.repeat(64)],
    ['object', 'storeId', 'other'], ['object', 'objectKey', 'other'], ['object', 'objectVersion', 'version-1'], ['object', 'retainedBytesDigest', 'f'.repeat(64)], ['object', 'complete', false],
  ]) latestCheckpointDenied(latestCheckpointFixture({}, { [label]: (record) => { record[field] = replacement; } }));
  latestCheckpointDenied(latestCheckpointFixture({}, { envelope: (envelope) => {
    envelope.retainedChainBytes += '\n'; const object = JSON.parse(envelope.objectBytes);
    object.retainedBytesDigest = sha256(envelope.retainedChainBytes); envelope.objectBytes = jcs(seal(object, 'provider'));
  } }));
  latestCheckpointDenied(latestCheckpointFixture({}, { envelope: (envelope) => {
    const sequence = JSON.parse(envelope.sequenceBytes), tail = JSON.parse(sequence.checkpoints.at(-1)); tail.checkpointBytes = '{}';
    sequence.checkpoints[sequence.checkpoints.length - 1] = jcs(tail); envelope.sequenceBytes = jcs(sequence);
  } }));
});

test('0096: changes during object read, unknown commit state and unverified crash cuts fail closed', () => {
  for (const [label, field, replacement] of [
    ['head', 'status', 'pending'], ['head', 'status', 'unknown'], ['confirmation', 'status', 'unknown'],
    ['confirmation', 'head', 'f'.repeat(64)], ['confirmation', 'sequence', 7], ['confirmation', 'checkpointDigest', 'f'.repeat(64)],
    ['confirmation', 'retentionDigest', 'f'.repeat(64)], ['audit', 'outcome', 'acknowledgment-lost'], ['audit', 'outcome', 'pre-commit'],
    ['head', 'requestRecordDigest', 'f'.repeat(64)], ['object', 'headRecordDigest', 'f'.repeat(64)],
    ['confirmation', 'objectRecordDigest', 'f'.repeat(64)], ['confirmation', 'headRecordDigest', 'f'.repeat(64)], ['audit', 'confirmationDigest', 'f'.repeat(64)],
  ]) latestCheckpointDenied(latestCheckpointFixture({}, { [label]: (record) => { record[field] = replacement; } }));
});

test('0096: exact query chronology and current expiration cannot be refreshed by a new observation label', () => {
  for (const [label, field, replacement] of [
    ['request', 'recordedAt', at(163)], ['head', 'recordedAt', '2026-09-04T12:02:43.999999999Z'],
    ['object', 'recordedAt', '2026-09-04T12:02:44.999999999Z'], ['confirmation', 'recordedAt', '2026-09-04T12:02:45.999999999Z'],
    ['audit', 'recordedAt', '2026-09-04T12:02:46.999999999Z'], ['audit', 'validThrough', at(170)], ['request', 'validThrough', at(465)],
    ['confirmation', 'validThrough', at(181)],
  ]) latestCheckpointDenied(latestCheckpointFixture({}, { [label]: (record) => { record[field] = replacement; } }));
  const value = latestCheckpointFixture();
  for (const now of [undefined, null, at(167), at(180), at(465), '2026-09-04T12:02:50.000Z']) assert.equal(value.verifier.verify(value.bytes, now).state, 'blocked');
  latestCheckpointDenied(latestCheckpointFixture({}, { context: (context) => { context.requestedAt = at(160); }, request: (record) => { record.recordedAt = at(160); } }));
});

test('0096: closed context, envelope and factory-selected challenge prevent caller trust substitution', () => {
  for (const mutate of [(context) => { context.extra = true; }, (context) => { context.sequenceContextBytes = '{}'; },
    (context) => { context.nonce = '*'; }, (context) => { context.queryId = ''; }, (context) => { context.requestedAt = '2026-09-04T12:02:44.000Z'; }])
    assert.throws(() => latestCheckpointFixture({}, { context: mutate }), /LATEST_MIGRATION_CHECKPOINT_CONFIGURATION_INVALID/);
  assert.throws(() => createLatestMigrationCheckpointVerifier('x'.repeat(16777217)), /LATEST_MIGRATION_CHECKPOINT_CONFIGURATION_INVALID/);
  for (const mutate of [(input) => { input.extra = true; }, (input) => { input.policyDigest = sequencePolicyDigest; },
    (input) => { input.configDigest = 'f'.repeat(64); }, (input) => { input.version = 'steer-latest-migration-checkpoint/v0'; }]) latestCheckpointDenied(latestCheckpointFixture({}, { envelope: mutate }));
  const value = latestCheckpointFixture(), other = JSON.parse(value.contextBytes); other.nonce = sha256('different-trusted-challenge');
  assert.equal(createLatestMigrationCheckpointVerifier(jcs(other)).verify(value.bytes, at(170)).state, 'blocked');
});

test('0095: successive checkpoint heads extend an exact retained prefix with effect-free lost-acknowledgment readback', () => {
  for (const successorTuple of [false, true]) for (const replay of [false, true]) {
    const value = sequenceFixture({ successorTuple, replay }), bytes = value.bytes, result = value.verifier.verify(bytes, value.evaluationTime);
    assert.equal(result.state, 'verified-migration-checkpoint-sequence'); assert.equal(result.checkpointCount, 2);
    assert.equal(result.completedStepCount, 4); assert.equal(result.status, 'complete'); assert.equal(result.nextStepId, null);
    assert.equal(result.decision, 'REPLAY_NOOP'); assert.equal(result.deliveryOutcome, 'acknowledgment-lost');
    assert.equal(result.observationPolicyDigest, observationPolicyDigest); assert.equal(result.originalObservationVerified, false);
    assert.equal(result.latestStoreHeadVerified, false); assert.equal(result.executionAuthorized, false); assert.equal(result.resumeAuthorized, false);
    assert.deepEqual(result.effects, zeroEffects()); assert.equal(result.journalEffects, 0); assert.equal('sequenceEvidence' in result, false);
    assert.equal(result.sequenceDigest, sha256(bytes)); assert.equal(value.bytes, bytes);
    assert.deepEqual(value.verifier.verify(bytes, value.evaluationTime), result);
  }
});

test('0095: all checkpoint sources bind the current policy and exact fully reverified predecessor', () => {
  const labels = ['checkpoint', 'retention', 'delivery', ...['opening', 'terminal', 'current'].flatMap((phase) => [`${phase}-head`, `${phase}-replay`, `${phase}-reservation`])];
  for (const label of labels) for (const field of ['observationPolicyDigest', 'predecessorDigest'])
    sequenceDenied(sequenceFixture({}, { second: { [label]: (record) => { record[field] = 'f'.repeat(64); } } }));
  for (const label of labels) sequenceDenied(sequenceFixture({}, {
    envelope: (envelope) => {
      const first = JSON.parse(envelope.checkpoints[0]), outer = label.startsWith('opening-') ? 'openingStoreBytes' : label.startsWith('terminal-') ? 'terminalStoreBytes' : label.startsWith('current-') ? 'currentStoreBytes' : null;
      const field = outer ? `${label.split('-')[1]}Bytes` : `${label}Bytes`, container = outer ? JSON.parse(first[outer]) : first;
      const record = JSON.parse(container[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); container[field] = jcs(record);
      if (outer) first[outer] = jcs(container); envelope.checkpoints[0] = jcs(first);
    } }));
});

test('0095: successor opening cannot reset or fork the prior head, retention, reservation or sequence', () => {
  for (const [label, field, replacement] of [
    ['opening-head', 'head', 'f'.repeat(64)], ['opening-head', 'previousHead', 'f'.repeat(64)], ['opening-head', 'sequence', 4],
    ['opening-head', 'checkpointDigest', null], ['opening-head', 'retentionDigest', null], ['opening-reservation', 'previousReservationDigest', null],
    ['opening-reservation', 'reservationId', 'checkpoint-1-current-reservation'], ['terminal-reservation', 'reservationId', 'checkpoint-1-opening-reservation'],
    ['current-reservation', 'reservationId', 'checkpoint-1-terminal-reservation'], ['retention', 'objectVersion', 'version-1'],
    ['terminal-head', 'head', sha256('opening-head')],
  ]) sequenceDenied(sequenceFixture({}, { second: { [label]: (record) => { record[field] = replacement; } } }));
  // Both signed terminal and current heads agree: only cross-slot ABA detection denies.
  sequenceDenied(sequenceFixture({}, { second: {
    'terminal-head': (record) => { record.head = sha256('opening-head'); },
    'current-head': (record) => { record.head = sha256('opening-head'); },
  } }));
});

test('0095: independently valid old work cannot masquerade as a new checkpoint extension', () => {
  // All four graphs independently verify, but step three predates the first readback.
  const early = sequenceFixture({ source: chainFixture() });
  assert.equal(createMigrationChainObservationVerifier(early.source.contextBytes).verify(early.source.bytes, at(170)).state, 'verified-migration-chain');
  sequenceDenied(early);
  for (const mutation of ['no-extension', 'replay-only', 'changed-prefix']) {
    const source = chainFixture({ timeOffsets: [0, 30, 90, 120], replay: true });
    const firstSource = { ...source, envelope: { ...source.envelope, attempts: source.envelope.attempts.slice(0, 2) } }; firstSource.bytes = jcs(firstSource.envelope);
    const first = checkpointFixture({ sequence: true, source: firstSource, observedAt: at(60), clockOffset: -90 });
    if (mutation === 'no-extension') source.envelope.attempts = source.envelope.attempts.slice(0, 2);
    if (mutation === 'replay-only') source.envelope.attempts = [...source.envelope.attempts.slice(0, 2), source.envelope.attempts[1]];
    if (mutation === 'changed-prefix') {
      const attempt = source.envelope.attempts[0], compatibility = JSON.parse(attempt.compatibilityBytes), graph = JSON.parse(compatibility.graphBytes), action = JSON.parse(graph.actionBundleBytes);
      action.reservationBytes = jcs(seal({ ...JSON.parse(action.reservationBytes), reservationId: 'different-retained-reservation' }, 'cas-authority'));
      graph.actionBundleBytes = jcs(action); compatibility.graphBytes = jcs(graph); attempt.compatibilityBytes = jcs(compatibility);
    }
    source.bytes = jcs(source.envelope);
    const second = checkpointFixture({ sequence: true, source, previous: first, slotId: '2' });
    const contextBytes = jcs({ version: 'steer-migration-checkpoint-sequence-context/v1', checkpointContextBytes: [first.contextBytes, second.contextBytes] });
    const verifier = createMigrationCheckpointSequenceVerifier(contextBytes);
    sequenceDenied({ verifier, evaluationTime: at(170), bytes: jcs({ version: 'steer-migration-checkpoint-sequence/v1', configDigest: sha256(contextBytes), policyDigest: sequencePolicyDigest, checkpoints: [first.bytes, second.bytes] }) });
  }
});

test('0095: trusted checkpoint inventory, exact chronology and current expiry cannot be bypassed', () => {
  for (const field of ['chainContextBytes', 'headId', 'storeId', 'objectKey', 'checkpointId', 'idempotencyKey']) {
    assert.throws(() => sequenceFixture({}, { context: (context) => {
      const slot = JSON.parse(context.checkpointContextBytes[1]);
      slot[field] = ['checkpointId', 'idempotencyKey'].includes(field) ? JSON.parse(context.checkpointContextBytes[0])[field] : field === 'chainContextBytes' ? '{}' : 'other';
      context.checkpointContextBytes[1] = jcs(slot);
    } }), /MIGRATION_CHECKPOINT_SEQUENCE_CONFIGURATION_INVALID/);
  }
  for (const mutate of [(context) => { context.extra = true; }, (context) => { context.checkpointContextBytes = []; },
    (context) => { context.checkpointContextBytes = Array(17).fill(context.checkpointContextBytes[0]); }])
    assert.throws(() => sequenceFixture({}, { context: mutate }), /MIGRATION_CHECKPOINT_SEQUENCE_CONFIGURATION_INVALID/);
  assert.throws(() => createMigrationCheckpointSequenceVerifier('x'.repeat(8388609)), /MIGRATION_CHECKPOINT_SEQUENCE_CONFIGURATION_INVALID/);
  for (const mutate of [(input) => { input.checkpoints.reverse(); }, (input) => { input.checkpoints.pop(); }, (input) => { input.extra = true; },
    (input) => { input.policyDigest = checkpointPolicyDigest; }, (input) => { input.configDigest = 'f'.repeat(64); }]) sequenceDenied(sequenceFixture({}, { envelope: mutate }));
  for (const now of [undefined, null, at(161), at(180), '2026-09-04T12:02:50.000Z']) {
    const value = sequenceFixture(); assert.equal(value.verifier.verify(value.bytes, now).state, 'blocked');
  }
  sequenceDenied(sequenceFixture({}, { first: { 'current-reservation': (record) => { record.validThrough = at(165); } } }));
});

function retainedContractFixture(options = {}) {
  const failed = chainFixture({ rollbackStep: 3, horizon: options.horizon, humanIdentity: options.aliasAll ? undefined : 'failed-contract', stepEdits: { 3: {
    operation: (record) => { record.requestId = 'failed-contract-request'; record.idempotencyKey = 'failed-contract-command'; record.casHead = sha256('failed-contract'); },
    'action-upstream': (record) => { record.credentialId = 'failed-contract-up'; }, 'action-downstream': (record) => { record.credentialId = 'failed-contract-down'; },
    'action-head': (record) => { record.headId = 'failed-contract-head'; }, 'action-replay': (record) => { record.headId = 'failed-contract-head'; },
    'action-reservation': (record) => { record.reservationId = 'failed-contract-reservation'; }, after: (record) => { record.transactionId = 'failed-contract-transaction'; },
  } } });
  const complete = chainFixture({ humanIdentity: options.aliasAll ? undefined : 'retried-contract', horizon: options.horizon, evaluationTime: options.evaluationTime ?? at(170), timeOffsets: options.timeOffsets ?? [0, 30, 60, 120],
    stepEdits: options.stepEdits });
  assert.equal(failed.values[3].contextBytes, complete.values[3].contextBytes);
  const envelope = { ...complete.envelope, attempts: [...failed.envelope.attempts, complete.envelope.attempts[3]] };
  return { failed, complete, envelope, bytes: jcs(envelope), verifier: createMigrationChainObservationVerifier(complete.contextBytes), evaluationTime: at(170) };
}

test('0095: retained failed contract clocks stay immutable across a checkpoint and a later separately authorized retry', () => {
  const retained = retainedContractFixture({ horizon: 240, evaluationTime: at(210), timeOffsets: [0, 30, 60, 170] });
  const source = { ...retained.complete, envelope: retained.envelope, bytes: retained.bytes };
  const value = sequenceFixture({ source, prefix: 4, firstObservedAt: at(150), firstOffset: 0, secondObservedAt: at(210), secondOffset: 60,
    validThrough: at(240), evaluationTime: at(230) });
  const firstBytes = value.first.envelope.chainBytes, result = value.verifier.verify(value.bytes, value.evaluationTime);
  assert.equal(result.state, 'verified-migration-checkpoint-sequence'); assert.equal(result.status, 'complete'); assert.equal(result.completedStepCount, 4);
  assert.deepEqual(JSON.parse(value.second.envelope.chainBytes).attempts.slice(0, 4), JSON.parse(firstBytes).attempts);
  const oldGraph = JSON.parse(JSON.parse(JSON.parse(firstBytes).attempts[3].compatibilityBytes).graphBytes);
  assert.equal(JSON.parse(oldGraph.cleanupBundleBytes).evaluationTime, at(150));
  assert.equal(value.first.envelope.chainBytes, firstBytes); sequenceDenied(value, at(240));
});

test('0095: three ordered checkpoints preserve pending progress and reject a second update after completion', () => {
  const source = chainFixture({ horizon: 240, timeOffsets: [0, 30, 90, 140], evaluationTime: at(170) });
  const partial = { ...source, envelope: { ...source.envelope, attempts: source.envelope.attempts.slice(0, 3) } }; partial.bytes = jcs(partial.envelope);
  const pair = sequenceFixture({ source: partial, secondObservedAt: at(120), secondOffset: -30, validThrough: at(240), evaluationTime: at(190) });
  const pending = pair.verifier.verify(pair.bytes, pair.evaluationTime);
  assert.equal(pending.state, 'verified-migration-checkpoint-sequence'); assert.equal(pending.status, 'pending'); assert.equal(pending.nextStepId, 'step-4');
  const third = checkpointFixture({ sequence: true, source, previous: pair.second, slotId: '3', observedAt: at(170), clockOffset: 20, validThrough: at(240) });
  const contextBytes = jcs({ ...pair.context, checkpointContextBytes: [...pair.context.checkpointContextBytes, third.contextBytes] });
  const verifier = createMigrationCheckpointSequenceVerifier(contextBytes), bytes = jcs({ ...pair.envelope, configDigest: sha256(contextBytes), checkpoints: [...pair.envelope.checkpoints, third.bytes] });
  assert.equal(verifier.verify(bytes, at(190)).checkpointCount, 3); assert.equal(verifier.verify(bytes, at(190)).status, 'complete');
  const fourth = checkpointFixture({ sequence: true, source, previous: third, slotId: '4', observedAt: at(200), clockOffset: 50, validThrough: at(240) });
  const extendedContext = jcs({ ...pair.context, checkpointContextBytes: [...JSON.parse(contextBytes).checkpointContextBytes, fourth.contextBytes] });
  sequenceDenied({ verifier: createMigrationCheckpointSequenceVerifier(extendedContext), evaluationTime: at(230), bytes: jcs({ ...pair.envelope, configDigest: sha256(extendedContext), checkpoints: [...JSON.parse(bytes).checkpoints, fourth.bytes] }) });
});

test('0094: current audit verifies a retained failed contract plus fresh retry without rewriting its immutable prefix', () => {
  const value = retainedContractFixture(), originalBytes = value.bytes;
  assert.equal(value.failed.verifier.verify(value.failed.bytes, value.failed.evaluationTime).state, 'verified-migration-chain-pending');
  assert.equal(value.complete.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
  const result = value.verifier.verify(value.bytes, value.evaluationTime);
  assert.equal(result.state, 'verified-migration-chain'); assert.equal(result.completedStepCount, 4); assert.equal(result.attemptCount, 5);
  assert.equal(result.originalObservationsVerified, false); assert.equal(result.executionAuthorized, false); assert.equal(result.liveCompatibilityVerified, false);
  assert.equal(result.evaluatedAt, at(170)); assert.deepEqual(result.effects, zeroEffects()); assert.equal(result.journalEffects, 0);
  assert.equal(value.bytes, originalBytes);
  assert.deepEqual(JSON.parse(value.bytes).attempts.slice(0, 4), JSON.parse(value.failed.bytes).attempts);
  const observed = createCurrentMigrationObservationVerifier(value.failed.values[3].contextBytes).verify(value.failed.values[3].compatibilityBytes, at(170));
  assert.equal(observed.state, 'verified-migration-model-compatibility'); assert.equal(observed.originalObservationVerified, false);
  assert.equal(observed.graphDigest, sha256(value.failed.values[3].bytes));
});

test('0094: current audits preserve original evidence digest when source clocks already match and reject expired native proof', () => {
  const source = chainFixture(), verifier = createMigrationChainObservationVerifier(source.contextBytes), original = source.verifier.verify(source.bytes, source.evaluationTime);
  let result = verifier.verify(source.bytes, source.evaluationTime);
  assert.equal(result.evidenceDigest, original.evidenceDigest); assert.equal(result.currentTruthDigest, original.currentTruthDigest);
  result = verifier.verify(source.bytes, at(170)); assert.equal(result.state, 'verified-migration-chain'); assert.equal(result.evidenceDigest, original.evidenceDigest);
  assert.equal(verifier.verify(source.bytes, at(180)).state, 'blocked');
  const expired = chainFixture({ stepEdits: { 3: { human: (record) => { record.expiresAt = at(165); } } } });
  assert.equal(expired.verifier.verify(expired.bytes, expired.evaluationTime).state, 'verified-migration-chain');
  assert.equal(createMigrationChainObservationVerifier(expired.contextBytes).verify(expired.bytes, at(170)).state, 'blocked');
});

test('0094: distinct contract attempts cannot relabel one authority, provider or idempotency identity', () => {
  const aliased = retainedContractFixture({ aliasAll: true }); assert.equal(aliased.verifier.verify(aliased.bytes, aliased.evaluationTime).state, 'blocked');
  for (const [field, replacement] of [['authorityId', 'failed-contract-authority'], ['providerRecordId', 'failed-contract-provider'], ['idempotencyKey', 'failed-contract-idempotency']]) {
    const value = retainedContractFixture({ stepEdits: { 3: { human: (record) => { record[field] = replacement; } } } });
    const single = createCurrentMigrationObservationVerifier(value.complete.values[3].contextBytes).verify(value.complete.values[3].compatibilityBytes, value.evaluationTime);
    assert.equal(single.state, 'verified-migration-model-compatibility'); assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
  }
});

test('0094: current-time clock rebinding does not hide changed immutable replay bytes, forged signatures or missing proofs', () => {
  const source = chainFixture({ replay: true }), verifier = createMigrationChainObservationVerifier(source.contextBytes);
  const exact = { ...source.envelope, attempts: [...source.envelope.attempts, source.envelope.attempts.at(-1)] };
  assert.equal(verifier.verify(jcs(exact), at(170)).state, 'verified-migration-chain');
  const changed = structuredClone(exact); changed.attempts[changed.attempts.length - 1] = structuredClone(changed.attempts.at(-1));
  const last = changed.attempts.at(-1), compatibility = JSON.parse(last.compatibilityBytes), graph = JSON.parse(compatibility.graphBytes), bundle = JSON.parse(graph.cleanupBundleBytes);
  bundle.evaluationTime = at(160); graph.cleanupBundleBytes = jcs(bundle); compatibility.graphBytes = jcs(graph); last.compatibilityBytes = jcs(compatibility);
  assert.equal(createCurrentMigrationObservationVerifier(source.values[3].contextBytes).verify(last.compatibilityBytes, at(170)).state, 'verified-migration-model-compatibility');
  assert.equal(verifier.verify(jcs(changed), at(170)).state, 'blocked');
  for (const mutate of [(value) => { value.evaluationTime = at(171); }, (value) => { value.evaluationTime = 'invalid'; },
    (value) => { value.providerProofBytes = '{}'; }, (value) => { const authority = JSON.parse(value.authorityBytes); authority.signature.valueBase64 = Buffer.alloc(64).toString('base64'); value.authorityBytes = jcs(authority); }]) {
    const candidate = chainFixture({ stepEdits: { 3: { 'human-bundle': mutate } } });
    assert.equal(createMigrationChainObservationVerifier(candidate.contextBytes).verify(candidate.bytes, at(170)).state, 'blocked');
  }
  for (const now of [undefined, '', '2026-09-04T12:02:50.000Z']) assert.equal(verifier.verify(source.bytes, now).state, 'blocked');
});

test('0093: exact persisted checkpoint and current readback verify after lost or delivered acknowledgment without another effect', () => {
  for (const prefix of [2, 4]) for (const delivery of ['delivered', 'acknowledgment-lost']) for (const replay of [false, true]) {
    const value = checkpointFixture({ prefix, delivery, replay }), originalBytes = value.bytes, result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'verified-migration-checkpoint-readback'); assert.equal(result.decision, 'REPLAY_NOOP'); assert.equal(result.deliveryOutcome, delivery);
    assert.equal(result.completedStepCount, prefix); assert.equal(result.nextStepId, prefix === 4 ? null : 'step-3'); assert.equal(result.status, prefix === 4 ? 'complete' : 'pending');
    assert.equal(result.executionAuthorized, false); assert.equal(result.resumeAuthorized, false); assert.deepEqual(result.effects, zeroEffects()); assert.equal(result.journalEffects, 0);
    assert.equal(result.chainDigest, sha256(value.source.bytes)); assert.equal(value.bytes, originalBytes); assert.equal(result.observedAt, at(150)); assert.equal(result.evaluatedAt, at(170));
    assert.deepEqual(value.verifier.verify(value.bytes, value.evaluationTime), result);
  }
});

test('0093: all twelve independent checkpoint/store/delivery records are required and signature-verified', () => {
  const locations = [['checkpointBytes'], ['retentionBytes'], ['deliveryBytes'], ...['openingStoreBytes', 'terminalStoreBytes', 'currentStoreBytes']
    .flatMap((store) => ['headBytes', 'replayBytes', 'reservationBytes'].map((field) => [store, field]))];
  for (const [outer, inner] of locations) for (const forge of [false, true]) {
    const value = checkpointFixture({}, { envelope: (envelope) => {
      const container = inner ? JSON.parse(envelope[outer]) : envelope, field = inner ?? outer;
      if (forge) { const record = JSON.parse(container[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); container[field] = jcs(record); }
      else container[field] = '{}';
      if (inner) envelope[outer] = jcs(container);
    } }); checkpointDenied(value);
  }
  for (const label of ['checkpoint', 'retention', 'delivery', 'opening-head', 'opening-replay', 'opening-reservation', 'terminal-head', 'terminal-replay', 'terminal-reservation', 'current-head', 'current-replay', 'current-reservation'])
    checkpointDenied(checkpointFixture({ domains: { [label]: label === 'retention' ? 'record' : 'provider' } }));
});

test('0093: checkpoint progress and retained object identity derive from exact verified chain bytes', () => {
  for (const [label, field, replacement] of [
    ['checkpoint', 'chainDigest', 'f'.repeat(64)], ['checkpoint', 'chainEvidenceDigest', 'f'.repeat(64)], ['checkpoint', 'chainConfigDigest', 'f'.repeat(64)],
    ['checkpoint', 'completedStepCount', 3], ['checkpoint', 'requiredStepCount', 5], ['checkpoint', 'attemptCount', 5], ['checkpoint', 'replayCount', 1],
    ['checkpoint', 'currentTruthDigest', 'f'.repeat(64)], ['checkpoint', 'nextStepId', 'step-1'], ['checkpoint', 'status', 'pending'],
    ['checkpoint', 'checkpointId', 'other'], ['checkpoint', 'openingReservationDigest', 'f'.repeat(64)],
    ['retention', 'retainedBytesDigest', 'f'.repeat(64)], ['retention', 'complete', false], ['retention', 'storeId', 'other-store'],
    ['retention', 'objectKey', 'other-object'], ['retention', 'objectVersion', ''],
  ]) checkpointDenied(checkpointFixture({}, { [label]: (record) => { record[field] = replacement; } }));
  checkpointDenied(checkpointFixture({ prefix: 2 }, { checkpoint: (record) => { record.status = 'complete'; record.nextStepId = null; } }));
});

test('0093: winning opening, exact terminal consumption and effect-free current CAS lineage cannot diverge', () => {
  for (const [label, field, replacement] of [
    ['opening-reservation', 'winner', false], ['opening-replay', 'status', 'committed'], ['opening-head', 'checkpointDigest', 'f'.repeat(64)],
    ['terminal-head', 'previousHead', 'f'.repeat(64)], ['terminal-head', 'sequence', 6], ['terminal-head', 'retentionDigest', 'f'.repeat(64)],
    ['terminal-reservation', 'status', 'reserved'], ['terminal-reservation', 'winner', false], ['terminal-reservation', 'previousReservationDigest', 'f'.repeat(64)],
    ['current-head', 'head', 'f'.repeat(64)], ['current-head', 'sequence', 6], ['current-head', 'headId', 'other-head'],
    ['current-replay', 'resultDigest', 'f'.repeat(64)], ['current-replay', 'idempotencyKey', 'other-key'], ['current-replay', 'status', 'unused'],
    ['current-reservation', 'status', 'committed'], ['current-reservation', 'winner', true], ['current-reservation', 'previousReservationDigest', 'f'.repeat(64)],
    ['current-reservation', 'reservationId', 'checkpoint-opening-reservation'],
  ]) checkpointDenied(checkpointFixture({}, { [label]: (record) => { record[field] = replacement; } }));
});

test('0093: acknowledgment loss requires terminal commit, independent transport evidence and later readback', () => {
  for (const [label, field, replacement] of [
    ['delivery', 'outcome', 'unknown'], ['delivery', 'source', 'caller-delivery-claim'], ['delivery', 'terminalReservationDigest', 'f'.repeat(64)],
    ['delivery', 'checkpointDigest', 'f'.repeat(64)], ['delivery', 'recordedAt', '2026-09-04T12:02:36.999999999Z'],
    ['current-head', 'recordedAt', '2026-09-04T12:02:37.999999999Z'],
  ]) checkpointDenied(checkpointFixture({}, { [label]: (record) => { record[field] = replacement; } }));
  checkpointDenied(checkpointFixture({}, { envelope: (record) => { record.acknowledgmentLost = true; } }));
});

test('0093: current revalidation never revives expired owner/plan evidence or rounds checkpoint chronology', () => {
  for (const [step, label, field] of [[0, 'plan', 'validThrough'], [3, 'human', 'expiresAt']]) {
    const value = checkpointFixture({ chainOptions: { stepEdits: { [step]: { [label]: (record) => { record[field] = at(165); } } } } });
    assert.equal(value.source.verifier.verify(value.source.bytes, value.source.evaluationTime).state, 'verified-migration-chain'); checkpointDenied(value);
  }
  for (const [label, field, replacement] of [
    ['checkpoint', 'recordedAt', at(152)], ['retention', 'recordedAt', '2026-09-04T12:02:32.999999999Z'],
    ['terminal-head', 'recordedAt', '2026-09-04T12:02:33.999999999Z'], ['current-reservation', 'validThrough', at(170)],
    ['checkpoint', 'validThrough', at(454)],
  ]) checkpointDenied(checkpointFixture({}, { [label]: (record) => { record[field] = replacement; } }));
  const value = checkpointFixture(); checkpointDenied(value, at(180));
  for (const now of [undefined, null, '', '2026-09-04T12:02:50.000Z', at(149)]) assert.equal(value.verifier.verify(value.bytes, now).state, 'blocked');
});

test('0093: original signed bytes, trusted scope and closed envelopes cannot be substituted during clock refresh', () => {
  for (const mutate of [(context) => { context.objectKey = '../checkpoint'; }, (context) => { context.objectKey = '/checkpoint'; },
    (context) => { context.objectKey = 'a\\checkpoint'; }, (context) => { context.chainContextBytes = '{}'; },
    (context) => { context.extra = true; }, (context) => { context.checkpointId = '*'; }])
    assert.throws(() => checkpointFixture({}, { context: mutate }), /MIGRATION_CHECKPOINT_CONFIGURATION_INVALID/);
  assert.throws(() => createMigrationCheckpointVerifier('x'.repeat(1048577)), /MIGRATION_CHECKPOINT_CONFIGURATION_INVALID/);
  for (const [field, replacement] of [['observedAt', at(149)], ['chainBytes', '{}'], ['configDigest', 'f'.repeat(64)], ['policyDigest', 'f'.repeat(64)], ['version', 'steer-migration-checkpoint/v0']])
    checkpointDenied(checkpointFixture({}, { envelope: (record) => { record[field] = replacement; } }));
  checkpointDenied(checkpointFixture({}, { envelope: (record) => {
    const chain = JSON.parse(record.chainBytes), last = chain.attempts.at(-1), compatibility = JSON.parse(last.compatibilityBytes), graph = JSON.parse(compatibility.graphBytes), bundle = JSON.parse(graph.cleanupBundleBytes);
    const authority = JSON.parse(bundle.authorityBytes); authority.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle.authorityBytes = jcs(authority);
    graph.cleanupBundleBytes = jcs(bundle); compatibility.graphBytes = jcs(graph); last.compatibilityBytes = jcs(compatibility); record.chainBytes = jcs(chain);
  } }));
});

test('0092: staged schema profiles compose complete ordered expand, same-schema batches and safe contract', () => {
  for (const successorTuple of [false, true]) for (const replay of [false, true]) {
    const value = chainFixture({ successorTuple, replay });
    for (const item of value.values) assert.equal(item.compatibilityVerifier.verify(item.compatibilityBytes, item.evaluationTime).state, 'verified-migration-model-compatibility');
    const result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'verified-migration-chain'); assert.equal(result.completedStepCount, 4); assert.equal(result.requiredStepCount, 4); assert.equal(result.attemptCount, 4);
    assert.equal(result.currentTruthDigest, value.context.finalTruthDigest); assert.equal(result.executionAuthorized, false); assert.equal(result.liveCompatibilityVerified, false);
    assert.equal(result.factOnly, true); assert.deepEqual(result.effects, zeroEffects()); assert.equal(result.journalEffects, 0);
  }
});

test('0092: complete prefixes and interrupted/restored batches remain pending until a separately verified retry succeeds', () => {
  const prefix = chainFixture({}, { envelope: (envelope) => { envelope.attempts = envelope.attempts.slice(0, 2); } });
  let result = prefix.verifier.verify(prefix.bytes, prefix.evaluationTime);
  assert.equal(result.state, 'verified-migration-chain-pending'); assert.equal(result.completedStepCount, 2); assert.equal(result.requiredStepCount, 4);
  for (const failure of ['interruptionStep', 'rollbackStep']) {
    const failed = chainFixture({ [failure]: 1, timeOffsets: [0, 30, 90, 120], stepEdits: { 1: {
      operation: (record) => { record.requestId = 'failed-request'; record.idempotencyKey = 'failed-idem'; record.casHead = sha256('failed-head'); },
      'action-upstream': (record) => { record.credentialId = 'failed-up'; }, 'action-downstream': (record) => { record.credentialId = 'failed-down'; },
      'action-head': (record) => { record.headId = 'failed-head'; }, 'action-replay': (record) => { record.headId = 'failed-head'; },
      'action-reservation': (record) => { record.reservationId = 'failed-reservation'; }, after: (record) => { record.transactionId = 'failed-transaction'; },
    } } });
    const complete = chainFixture({ timeOffsets: [0, 60, 90, 120] });
    assert.equal(failed.values[1].contextBytes, complete.values[1].contextBytes);
    const attempts = [complete.envelope.attempts[0], failed.envelope.attempts[1], ...complete.envelope.attempts.slice(1)];
    result = complete.verifier.verify(jcs({ ...complete.envelope, attempts: attempts.slice(0, 2) }), complete.evaluationTime);
    assert.equal(result.state, 'verified-migration-chain-pending'); assert.equal(result.completedStepCount, 1);
    result = complete.verifier.verify(jcs({ ...complete.envelope, attempts }), complete.evaluationTime);
    assert.equal(result.state, 'verified-migration-chain'); assert.equal(result.completedStepCount, 4); assert.equal(result.attemptCount, 5); assert.equal(result.executionAuthorized, false);
  }
});

test('0092: exact committed replay cannot repeat a first effect, change immutable evidence or alter chain progress', () => {
  const replay = chainFixture({ replay: true }, { envelope: (envelope) => { envelope.attempts.push(envelope.attempts.at(-1)); } });
  const result = replay.verifier.verify(replay.bytes, replay.evaluationTime);
  assert.equal(result.state, 'verified-migration-chain'); assert.equal(result.completedStepCount, 4); assert.equal(result.replayCount, 1); assert.equal(result.attemptCount, 5);
  chainDenied(chainFixture({}, { envelope: (envelope) => { envelope.attempts.push(envelope.attempts.at(-1)); } }));
  chainDenied(chainFixture({ replay: true }, { envelope: (envelope) => {
    const attempt = structuredClone(envelope.attempts.at(-1)), compatibility = JSON.parse(attempt.compatibilityBytes), graph = JSON.parse(compatibility.graphBytes);
    graph.afterTruthBytes += ' '; compatibility.graphBytes = jcs(graph); attempt.compatibilityBytes = jcs(compatibility); envelope.attempts.push(attempt);
  } }));
  const source = chainFixture({ replay: true }), aliased = chainFixture({ replay: true, stepEdits: { 3: { 'action-reservation': (record) => { record.reservationId = 'reservation-step-1'; } } } });
  assert.equal(aliased.values[3].compatibilityVerifier.verify(aliased.values[3].compatibilityBytes, aliased.evaluationTime).state, 'verified-migration-model-compatibility');
  chainDenied({ ...source, bytes: jcs({ ...source.envelope, attempts: [...source.envelope.attempts, aliased.envelope.attempts[3]] }) });
});

test('0092: exact predecessor bytes and availability order cannot be replaced by independently passing step labels', () => {
  const transplant = chainFixture({ stepEdits: { 1: { 'before-data': (data) => { data.rows[0].values.old = 'transplanted'; } } } });
  for (const item of transplant.values) assert.equal(item.compatibilityVerifier.verify(item.compatibilityBytes, item.evaluationTime).state, 'verified-migration-model-compatibility');
  chainDenied(transplant);
  const premature = chainFixture({ timeOffsets: [0, 10, 60, 90] });
  for (const item of premature.values) assert.equal(item.compatibilityVerifier.verify(item.compatibilityBytes, item.evaluationTime).state, 'verified-migration-model-compatibility');
  chainDenied(premature);
  for (const mutate of [(envelope) => envelope.attempts.splice(1, 1), (envelope) => envelope.attempts.reverse(),
    (envelope) => { envelope.attempts[1].stepId = envelope.attempts[0].stepId; }]) chainDenied(chainFixture({}, { envelope: mutate }));
});

test('0092: full backfill partition and first-use action identities are mandatory across all approved steps', () => {
  const repeated = chainFixture({ stepEdits: { 2: { definition: (record) => { record.batchRowIds = ['row-1']; } } } }, { envelope: (envelope) => { envelope.attempts.pop(); } });
  for (const item of repeated.values.slice(0, 3)) assert.equal(item.compatibilityVerifier.verify(item.compatibilityBytes, item.evaluationTime).state, 'verified-migration-model-compatibility');
  chainDenied(repeated);
  const omittedNullRow = chainFixture({ stepEdits: { 0: { 'before-data': (data) => { data.rows[1].values.old = null; } } } }, {
    context: (context) => { context.steps.splice(2, 1); }, envelope: (envelope) => { envelope.attempts.splice(2, 1); },
  });
  for (const item of omittedNullRow.values) assert.equal(item.compatibilityVerifier.verify(item.compatibilityBytes, item.evaluationTime).state, 'verified-migration-model-compatibility');
  assert.equal(omittedNullRow.values[1].graph.afterTruthBytes, omittedNullRow.values[3].graph.beforeTruthBytes);
  chainDenied(omittedNullRow);
  for (const [key, field, reused] of [['operation', 'requestId', 'request-step-1'], ['operation', 'idempotencyKey', 'idem-step-1'],
    ['action-upstream', 'credentialId', 'up-step-1'], ['action-downstream', 'credentialId', 'down-step-1'],
    ['action-reservation', 'reservationId', 'reservation-step-1'], ['after', 'transactionId', 'transaction-step-1']])
    chainDenied(chainFixture({ stepEdits: { 1: { [key]: (record) => { record[field] = reused; } } } }));
});

test('0092: approved chain pins, scope, coordinates, full proof records and explicit observation cannot be omitted', () => {
  for (const field of ['initialTruthDigest', 'finalTruthDigest']) chainDenied(chainFixture({}, { context: (context) => { context[field] = 'f'.repeat(64); } }));
  for (const mutate of [(context) => { context.steps[1].stepId = context.steps[0].stepId; }, (context) => { context.steps[1].phase = 'expand'; },
    (context) => { context.steps[1].batch = context.steps[0].batch; context.steps[1].checkpoint = context.steps[0].checkpoint; },
    (context) => { context.extra = true; }, (context) => { context.steps = context.steps.slice(0, 2); },
    (context) => { const compatibility = JSON.parse(context.steps[1].compatibilityContextBytes), config = JSON.parse(compatibility.migrationConfigBytes);
      config.database = 'other-db'; compatibility.migrationConfigBytes = jcs(config); context.steps[1].compatibilityContextBytes = jcs(compatibility); }])
    assert.throws(() => chainFixture({}, { context: mutate }), /MIGRATION_CHAIN_CONFIGURATION_INVALID/);
  for (const field of ['planBytes', 'actionBundleBytes', 'afterProofBytes', 'journalBytes', 'resultBytes'])
    chainDenied(chainFixture({ stepEdits: { 2: { graph: (graph) => { graph[field] = '{}'; } } } }));
  const value = chainFixture(); assert.equal(value.verifier.verify(value.bytes).state, 'blocked'); assert.equal(value.verifier.verify(value.bytes, at(180)).state, 'blocked');
  chainDenied(chainFixture({ replay: true }, { envelope: (envelope) => { while (envelope.attempts.length < 65) envelope.attempts.push(envelope.attempts.at(-1)); } }));
  chainDenied(chainFixture({}, { envelope: (envelope) => { envelope.attempts = []; } }));
  assert.throws(() => chainFixture({}, { context: (context) => { context.steps = Array.from({ length: 17 }, () => context.steps[0]); } }), /MIGRATION_CHAIN_CONFIGURATION_INVALID/);
});

test('0092: staged schema semantics cannot downgrade old profiles or change schema during a backfill batch', () => {
  const batch = compatibilityFixture({ staged: true, phase: 'backfill' });
  assert.equal(batch.compatibilityVerifier.verify(batch.compatibilityBytes, batch.evaluationTime).state, 'verified-migration-model-compatibility');
  assert.throws(() => createMigrationTimeVerifier(batch.configBytes), /MIGRATION_CONFIGURATION_INVALID/);
  assert.throws(() => createMigrationCompatibilityVerifier(batch.contextBytes), /MIGRATION_COMPATIBILITY_CONFIGURATION_INVALID/);
  const wrong = compatibilityFixture({ staged: true, phase: 'backfill', edits: { definition: (record) => { record.schemaTo = 'schema-v3'; } } }); compatibilityDenied(wrong);
  const original = compatibilityFixture({ phase: 'backfill' });
  assert.throws(() => createStagedMigrationGraphVerifier(original.configBytes), /MIGRATION_CONFIGURATION_INVALID/);
  assert.throws(() => createStagedMigrationCompatibilityVerifier(original.contextBytes), /MIGRATION_COMPATIBILITY_CONFIGURATION_INVALID/);
});

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
