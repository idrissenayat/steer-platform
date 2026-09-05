// Offline evidence composition. No lifecycle executor, provider or store writes.
import { readFileSync } from 'node:fs';
import { AUTHORIZATION_POLICY_BYTES, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, RETENTION_POLICY_SHA,
  TARGET_REVISION, TARGET_EXAM_SHA, exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { compilePreciseSchema, schemaPolicyDigest } from '../0070/precision-schemas.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { correctedHumanAuthorityDecision, correctionPolicyDigest as humanPolicy } from '../0058/human-authority.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest as eventPolicy } from '../0059/lifecycle-events.candidate.mjs';
import { createProtectedActionVerifier, manifestDigest } from '../0060/protected-actions.candidate.mjs';
import { exactInstant as strictTime, exactRetentionBoundary, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const read = (name) => readFileSync(new URL(`../0001/reviews/domain/round-3/remediation/${name}`, import.meta.url), 'utf8').trimEnd();
const registryBytes = jcs(JSON.parse(read('TRUST-REGISTRY.candidate.json'))), registry = parseCanonical(registryBytes);
const providerBytes = read('PROVIDER-KEY-REGISTRY.candidate.json'), providers = JSON.parse(providerBytes).bindings;
const tableBytes = read('LIFECYCLE-POLICY-TABLE.candidate.json'), table = JSON.parse(tableBytes);
const timed = createTimedRecordVerifier(registryBytes), rawSchema = compilePreciseSchema('RAW-POLICY-GRANT.schema.json');
export const policyDigest = sha256(jcs({ version: 'steer-lifecycle-graph/v1', tableDigest: sha256(tableBytes),
  providerDigest: sha256(providerBytes), registryDigest: timed.registryDigest, humanPolicy, eventPolicy, manifestDigest, timePolicyDigest, schemaPolicyDigest,
  rules: 'exact closed event/history, authoritative state/inventory, earliest rebuildable trigger, provenance waits for closed derived manifest deletion events not item closure, full human/raw proof, shared copy/tombstone actions, ordered provider receipts; zero execution', maxCopies: 32, maxDerivedRecords: 128 }));
const requireValue = (value) => { if (!value) throw new Error('LIFECYCLE_GRAPH_INVALID'); };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f*?]/u.test(value);
const time = (value) => { const result = strictTime(value); requireValue(result !== null); return result; };
const equal = (a, b) => jcs(a) === jcs(b);
const signed = ['recordDigest', 'signature'];
const copyFields = ['copyId', 'copyKind', 'provider', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId', 'sourceOriginal'];

export function lifecycleBoundary(triggerAt, duration, parentExpiryAt = null) {
  return exactRetentionBoundary(triggerAt, duration, parentExpiryAt);
}

// Trusted reference selection is outside the request; never install this from a
// tool argument. Policy/registry/Exam pins remain the frozen candidate pins.
export function createLifecycleGraphVerifier(configBytes) {
  let config, row;
  try {
    requireValue(typeof configBytes === 'string' && configBytes.length <= 16384); config = parseCanonical(configBytes);
    requireValue(exactKeys(config, ['version', 'implementationRevision', 'repositoryId', 'installationId', 'recordId', 'recordClass', 'artifactRevision',
      'environmentId', 'actorSubject', 'upstreamSubject', 'tombstonePath', 'tombstoneProviderBindingId']) && config.version === 'steer-lifecycle-context/v1' &&
      hex(config.implementationRevision, 40) && hex(config.artifactRevision, 40) &&
      ['repositoryId', 'installationId', 'recordId', 'recordClass', 'actorSubject', 'upstreamSubject', 'tombstonePath'].every((key) => text(config[key])) &&
      (config.environmentId === null || text(config.environmentId)) && !config.tombstonePath.startsWith('/') &&
      !config.tombstonePath.split('/').some((part) => ['', '.', '..'].includes(part)));
    row = table.classes.find((entry) => entry.classId === config.recordClass);
    requireValue(row && providers.some((binding) => binding.providerBindingId === config.tombstoneProviderBindingId) && table.policySha256 === RETENTION_POLICY_SHA);
  } catch { throw new Error('LIFECYCLE_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes);
  const scope = { organization: 'steer-platform', tenant: 'steer-platform', repositoryId: config.repositoryId, installationId: config.installationId, item: '0001-flight-deck-foundation' };
  const actionContext = (grant) => ({ version: 'steer-protected-action-context/v1', manifestDigest, trustRegistryBytes: registryBytes,
    target: { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: config.implementationRevision,
      authorizationPolicyPath: AUTHORIZATION_POLICY_PATH, authorizationPolicyRevision: TARGET_REVISION, authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA, authorizationPolicyBytes: AUTHORIZATION_POLICY_BYTES }, scope, grants: [grant] });
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      const blocked = () => ({ state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID', effects: zeroEffects() });
      try {
        const now = time(evaluationTime);
        requireValue(typeof serialized === 'string' && serialized.length <= 16777216);
        const graph = parseCanonical(serialized);
        const provenance = config.recordClass === 'RC-CORPUS-PROVENANCE';
        requireValue(exactKeys(graph, ['version', 'policyDigest', 'configDigest', 'eventBytes', 'historyBytes', 'inventoryBytes', 'stateBytes', 'referenceRevocationBytes', 'copies', 'aggregateBytes', 'tombstone', ...(provenance ? ['derivedInventoryBytes'] : [])]) &&
          graph.version === 'steer-lifecycle-graph/v1' && graph.policyDigest === policyDigest && graph.configDigest === configDigest);
        const eventsResult = correctedLifecycleEventDecision(jcs({ version: 'steer-r5-001-events/v1', policyDigest: eventPolicy,
          scope: { organization: scope.organization, itemId: scope.item, environmentId: config.environmentId }, eventBytes: graph.eventBytes, historyBytes: graph.historyBytes, evaluationTime }));
        requireValue(eventsResult.state === 'validated-trigger');
        const events = [...graph.historyBytes, graph.eventBytes].map(parseCanonical);
        requireValue(events.every((event) => event.recordId === config.recordId && event.recordClass === config.recordClass &&
          event.artifactRevision === config.artifactRevision && event.policySha256 === RETENTION_POLICY_SHA));
        const readProof = (bytes, domain, fields) => {
          requireValue(typeof bytes === 'string' && bytes.length <= 65536); const raw = parseCanonical(bytes);
          const record = timed.verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
          requireValue(exactKeys(record, [...fields, 'recordedAt', ...signed]) && record.configDigest === configDigest); return record;
        };
        const inventory = readProof(graph.inventoryBytes, 'provider', ['kind', 'configDigest', 'inventoryId', 'source', 'copies', 'complete', 'validThrough']);
        requireValue(inventory.kind === 'inventory' && inventory.source === 'authoritative-copy-inventory' && inventory.complete === true && text(inventory.inventoryId) &&
          now - time(inventory.recordedAt) <= 300000000000n && now < time(inventory.validThrough) && Array.isArray(inventory.copies) && inventory.copies.length > 0 && inventory.copies.length <= 32);
        const copies = inventory.copies, copyIds = new Set(), physical = new Set();
        for (const copy of copies) {
          requireValue(exactKeys(copy, copyFields) && copyFields.filter((key) => key !== 'sourceOriginal').every((key) => text(copy[key])) && copy.sourceOriginal === false);
          requireValue(!copyIds.has(copy.copyId)); copyIds.add(copy.copyId);
          const identity = jcs([copy.providerBindingId, copy.account, copy.objectKey, copy.versionId]); requireValue(!physical.has(identity)); physical.add(identity);
        }
        requireValue(equal(copies.map((copy) => copy.copyId), [...copyIds].sort()));
        const historyDigest = sha256(jcs([...graph.historyBytes, graph.eventBytes])), tupleDigest = sha256(jcs(copies));
        const state = readProof(graph.stateBytes, 'authority', ['kind', 'configDigest', 'source', 'inventoryDigest', 'historyDigest', 'historyComplete', 'holdState', 'referenceState', 'referenceRevocationDigest', 'parentExpiryAt', 'validThrough', ...(provenance ? ['derivedInventoryDigest'] : [])]);
        requireValue(state.kind === 'state' && state.source === 'authoritative-lifecycle-store' && state.inventoryDigest === inventory.recordDigest &&
          state.historyDigest === historyDigest && state.historyComplete === true && time(state.recordedAt) >= time(events.at(-1).occurredAt) &&
          time(state.recordedAt) >= time(inventory.recordedAt) && now - time(state.recordedAt) <= 300000000000n && now < time(state.validThrough));
        requireValue(['none', 'released', 'active'].includes(state.holdState) && ['cleared', 'active'].includes(state.referenceState));
        const holds = new Set();
        for (const event of events) {
          if (event.eventType === 'hold-applied') { requireValue(text(event.holdId) && !holds.has(event.holdId)); holds.add(event.holdId); }
          if (event.eventType === 'hold-released') { requireValue(holds.has(event.holdId)); holds.delete(event.holdId); }
        }
        requireValue(holds.size === 0 || state.holdState === 'active');
        const compound = { 'record-superseded-or-rebuild-requested': ['record-superseded', 'rebuild-requested'],
          'earlier-corpus-superseded-or-retired': ['corpus-version-superseded', 'corpus-retired'] };
        // 0068: the frozen table's item-closed surrogate contradicts the exact
        // signed records policy. Preserve that table for review traceability,
        // but require a current, closed manifest and every verified deletion.
        const types = provenance ? ['corpus-retired', 'derived-record-deleted'] : compound[row.trigger] ?? [row.trigger];
        const triggers = events.filter((event) => types.includes(event.eventType));
        requireValue(triggers.length > 0);
        if (provenance) {
          const retirements = triggers.filter((event) => event.eventType === 'corpus-retired');
          requireValue(retirements.length === 1);
          const retired = retirements[0], deletions = triggers.filter((event) => event.eventType === 'derived-record-deleted');
          const derived = readProof(graph.derivedInventoryBytes, 'provider', ['kind', 'configDigest', 'source', 'manifestId', 'corpusId', 'corpusVersion', 'entries', 'complete', 'validThrough']);
          requireValue(derived.kind === 'derived-inventory' && derived.source === 'authoritative-derived-record-manifest' && text(derived.manifestId) &&
            derived.complete === true && derived.recordDigest === state.derivedInventoryDigest && derived.corpusId === retired.corpusId &&
            derived.corpusVersion === retired.corpusVersion && now - time(derived.recordedAt) <= 300000000000n && now < time(derived.validThrough) &&
            time(derived.recordedAt) >= time(events.at(-1).occurredAt) && time(derived.recordedAt) <= time(state.recordedAt) &&
            Array.isArray(derived.entries) && derived.entries.length <= 128 && deletions.length === derived.entries.length);
          const ids = new Set(), completionIds = new Set();
          for (const entry of derived.entries) {
            requireValue(exactKeys(entry, ['derivedRecordId', 'derivedRecordClass', 'deletionEventId']) &&
              Object.values(entry).every(text) && entry.derivedRecordId !== config.recordId &&
              table.classes.some((item) => item.classId === entry.derivedRecordClass) &&
              !ids.has(entry.derivedRecordId) && !completionIds.has(entry.deletionEventId));
            ids.add(entry.derivedRecordId); completionIds.add(entry.deletionEventId);
            const completion = deletions.find((event) => event.eventId === entry.deletionEventId);
            requireValue(completion && completion.derivedRecordId === entry.derivedRecordId && completion.derivedRecordClass === entry.derivedRecordClass &&
              completion.parentCorpusId === derived.corpusId && completion.parentCorpusVersion === derived.corpusVersion);
          }
          requireValue(equal(derived.entries.map((entry) => entry.derivedRecordId), [...ids].sort()));
        } else {
          requireValue(types.every((type) => triggers.filter((event) => event.eventType === type).length <= 1));
          if (row.trigger.startsWith('later-')) requireValue(types.every((type) => triggers.some((event) => event.eventType === type)));
        }
        // The signed records policy says earliest supersession/rebuild request.
        // Provenance instead selects the later retirement/final derived
        // completion. Events were verified in time order.
        const trigger = row.trigger.startsWith('earlier-') || row.trigger === 'record-superseded-or-rebuild-requested' ? triggers[0] : triggers.at(-1);
        for (const event of triggers) {
          if (event.eventType === 'run-terminal') requireValue(['completed', 'failed', 'cancelled', 'timed-out'].includes(event.terminalStatus));
          if (event.eventType === 'environment-retired') requireValue(event.trafficDisabled === true && event.credentialsRevoked === true);
          if (event.eventType === 'corpus-sanitization-terminal') requireValue(['pass', 'fail', 'cancelled'].includes(event.result));
        }
        requireValue(row.parentCap ? state.parentExpiryAt !== null : state.parentExpiryAt === null);
        const boundaryAt = lifecycleBoundary(trigger.occurredAt, row.duration, state.parentExpiryAt);
        if (boundaryAt === null) return { state: 'retained-immutable', firstError: null, effects: zeroEffects(), boundaryAt };
        if (state.holdState === 'active' || state.referenceState !== 'cleared') return { state: 'retained-on-hold', firstError: null, effects: zeroEffects(), boundaryAt };
        const raw = config.recordClass === 'RC-CORPUS-RAW-WORKING';
        if (!raw && now < time(boundaryAt)) return { state: 'scheduled', firstError: null, effects: zeroEffects(), boundaryAt };
        if (row.disposition.startsWith('reference-')) {
          const reference = readProof(graph.referenceRevocationBytes, 'authority', ['kind', 'configDigest', 'source', 'inventoryDigest', 'historyDigest', 'decision']);
          requireValue(reference.kind === 'reference-revocation' && reference.source === 'reference-revocation-service' && reference.inventoryDigest === inventory.recordDigest &&
            reference.historyDigest === historyDigest && reference.decision === 'authorized' && reference.recordDigest === state.referenceRevocationDigest &&
            time(reference.recordedAt) <= time(state.recordedAt));
        } else requireValue(graph.referenceRevocationBytes === '' && state.referenceRevocationDigest === null);
        requireValue(Array.isArray(graph.copies) && graph.copies.length === copies.length && new Set(graph.copies.map((entry) => entry.copyId)).size === copies.length);
        const baseDigest = sha256(jcs({ configDigest, policyDigest, eventBytes: graph.eventBytes, historyBytes: graph.historyBytes, inventoryBytes: graph.inventoryBytes, stateBytes: graph.stateBytes, referenceRevocationBytes: graph.referenceRevocationBytes,
          ...(provenance ? { derivedInventoryBytes: graph.derivedInventoryBytes } : {}) }));
        const usedAuthorities = new Set(), usedRequests = new Set(), usedIdempotency = new Set(), transactions = new Set();
        const humanProofs = new Set(), humanReservations = new Set(), humanKeys = new Set(), humanHeads = new Set();
        const credentialIds = new Set(), reservationIds = new Set(), actionHeads = new Set();
        const unique = (set, value) => { requireValue(!set.has(value)); set.add(value); };
        const bindingFor = (id) => {
          const binding = providers.find((entry) => entry.providerBindingId === id); requireValue(binding && binding.tenant === scope.tenant);
          const anchor = registry.bindings.find((entry) => entry.domain === binding.domain && entry.keyId === binding.keyId);
          requireValue(anchor && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt'].every((key) => anchor[key] === binding[key])); return binding;
        };
        const human = (bytes, selected, conditions, method, authorityType) => {
          requireValue(typeof bytes === 'string' && bytes.length <= 1048576); const bundle = parseCanonical(bytes);
          requireValue(bundle.evaluationTime === evaluationTime && correctedHumanAuthorityDecision(jcs({ version: 'steer-r5-002-human/v1', policyDigest: humanPolicy, bundleBytes: bytes })).decision === 'ALLOW');
          const authority = parseCanonical(bundle.authorityBytes), humanInventory = parseCanonical(bundle.inventoryBytes);
          requireValue(authority.terminalEventId === trigger.eventId && authority.authorityType === authorityType && authority.eraseMethod === method &&
            equal(authority.conditions, conditions) && equal(authority.safeguards, ['network-denied', 'encrypted', 'complete-inventory', 'provider-receipt']) &&
            equal(authority.allowedCopyProviders, [...new Set(selected.map((copy) => copy.provider))].sort()) &&
            humanInventory.lifecycleInventoryDigest === inventory.recordDigest && humanInventory.tupleDigest === tupleDigest &&
            equal(humanInventory.items, selected.map((copy) => ({ copyId: copy.copyId, provider: copy.provider, objectDigest: sha256(jcs(copy)) }))) &&
            time(authority.decidedAt) >= time(state.recordedAt) && !usedAuthorities.has(authority.authorityId));
          usedAuthorities.add(authority.authorityId);
          unique(humanProofs, authority.providerRecordId); unique(humanKeys, authority.idempotencyKey);
          unique(humanReservations, parseCanonical(bundle.casReservationBytes).reservationId);
          const humanHead = parseCanonical(bundle.casHeadBytes); unique(humanHeads, jcs([humanHead.headId, humanHead.head]));
          return authority;
        };
        const verifyAction = (entry, grant, binding, authority, earliest, latest = now) => {
          const context = actionContext(grant), result = createProtectedActionVerifier(jcs(context)).verify(entry.actionBundleBytes, evaluationTime);
          requireValue(['AUTHORIZED_CANDIDATE', 'REPLAY_NOOP'].includes(result.decision));
          const bundle = parseCanonical(entry.actionBundleBytes), request = parseCanonical(bundle.requestBytes), operation = request.operation;
          for (const key of ['upstreamBytes', 'downstreamBytes']) unique(credentialIds, parseCanonical(bundle[key]).credentialId);
          unique(reservationIds, parseCanonical(bundle.reservationBytes).reservationId);
          const actionHead = parseCanonical(bundle.headBytes); unique(actionHeads, jcs([actionHead.headId, actionHead.head]));
          requireValue(!usedRequests.has(result.requestDigest) && !usedIdempotency.has(operation.idempotencyKey) && time(operation.requestedAt) >= earliest &&
            time(operation.requestedAt) >= time(authority.decidedAt)); usedRequests.add(result.requestDigest); usedIdempotency.add(operation.idempotencyKey);
          const receipt = readProof(entry.receiptBytes, binding.domain, ['kind', 'configDigest', 'contextDigest', 'inputDigest', 'requestDigest', 'resourcesDigest', 'authorityDigest', 'action', 'transactionId', 'effect', 'status']);
          requireValue(receipt.kind === 'receipt' && receipt.contextDigest === result.contextDigest && receipt.inputDigest === grant.inputDigest &&
            receipt.requestDigest === result.requestDigest && receipt.resourcesDigest === result.resourcesDigest && receipt.authorityDigest === authority.recordDigest &&
            receipt.action === grant.action && receipt.effect === (grant.action === 'lifecycle.crypto-erase' ? 'crypto-erased' : grant.action === 'lifecycle.commit-tombstone' ? 'tombstone-committed' : 'deleted') &&
            receipt.status === 'terminal-success' && text(receipt.transactionId) && !transactions.has(receipt.transactionId) &&
            time(receipt.recordedAt) > time(operation.requestedAt) && time(receipt.recordedAt) <= latest);
          if (result.decision === 'REPLAY_NOOP') requireValue(result.resultDigest === receipt.recordDigest && time(receipt.recordedAt) <= time(parseCanonical(bundle.replayBytes).recordedAt));
          else requireValue(time(receipt.recordedAt) > time(parseCanonical(bundle.reservationBytes).recordedAt));
          transactions.add(receipt.transactionId); return { receipt, replay: result.decision === 'REPLAY_NOOP' };
        };
        const receipts = []; let replayCount = 0;
        for (const copy of copies) {
          const entry = graph.copies.find((value) => value.copyId === copy.copyId);
          requireValue(exactKeys(entry, ['copyId', 'humanBundleBytes', 'rawGrantBytes', 'actionBundleBytes', 'receiptBytes']));
          const binding = bindingFor(copy.providerBindingId); requireValue(binding.provider === copy.provider && binding.account === copy.account);
          const crypto = raw || row.disposition.startsWith('crypto-erase'), action = crypto ? 'lifecycle.crypto-erase' : 'lifecycle.delete-copy';
          const conditions = [`lifecycle-inventory:${inventory.recordDigest}`, `tuple:${sha256(jcs(copy))}`, `input:${baseDigest}`];
          const authority = human(entry.humanBundleBytes, [copy], conditions, crypto ? 'cryptographic-erase' : 'provider-delete', raw ? 'raw-policy-grant' : 'disposition-authorization');
          if (raw) {
            const grant = parseCanonical(entry.rawGrantBytes);
            requireValue(rawSchema(grant).length === 0 && equal(grant.authority, authority) && copy.copyKind === 'temporary-working' &&
              grant.sanitizerRevision === trigger.sanitizerRevision && grant.inspectorRevision === trigger.inspectionRevision &&
              time(authority.validFrom) <= time(trigger.occurredAt) && time(authority.expiresAt) >= time(boundaryAt));
          } else requireValue(entry.rawGrantBytes === '');
          const resources = { objectId: config.recordId, recordClass: config.recordClass, ...Object.fromEntries(['copyId', 'copyKind', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId'].map((key) => [key, copy[key]])), inventoryDigest: inventory.recordDigest, tupleDigest };
          const grant = { grantId: copy.copyId, action, actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject, provider: copy.provider, resourceDomain: binding.domain,
            resources, authorityEvidenceDigest: authority.recordDigest, inputDigest: baseDigest };
          const checked = verifyAction(entry, grant, binding, authority, raw ? time(trigger.occurredAt) : time(boundaryAt), raw ? time(boundaryAt) : now);
          receipts.push(checked.receipt); if (checked.replay) replayCount++;
        }
        const aggregate = readProof(graph.aggregateBytes, 'provider', ['kind', 'configDigest', 'inputDigest', 'inventoryDigest', 'receiptDigests', 'allCopiesGone']);
        requireValue(aggregate.kind === 'aggregate' && aggregate.inputDigest === baseDigest && aggregate.inventoryDigest === inventory.recordDigest &&
          equal(aggregate.receiptDigests, receipts.map((receipt) => receipt.recordDigest)) && aggregate.allCopiesGone === true &&
          receipts.every((receipt) => time(aggregate.recordedAt) > time(receipt.recordedAt)));
        const tombstone = graph.tombstone; requireValue(exactKeys(tombstone, ['humanBundleBytes', 'actionBundleBytes', 'receiptBytes']));
        const conditions = [`lifecycle-inventory:${inventory.recordDigest}`, `aggregate:${aggregate.recordDigest}`, `input:${baseDigest}`];
        const authority = human(tombstone.humanBundleBytes, copies, conditions, 'provider-delete', 'disposition-authorization');
        requireValue(time(authority.decidedAt) >= time(aggregate.recordedAt));
        const binding = bindingFor(config.tombstoneProviderBindingId);
        const grant = { grantId: 'tombstone', action: 'lifecycle.commit-tombstone', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
          provider: binding.provider, resourceDomain: binding.domain, resources: { objectId: config.recordId, recordClass: config.recordClass, inventoryDigest: inventory.recordDigest,
            tupleDigest, aggregateReceiptDigest: aggregate.recordDigest, path: config.tombstonePath }, authorityEvidenceDigest: authority.recordDigest, inputDigest: baseDigest };
        const checked = verifyAction(tombstone, grant, binding, authority, time(aggregate.recordedAt)); if (checked.replay) replayCount++;
        return { state: 'validated-lifecycle-candidate', firstError: null, effects: zeroEffects(), configDigest, policyDigest, boundaryAt,
          copyCount: copies.length, protectedActionCount: copies.length + 1, replayCount,
          evidenceDigest: sha256(jcs([...receipts.map((receipt) => receipt.recordDigest), aggregate.recordDigest, checked.receipt.recordDigest])) };
      } catch { return blocked(); }
    },
  });
}
