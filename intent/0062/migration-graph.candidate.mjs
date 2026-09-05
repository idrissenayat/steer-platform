// Offline bounded migration evidence model; never executes SQL or writes a journal.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, strictTime, zeroEffects, TARGET_REVISION, TARGET_EXAM_SHA,
  AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_BYTES, AUTHORIZATION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { correctedHumanAuthorityDecision, correctionPolicyDigest as humanPolicy } from '../0058/human-authority.candidate.mjs';
import { createProtectedActionVerifier, manifestDigest } from '../0060/protected-actions.candidate.mjs';
const read = (name) => readFileSync(new URL(`../0001/reviews/domain/round-3/remediation/${name}`, import.meta.url), 'utf8').trimEnd();
const registryBytes = jcs(JSON.parse(read('TRUST-REGISTRY.candidate.json'))), registry = parseCanonical(registryBytes);
const providerBytes = read('PROVIDER-KEY-REGISTRY.candidate.json'), providers = JSON.parse(providerBytes).bindings;
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-migration-graph/v1', manifestDigest, humanPolicy, registryDigest: timed.registryDigest, timePolicyDigest: timed.timePolicyDigest,
  providerDigest: sha256(providerBytes), model: 'bounded add/copy/drop-column; exact six-source preservation; supplied backup/restore bytes; shared authorization; zero effects' }));
const ensure = (value) => { if (!value) throw new Error('MIGRATION_GRAPH_INVALID'); };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f*?]/u.test(value);
const time = (value) => { const result = strictTime(value); ensure(result !== null); return result; };
const same = (a, b) => jcs(a) === jcs(b);
const names = (list, maximum) => Array.isArray(list) && list.length > 0 && list.length <= maximum && list.every(text) && new Set(list).size === list.length;
const sourceFields = ['itemBytesBase64', 'signatureBytesBase64', 'attemptBytesBase64', 'auditBytesBase64', 'releaseBytesBase64', 'evidenceBytesBase64'];
const column = (value) => text(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
function truth(bytes) {
  ensure(typeof bytes === 'string' && bytes.length <= 1048576); const value = parseCanonical(bytes);
  ensure(exactKeys(value, [...sourceFields, 'dataBytes']) && Object.values(value).every((part) => typeof part === 'string' && part.length > 0 && part.length <= 65536));
  for (const key of sourceFields) ensure(Buffer.from(value[key], 'base64').toString('base64') === value[key]);
  const data = parseCanonical(value.dataBytes);
  ensure(exactKeys(data, ['schemaVersion', 'columns', 'rows']) && text(data.schemaVersion) && names(data.columns, 32) && data.columns.every(column) && same(data.columns, [...data.columns].sort()) &&
    Array.isArray(data.rows) && data.rows.length > 0 && data.rows.length <= 128);
  const ids = new Set();
  for (const row of data.rows) {
    ensure(exactKeys(row, ['rowId', 'values']) && text(row.rowId) && !ids.has(row.rowId) && exactKeys(row.values, data.columns)); ids.add(row.rowId);
    ensure(Object.values(row.values).every((cell) => cell === null || (typeof cell === 'string' && cell.length <= 4096)));
  }
  ensure(same(data.rows.map((row) => row.rowId), [...ids].sort())); return { value, data };
}
// Pure model derivation, not a database runner. Unsupported transformations deny.
export function expectedMigrationData(beforeBytes, definition) {
  const { data } = truth(beforeBytes), expected = structuredClone(data);
  ensure(data.schemaVersion === definition.schemaFrom && names(definition.batchRowIds, 128) &&
    definition.batchRowIds.every((id) => data.rows.some((row) => row.rowId === id)) && names(definition.columns, 32) &&
    Array.isArray(definition.dataOperations) && definition.dataOperations.length > 0 && definition.dataOperations.length <= 32);
  const changed = [];
  for (const operation of definition.dataOperations) {
    if (definition.phase === 'expand') {
      ensure(exactKeys(operation, ['kind', 'column', 'defaultValue']) && operation.kind === 'add-column' && column(operation.column) &&
        !expected.columns.includes(operation.column) && (operation.defaultValue === null || (typeof operation.defaultValue === 'string' && operation.defaultValue.length <= 4096)));
      expected.columns.push(operation.column); for (const row of expected.rows) row.values[operation.column] = operation.defaultValue; changed.push(operation.column);
    } else if (definition.phase === 'backfill') {
      ensure(exactKeys(operation, ['kind', 'sourceColumn', 'targetColumn']) && operation.kind === 'copy-column' && operation.sourceColumn !== operation.targetColumn &&
        expected.columns.includes(operation.sourceColumn) && expected.columns.includes(operation.targetColumn));
      for (const row of expected.rows) if (definition.batchRowIds.includes(row.rowId)) row.values[operation.targetColumn] = row.values[operation.sourceColumn]; changed.push(operation.targetColumn);
    } else {
      ensure(definition.phase === 'contract' && exactKeys(operation, ['kind', 'column']) && operation.kind === 'drop-column' && expected.columns.includes(operation.column));
      expected.columns = expected.columns.filter((column) => column !== operation.column); for (const row of expected.rows) delete row.values[operation.column]; changed.push(operation.column);
    }
  }
  ensure(new Set(changed).size === changed.length && same([...changed].sort(), [...definition.columns].sort()) && expected.columns.length > 0 && expected.columns.length <= 32);
  if (definition.phase !== 'backfill') ensure(same([...definition.batchRowIds].sort(), data.rows.map((row) => row.rowId)));
  expected.columns.sort(); expected.schemaVersion = definition.schemaTo; return jcs(expected);
}

export function createMigrationGraphVerifier(configBytes) {
  let config, binding;
  try {
    ensure(typeof configBytes === 'string' && configBytes.length <= 16384); config = parseCanonical(configBytes);
    ensure(exactKeys(config, ['version', 'implementationRevision', 'repositoryId', 'installationId', 'database', 'schema', 'actorSubject', 'upstreamSubject',
      'providerBindingId', 'approvedDefinitionDigest', 'approvedBeforeTruthDigest']) && config.version === 'steer-migration-context/v1' && hex(config.implementationRevision, 40) &&
      hex(config.approvedDefinitionDigest, 64) && hex(config.approvedBeforeTruthDigest, 64) &&
      ['repositoryId', 'installationId', 'database', 'schema', 'actorSubject', 'upstreamSubject', 'providerBindingId'].every((key) => text(config[key])));
    binding = providers.find((value) => value.providerBindingId === config.providerBindingId); ensure(binding && binding.tenant === 'steer-platform');
    const anchor = registry.bindings.find((value) => value.domain === binding.domain && value.keyId === binding.keyId);
    ensure(anchor && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt'].every((key) => anchor[key] === binding[key]));
  } catch { throw new Error('MIGRATION_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes);
  const scope = { organization: 'steer-platform', tenant: 'steer-platform', repositoryId: config.repositoryId, installationId: config.installationId, item: '0001-flight-deck-foundation' };
  const target = { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: config.implementationRevision,
    authorizationPolicyPath: AUTHORIZATION_POLICY_PATH, authorizationPolicyRevision: TARGET_REVISION, authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA, authorizationPolicyBytes: AUTHORIZATION_POLICY_BYTES };
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      try {
        const now = time(evaluationTime); ensure(typeof serialized === 'string' && serialized.length <= 8388608); const graph = parseCanonical(serialized);
        ensure(exactKeys(graph, ['version', 'configDigest', 'policyDigest', 'mode', 'planBytes', 'beforeTruthBytes', 'beforeProofBytes', 'backupTruthBytes', 'backupProofBytes',
          'rehearsalTruthBytes', 'rehearsalProofBytes', 'cleanupBundleBytes', 'actionBundleBytes', 'afterTruthBytes', 'afterProofBytes', 'rollbackTruthBytes', 'rollbackProofBytes', 'journalBytes', 'resultBytes']) &&
          graph.version === 'steer-migration-graph/v1' && graph.configDigest === configDigest && graph.policyDigest === policyDigest);
        ensure(exactKeys(graph.mode, ['interruption', 'rollback']) && ['none', 'before-effect', 'after-effect'].includes(graph.mode.interruption) &&
          ['none', 'before-backfill', 'during-backfill', 'after-backfill'].includes(graph.mode.rollback));
        const proof = (bytes, domain, kind, fields) => {
          ensure(typeof bytes === 'string' && bytes.length > 0 && bytes.length <= 65536); const raw = parseCanonical(bytes);
          const record = timed.verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
          ensure(exactKeys(record, ['kind', 'configDigest', 'recordedAt', ...fields, 'recordDigest', 'signature']) && record.kind === kind && record.configDigest === configDigest && now - time(record.recordedAt) <= 300000);
          return record;
        };
        const plan = proof(graph.planBytes, 'authority', 'plan', ['definition', 'validThrough']);
        ensure(now < time(plan.validThrough) && sha256(jcs(plan.definition)) === config.approvedDefinitionDigest);
        const definition = plan.definition;
        ensure(exactKeys(definition, ['planId', 'executionId', 'phase', 'batch', 'checkpoint', 'schemaFrom', 'schemaTo', 'oldAppVersion', 'newAppVersion', 'columns', 'dataOperations',
          'affectedTenants', 'batchRowIds', 'supportedReaders', 'supportedWriters', 'allowedRollbacks']) &&
          ['planId', 'executionId', 'batch', 'checkpoint', 'schemaFrom', 'schemaTo', 'oldAppVersion', 'newAppVersion'].every((key) => text(definition[key])) &&
          ['expand', 'backfill', 'contract'].includes(definition.phase) && definition.schemaFrom !== definition.schemaTo && definition.oldAppVersion !== definition.newAppVersion &&
          same(definition.affectedTenants, [scope.tenant]) && same(definition.supportedReaders, [definition.oldAppVersion, definition.newAppVersion]) &&
          same(definition.supportedWriters, [definition.oldAppVersion, definition.newAppVersion]) && names(definition.allowedRollbacks, 4) &&
          definition.allowedRollbacks.every((value) => ['none', 'before-backfill', 'during-backfill', 'after-backfill'].includes(value)) && definition.allowedRollbacks.includes(graph.mode.rollback));
        const before = truth(graph.beforeTruthBytes), after = truth(graph.afterTruthBytes);
        ensure(sha256(graph.beforeTruthBytes) === config.approvedBeforeTruthDigest);
        const expectedData = expectedMigrationData(graph.beforeTruthBytes, definition);
        const beforeProof = proof(graph.beforeProofBytes, binding.domain, 'before', ['planDigest', 'truthDigest']);
        ensure(beforeProof.planDigest === plan.recordDigest && beforeProof.truthDigest === sha256(graph.beforeTruthBytes) && time(beforeProof.recordedAt) >= time(plan.recordedAt));
        const backup = proof(graph.backupProofBytes, binding.domain, 'backup', ['planDigest', 'beforeProofDigest', 'truthDigest', 'backupId']);
        ensure(graph.backupTruthBytes === graph.beforeTruthBytes && backup.planDigest === plan.recordDigest && backup.beforeProofDigest === beforeProof.recordDigest &&
          backup.truthDigest === sha256(graph.backupTruthBytes) && text(backup.backupId) && time(backup.recordedAt) >= time(beforeProof.recordedAt));
        const rehearsal = proof(graph.rehearsalProofBytes, 'verifier', 'rehearsal', ['planDigest', 'backupDigest', 'restoredTruthDigest', 'status']);
        ensure(graph.rehearsalTruthBytes === graph.backupTruthBytes && rehearsal.planDigest === plan.recordDigest && rehearsal.backupDigest === backup.recordDigest &&
          rehearsal.restoredTruthDigest === sha256(graph.rehearsalTruthBytes) && rehearsal.status === 'identical' && time(rehearsal.recordedAt) > time(backup.recordedAt));
        const inputDigest = sha256(jcs({ configDigest, policyDigest, mode: graph.mode, planBytes: graph.planBytes, beforeTruthBytes: graph.beforeTruthBytes,
          beforeProofBytes: graph.beforeProofBytes, backupTruthBytes: graph.backupTruthBytes, backupProofBytes: graph.backupProofBytes,
          rehearsalTruthBytes: graph.rehearsalTruthBytes, rehearsalProofBytes: graph.rehearsalProofBytes }));
        let authorityDigest = plan.recordDigest, approvedAt = time(rehearsal.recordedAt);
        if (definition.phase === 'contract') {
          ensure(typeof graph.cleanupBundleBytes === 'string' && graph.cleanupBundleBytes.length <= 1048576); const bundle = parseCanonical(graph.cleanupBundleBytes);
          ensure(bundle.evaluationTime === evaluationTime && correctedHumanAuthorityDecision(jcs({ version: 'steer-r5-002-human/v1', policyDigest: humanPolicy, bundleBytes: graph.cleanupBundleBytes })).decision === 'ALLOW');
          const authority = parseCanonical(bundle.authorityBytes), inventory = parseCanonical(bundle.inventoryBytes);
          ensure(authority.authorityType === 'disposition-authorization' && authority.eraseMethod === 'provider-delete' && authority.terminalEventId === definition.planId &&
            same(authority.safeguards, ['network-denied', 'encrypted', 'complete-inventory', 'provider-receipt']) &&
            same(authority.allowedCopyProviders, [binding.provider]) && same(authority.conditions, [`migration-execution:${definition.executionId}`, `plan:${plan.recordDigest}`,
              `backup:${backup.recordDigest}`, `columns:${sha256(jcs(definition.columns))}`, `operations:${sha256(jcs(definition.dataOperations))}`, `tenants:${sha256(jcs(definition.affectedTenants))}`, `input:${inputDigest}`]) &&
            inventory.executionId === definition.executionId && inventory.planDigest === plan.recordDigest && inventory.backupDigest === backup.recordDigest &&
            same(inventory.items, [{ copyId: definition.executionId, provider: binding.provider, objectDigest: sha256(jcs({ database: config.database, schema: config.schema, columns: definition.columns, dataOperations: definition.dataOperations, affectedTenants: definition.affectedTenants })) }]) &&
            time(authority.decidedAt) >= approvedAt);
          authorityDigest = authority.recordDigest; approvedAt = time(authority.decidedAt);
        } else ensure(graph.cleanupBundleBytes === '');
        const action = `migration.${definition.phase}`, resources = { database: config.database, schema: config.schema,
          ...Object.fromEntries(['schemaFrom', 'schemaTo', 'oldAppVersion', 'newAppVersion', 'batch', 'checkpoint', 'executionId'].map((key) => [key, definition[key]])), planDigest: plan.recordDigest };
        const context = { version: 'steer-protected-action-context/v1', manifestDigest, trustRegistryBytes: registryBytes, target, scope, grants: [{ grantId: definition.executionId,
          action, actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject, provider: binding.provider, resourceDomain: binding.domain, resources, authorityEvidenceDigest: authorityDigest, inputDigest }] };
        const authorization = createProtectedActionVerifier(jcs(context)).verify(graph.actionBundleBytes, evaluationTime);
        ensure(['AUTHORIZED_CANDIDATE', 'REPLAY_NOOP'].includes(authorization.decision));
        const actionBundle = parseCanonical(graph.actionBundleBytes), request = parseCanonical(actionBundle.requestBytes), requestedAt = time(request.operation.requestedAt);
        ensure(requestedAt >= approvedAt);
        const noEffect = graph.mode.interruption === 'before-effect', restored = graph.mode.rollback !== 'none';
        ensure(!noEffect || !restored);
        const expectedTruth = { ...before.value, dataBytes: noEffect || restored ? before.value.dataBytes : expectedData };
        ensure(same(after.value, expectedTruth)); // Includes byte-for-byte preservation of all six governance sources.
        let restoredAt = requestedAt;
        if (restored) {
          const rollback = proof(graph.rollbackProofBytes, 'recovery-provider', 'rollback', ['requestDigest', 'backupDigest', 'truthDigest', 'status']);
          ensure(graph.rollbackTruthBytes === graph.backupTruthBytes && rollback.requestDigest === authorization.requestDigest && rollback.backupDigest === backup.recordDigest &&
            rollback.truthDigest === sha256(graph.rollbackTruthBytes) && rollback.status === 'identical' && time(rollback.recordedAt) > requestedAt);
          restoredAt = time(rollback.recordedAt);
          if (authorization.decision !== 'REPLAY_NOOP') ensure(restoredAt > time(parseCanonical(actionBundle.reservationBytes).recordedAt));
        } else ensure(graph.rollbackTruthBytes === '' && graph.rollbackProofBytes === '');
        const post = proof(graph.afterProofBytes, binding.domain, 'after', ['planDigest', 'requestDigest', 'truthDigest', 'effectCount', 'status', 'transactionId']);
        const status = noEffect ? 'refused' : restored ? 'rolled-back' : 'committed', count = noEffect ? 0 : 1;
        ensure(post.planDigest === plan.recordDigest && post.requestDigest === authorization.requestDigest && post.truthDigest === sha256(graph.afterTruthBytes) &&
          post.effectCount === count && post.status === status && text(post.transactionId) && time(post.recordedAt) > restoredAt);
        if (authorization.decision !== 'REPLAY_NOOP') ensure(time(post.recordedAt) > time(parseCanonical(actionBundle.reservationBytes).recordedAt));
        const journal = proof(graph.journalBytes, 'provider', 'journal', ['source', 'planDigest', 'requestDigest', 'beforeProofDigest', 'afterProofDigest', 'phase', 'batch', 'checkpoint', 'effectCount', 'attempt', 'status']);
        ensure(journal.source === 'authoritative-migration-journal' && journal.planDigest === plan.recordDigest && journal.requestDigest === authorization.requestDigest &&
          journal.beforeProofDigest === beforeProof.recordDigest && journal.afterProofDigest === post.recordDigest && journal.phase === definition.phase && journal.batch === definition.batch &&
          journal.checkpoint === definition.checkpoint && journal.effectCount === count && journal.status === status && Number.isSafeInteger(journal.attempt) && journal.attempt > 0 && time(journal.recordedAt) > time(post.recordedAt));
        const result = proof(graph.resultBytes, binding.domain, 'result', ['requestDigest', 'journalDigest', 'afterProofDigest', 'effectCount', 'status']);
        ensure(result.requestDigest === authorization.requestDigest && result.journalDigest === journal.recordDigest && result.afterProofDigest === post.recordDigest &&
          result.effectCount === count && result.status === status && time(result.recordedAt) > time(journal.recordedAt));
        if (authorization.decision === 'REPLAY_NOOP') ensure(authorization.resultDigest === result.recordDigest && time(result.recordedAt) <= time(parseCanonical(actionBundle.replayBytes).recordedAt));
        return { state: authorization.decision === 'REPLAY_NOOP' ? 'replay-noop' : noEffect ? 'validated-safe-non-result' : 'validated-migration-candidate',
          firstError: null, effects: zeroEffects(), journalEffects: 0, observedEffectCount: count, configDigest, policyDigest, action,
          evidenceDigest: sha256(jcs([beforeProof.recordDigest, post.recordDigest, journal.recordDigest, result.recordDigest])) };
      } catch { return { state: 'blocked', firstError: 'MIGRATION_GRAPH_INVALID', effects: zeroEffects(), journalEffects: 0 }; }
    },
  });
}
