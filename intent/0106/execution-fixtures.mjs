// Closed synthetic graph fixtures adapted from tests/r5-migration-graph.test.mjs.
// The fixture constructor and all signing/mutation machinery remain module-private.
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createMigrationGraphVerifier, createStagedMigrationGraphVerifier, stagedPolicyDigest as stagedMigrationPolicyDigest, policyDigest } from '../0062/migration-graph.candidate.mjs';
import { createMigrationTimeVerifier, policyDigest as exactPolicyDigest } from '../0090/migration-time.candidate.mjs';
import { exactInstant, formatExactInstant } from '../0069/exact-time.candidate.mjs';
import { humanAuthorityBindingDigest } from '../0058/human-authority.candidate.mjs';
import { manifestBytes, manifestDigest } from '../0060/protected-actions.candidate.mjs';
import { makeHumanAuthorityBundle } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, TARGET_REVISION, TARGET_EXAM_SHA, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, AUTHORIZATION_POLICY_BYTES } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
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

const sharedProofs = ['request', 'upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources', 'replay', 'head', 'reservation'];
const targetFields = ['examRevision', 'examDigest', 'implementationRevision', 'authorizationPolicyPath', 'authorizationPolicyRevision', 'authorizationPolicyDigest', 'authorizationPolicyBytes'];
const semanticEdits = {
  'runner-one-use': ['downstream', 'oneUse', false], 'wrong-role': ['assignment', 'actorRole', 'builder'],
  'authority-denied': ['authority', 'decision', 'denied'], 'cas-loser': ['reservation', 'winner', false],
  'stale-head': ['head', 'head', 'f'.repeat(64)], 'replay-request-drift': ['replay', 'requestDigest', 'f'.repeat(64)],
  'wrong-provider': ['resources', 'provider', 'other-provider'],
};
export function migrationGraphVariants(phase) {
  if (!['expand', 'backfill', 'contract'].includes(phase)) throw new Error('UNKNOWN_MIGRATION_GRAPH_PHASE');
  return ['positive', 'replay', 'before-effect', 'after-effect', 'rollback',
    ...sharedProofs.map((key) => 'omit-action:' + key), ...targetFields.map((key) => 'omit-target:' + key), ...Object.keys(semanticEdits),
    'ordinary-replay', 'ordinary-cas', 'wrong-implementation', 'policy-substitution',
    ...sourceFields.map((key) => 'truth:' + key), 'changed-row', 'changed-journal', 'missing-backup', 'expired',
    ...(phase === 'contract' ? ['missing-human', 'wrong-human-scope'] : [])];
}
export function migrationGraphExecutionCase(phase, variant = 'positive') {
  if (!migrationGraphVariants(phase).includes(variant)) throw new Error('UNKNOWN_MIGRATION_GRAPH_VARIANT');
  const options = { staged: true, phase, edits: {} };
  if (variant === 'replay') options.replay = true;
  if (['before-effect', 'after-effect'].includes(variant)) options.interruption = variant;
  if (variant === 'rollback') options.rollback = 'during-backfill';
  if (variant.startsWith('omit-action:')) options.edits['action-bundle'] = (bundle) => { delete bundle[variant.slice(12) + 'Bytes']; };
  if (variant.startsWith('omit-target:')) options.edits.context = (context) => { delete context.target[variant.slice(12)]; };
  if (semanticEdits[variant]) {
    const [kind, field, value] = semanticEdits[variant];
    options.edits['action-' + kind] = (record) => { record[field] = value; };
  }
  if (variant === 'ordinary-replay') options.domains = { 'action-replay': 'record' };
  if (variant === 'ordinary-cas') options.domains = { 'action-head': 'record' };
  if (variant === 'wrong-implementation') options.edits.context = (context) => { context.target.implementationRevision = 'f'.repeat(40); };
  if (variant === 'policy-substitution') options.edits.context = (context) => { context.target.authorizationPolicyBytes = '{}'; context.target.authorizationPolicyDigest = sha256('{}'); };
  if (variant.startsWith('truth:')) options.edits['after-truth'] = (truth) => { truth[variant.slice(6)] = Buffer.from('changed source bytes').toString('base64'); };
  if (variant === 'changed-row') options.edits['after-truth'] = (truth) => { const data = JSON.parse(truth.dataBytes); data.rows[0].values[data.columns[0]] = 'silent-data-drift'; truth.dataBytes = jcs(data); };
  if (variant === 'changed-journal') options.edits.journal = (record) => { record.requestDigest = 'f'.repeat(64); };
  if (variant === 'missing-backup') options.edits.graph = (graph) => { graph.backupTruthBytes = ''; };
  if (variant === 'expired') options.evaluationTime = until;
  if (variant === 'missing-human') options.edits.graph = (graph) => { graph.cleanupBundleBytes = ''; };
  if (variant === 'wrong-human-scope') options.edits.human = (authority) => { authority.conditions = ['unscoped']; };
  const value = fixture(options);
  return { ...value, phase, variant, input: jcs({ configBytes: value.configBytes, bytes: value.bytes, evaluatedAt: value.evaluationTime }) };
}
