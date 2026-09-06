// Offline evidence composition. No lifecycle executor, provider or store writes.
import { readFileSync } from 'node:fs';
import { AUTHORIZATION_POLICY_BYTES, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, RETENTION_POLICY_SHA,
  TARGET_REVISION, TARGET_EXAM_SHA, exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { schemaPolicyDigest } from '../0070/precision-schemas.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { correctedHumanAuthorityDecision, correctionPolicyDigest as humanPolicy } from '../0058/human-authority.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest as eventPolicy } from '../0059/lifecycle-events.candidate.mjs';
import { createProtectedActionVerifier, manifestDigest } from '../0060/protected-actions.candidate.mjs';
import { exactInstant as strictTime, exactRetentionBoundary, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
import { createRawPreterminalVerifier, policyDigest as rawPolicyDigest } from '../0073/raw-preterminal.candidate.mjs';
import { verifyRawBatchEvidence, policyDigest as rawBatchPolicyDigest } from '../0074/raw-batch.candidate.mjs';
import { verifyRawCheckpointEvidence } from '../0075/raw-checkpoint.candidate.mjs';
import { verifyRawCheckpointChain, policyDigest as rawChainPolicyDigest } from '../0076/raw-checkpoint-chain.candidate.mjs';
import { createLifecycleRuntime } from '../0080/lifecycle-runtime.candidate.mjs';
import { createReferenceProtectedActionVerifier, manifestDigest as referenceActionManifestDigest } from '../0088/reference-actions.candidate.mjs';
const read = (name) => readFileSync(new URL(`../0001/reviews/domain/round-3/remediation/${name}`, import.meta.url), 'utf8').trimEnd();
const registryBytes = jcs(JSON.parse(read('TRUST-REGISTRY.candidate.json'))), registry = parseCanonical(registryBytes);
const providerBytes = read('PROVIDER-KEY-REGISTRY.candidate.json'), providers = JSON.parse(providerBytes).bindings;
const tableBytes = read('LIFECYCLE-POLICY-TABLE.candidate.json'), table = JSON.parse(tableBytes);
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-lifecycle-graph/v1', tableDigest: sha256(tableBytes),
  providerDigest: sha256(providerBytes), registryDigest: timed.registryDigest, humanPolicy, eventPolicy, manifestDigest, timePolicyDigest, schemaPolicyDigest, rawPolicyDigest, rawBatchPolicyDigest, rawChainPolicyDigest,
  rules: 'exact event/history and authoritative state/inventory; policy retention; raw-v2 grant/batch, raw-v3 single checkpoint, raw-v4 full predecessor chain; full human proof for ordinary copies/tombstone; shared actions and ordered receipts; zero execution', maxCopies: 32, maxDerivedRecords: 128 }));
const requireValue = (value) => { if (!value) throw new Error('LIFECYCLE_GRAPH_INVALID'); };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f*?]/u.test(value);
const time = (value) => { const result = strictTime(value); requireValue(result !== null); return result; };
const equal = (a, b) => jcs(a) === jcs(b);
const signed = ['recordDigest', 'signature'];
const copyFields = ['copyId', 'copyKind', 'provider', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId', 'sourceOriginal'];
const originalDependencies = { registryBytes, registry, providers, timed, humanPolicy, policyDigest };

export function lifecycleBoundary(triggerAt, duration, parentExpiryAt = null) {
  return exactRetentionBoundary(triggerAt, duration, parentExpiryAt);
}

// Trusted reference selection is outside the request; never install this from a
// tool argument. Policy/registry/Exam pins remain the frozen candidate pins.
export function createLifecycleGraphVerifier(configBytes) {
  return createComposedLifecycleVerifier(configBytes, null);
}

export function createCurrentLifecycleGraphVerifier(configBytes, trustedRuntimeBytes) {
  const verifier = createComposedLifecycleVerifier(configBytes, createLifecycleRuntime(trustedRuntimeBytes));
  return Object.freeze({ configDigest: verifier.configDigest, policyDigest: verifier.policyDigest,
    verify(serialized, evaluationTime) { return { ...verifier.verify(serialized, evaluationTime), executionAuthorized: false }; },
  });
}

const readinessOriginalClasses = ['RC-FAILED-RUN', 'RC-POSTHOG-RAW', 'RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT'];
// Separate read-only entry points. Extra arguments to the complete factories
// cannot select this private mode, and readiness envelopes are not full graphs.
export function createLifecycleReadinessVerifier(configBytes) {
  return createComposedLifecycleVerifier(configBytes, null, true);
}
export function createImmediateLifecycleReadinessVerifier(configBytes) {
  return createComposedLifecycleVerifier(configBytes, null, 'immediate');
}
export function createCurrentLifecycleReadinessVerifier(configBytes, trustedRuntimeBytes) {
  const runtime = createLifecycleRuntime(trustedRuntimeBytes);
  if (!runtime.archival) throw new Error('LIFECYCLE_READINESS_CONFIGURATION_INVALID');
  return createComposedLifecycleVerifier(configBytes, runtime, true);
}

function createComposedLifecycleVerifier(configBytes, runtime, readiness = false) {
  const immediate = readiness === 'immediate';
  const registryBytes = runtime?.registryBytes ?? originalDependencies.registryBytes;
  const registry = runtime?.registry ?? originalDependencies.registry;
  const providers = runtime?.providers ?? originalDependencies.providers;
  const timed = runtime ? createTimedRecordVerifier(registryBytes) : originalDependencies.timed;
  const humanPolicy = runtime?.human.policyDigest ?? originalDependencies.humanPolicy;
  const currentVersion = runtime?.reference ? 'steer-lifecycle-graph/current-v5' : runtime?.archival ? 'steer-lifecycle-graph/current-v4' : runtime?.qualified ? 'steer-lifecycle-graph/current-v3' : runtime?.mixed ? 'steer-lifecycle-graph/current-v2' : 'steer-lifecycle-graph/current-v1';
  const policyDigest = runtime ? sha256(jcs({ version: currentVersion, originalPolicyDigest: originalDependencies.policyDigest,
    runtimePolicyDigest: runtime.policyDigest, runtimeConfigDigest: runtime.configDigest })) : originalDependencies.policyDigest;
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
    if (readiness && !runtime) requireValue(immediate ? config.recordClass === 'RC-REBUILDABLE' : readinessOriginalClasses.includes(config.recordClass));
    if (runtime) requireValue(runtime.supportedClasses.includes(config.recordClass) &&
      ['recordId', 'recordClass', 'artifactRevision', 'environmentId'].every((field) =>
        config[field] === (field === 'environmentId' ? runtime.historicalContext.scope.environmentId : runtime.historicalContext[field])));
    if (runtime?.reference) requireValue(runtime.referenceContext.environmentId === config.environmentId &&
      ['recordId', 'artifactRevision', 'repositoryId'].every((field) => runtime.referenceContentContext[field] === config[field]));
  } catch { throw new Error('LIFECYCLE_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes), raw = config.recordClass === 'RC-CORPUS-RAW-WORKING';
  const rawVerifier = raw ? createRawPreterminalVerifier(jcs({ version: 'steer-raw-preparation-context/v1', lifecycleConfigDigest: configDigest,
    recordId: config.recordId, artifactRevision: config.artifactRevision, environmentId: config.environmentId })) : null;
  const scope = { organization: 'steer-platform', tenant: 'steer-platform', repositoryId: config.repositoryId, installationId: config.installationId, item: '0001-flight-deck-foundation' };
  const actionContext = (grant) => ({ version: runtime?.reference ? 'steer-protected-reference-context/v1' : 'steer-protected-action-context/v1',
    manifestDigest: runtime?.reference ? referenceActionManifestDigest : manifestDigest, trustRegistryBytes: registryBytes,
    target: { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: config.implementationRevision,
      authorizationPolicyPath: AUTHORIZATION_POLICY_PATH, authorizationPolicyRevision: TARGET_REVISION, authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA, authorizationPolicyBytes: AUTHORIZATION_POLICY_BYTES }, scope, grants: [grant] });
  const readinessTarget = { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: config.implementationRevision,
    authorizationPolicyPath: AUTHORIZATION_POLICY_PATH, authorizationPolicyRevision: TARGET_REVISION, authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA };
  const readinessVersion = immediate ? 'steer-immediate-readiness/v1' : 'steer-lifecycle-readiness/v1';
  const readinessPolicyDigest = sha256(jcs(immediate ? { version: readinessVersion, dispositionPolicyDigest: policyDigest, target: readinessTarget,
    rules: 'closed rebuildable head-only evidence; verified complete available history and fresh state/inventory; absent trigger means waiting-for-trigger with null expiry; earliest observed supersession/rebuild gives pending disposition; known providers; no future event, quarantine, deletion, clearance or execution authority',
    originalClasses: ['RC-REBUILDABLE'], currentProfile: 'original-only' } : { version: readinessVersion, dispositionPolicyDigest: policyDigest, target: readinessTarget,
    rules: 'closed head-only evidence; same verified event/history/inventory/state/retention prefix; known copy providers; no action, human disposition, reference removal, receipt or tombstone acceptance; no quarantine, deletion or execution authority',
    originalClasses: readinessOriginalClasses, currentProfile: 'archival-v4-or-reference-v5-only' }));
  const publicPolicyDigest = readiness ? readinessPolicyDigest : policyDigest;
  const headFields = ['configDigest', 'eventBytes', 'historyBytes', 'inventoryBytes', 'stateBytes', ...(runtime ? ['historicalEvidenceBytes'] : []),
    ...(runtime?.qualified ? ['qualifiedDecisionBytes'] : []), ...(runtime?.archival ? ['archivedOwnerBytes'] : [])];
  return Object.freeze({ configDigest, policyDigest: publicPolicyDigest,
    verify(serialized, evaluationTime) {
      const readinessLimits = { effects: zeroEffects(), executionAuthorized: false, dispositionEvidenceVerified: false, quarantineVerified: false, deletionVerified: false, referenceClearanceVerified: false };
      const blocked = () => readiness ? { state: 'blocked', firstError: 'LIFECYCLE_READINESS_INVALID', ...readinessLimits } : { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID', effects: zeroEffects() };
      try {
        const now = time(evaluationTime);
        requireValue(typeof serialized === 'string' && serialized.length <= 16777216);
        const envelope = parseCanonical(serialized);
        if (readiness) requireValue(exactKeys(envelope, ['version', 'policyDigest', 'dispositionPolicyDigest', 'target', ...headFields]) &&
          envelope.version === readinessVersion && envelope.policyDigest === readinessPolicyDigest && envelope.dispositionPolicyDigest === policyDigest && equal(envelope.target, readinessTarget));
        const graph = readiness ? { ...Object.fromEntries(headFields.map((field) => [field, envelope[field]])),
          version: runtime ? currentVersion : 'steer-lifecycle-graph/v1', policyDigest, referenceRevocationBytes: '', copies: [], aggregateBytes: '', tombstone: {} } : envelope;
        const provenance = config.recordClass === 'RC-CORPUS-PROVENANCE';
        const chained = raw && graph.version === 'steer-lifecycle-graph/raw-v4';
        const continuation = chained || raw && graph.version === 'steer-lifecycle-graph/raw-v3';
        requireValue(exactKeys(graph, ['version', 'policyDigest', 'configDigest', 'eventBytes', 'historyBytes', 'inventoryBytes', 'stateBytes', 'referenceRevocationBytes', 'copies', 'aggregateBytes', 'tombstone', ...(provenance ? ['derivedInventoryBytes'] : []), ...(raw ? ['rawPolicyBytes', 'rawBatchBytes'] : []), ...(continuation ? ['continuationBytes'] : []), ...(runtime ? ['historicalEvidenceBytes'] : []), ...(runtime?.qualified ? ['qualifiedDecisionBytes'] : []), ...(runtime?.archival ? ['archivedOwnerBytes'] : [])]) &&
          (continuation || graph.version === (runtime ? currentVersion : raw ? 'steer-lifecycle-graph/raw-v2' : 'steer-lifecycle-graph/v1')) && graph.policyDigest === policyDigest && graph.configDigest === configDigest);
        let qualifiedApprovals = [], archivedOwnerRetainedAt = null;
        if (runtime) {
          requireValue(runtime.historicalContext.scope.organization === scope.organization && runtime.historicalContext.scope.itemId === scope.item);
          if (runtime.reference) requireValue(runtime.referenceContentContext.organization === scope.organization && runtime.referenceContentContext.itemId === scope.item);
          const result = runtime.history.verify(runtime.mixed ? jcs({ version: runtime.archival ? 'steer-qualified-history/v2' : runtime.qualified ? 'steer-qualified-history/v1' : 'steer-mixed-history/v1', policyDigest: runtime.history.policyDigest,
            archivedEvidenceBytes: graph.historicalEvidenceBytes, eventBytes: graph.eventBytes, historyBytes: graph.historyBytes,
            ...(runtime.qualified ? { qualifiedDecisionBytes: graph.qualifiedDecisionBytes } : {}), ...(runtime.archival ? { archivedOwnerBytes: graph.archivedOwnerBytes } : {}) }) : graph.historicalEvidenceBytes, evaluationTime);
          requireValue(result.state === (runtime.qualified ? 'verified-qualified-history' : runtime.mixed ? 'verified-mixed-history' : 'verified-historical-events'));
          if (runtime.qualified) qualifiedApprovals = result.qualifiedApprovals;
          if (runtime.archival) archivedOwnerRetainedAt = result.archivedOwnerRetainedAt;
          if (!runtime.mixed) {
            const archived = parseCanonical(graph.historicalEvidenceBytes);
            requireValue(archived.eventBytes === graph.eventBytes && equal(archived.historyBytes, graph.historyBytes));
          }
        } else {
          const eventsResult = correctedLifecycleEventDecision(jcs({ version: 'steer-r5-001-events/v1', policyDigest: eventPolicy,
            scope: { organization: scope.organization, itemId: scope.item, environmentId: config.environmentId }, eventBytes: graph.eventBytes, historyBytes: graph.historyBytes, evaluationTime }));
          requireValue(eventsResult.state === 'validated-trigger');
        }
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
          const fields = runtime?.reference ? [...copyFields, 'objectSha256'] : copyFields;
          requireValue(exactKeys(copy, fields) && fields.filter((key) => key !== 'sourceOriginal').every((key) => text(copy[key])) && copy.sourceOriginal === false &&
            (!runtime?.reference || hex(copy.objectSha256, 64)));
          requireValue(!copyIds.has(copy.copyId)); copyIds.add(copy.copyId);
          const identity = jcs([copy.providerBindingId, copy.account, copy.objectKey, copy.versionId]); requireValue(!physical.has(identity)); physical.add(identity);
        }
        requireValue(equal(copies.map((copy) => copy.copyId), [...copyIds].sort()));
        const historyDigest = sha256(jcs([...graph.historyBytes, graph.eventBytes])), tupleDigest = sha256(jcs(copies));
        const state = readProof(graph.stateBytes, 'authority', ['kind', 'configDigest', 'source', 'inventoryDigest', 'historyDigest', 'historyComplete', 'holdState', 'referenceState', 'referenceRevocationDigest', 'parentExpiryAt', 'validThrough', ...(provenance ? ['derivedInventoryDigest'] : [])]);
        requireValue(state.kind === 'state' && state.source === 'authoritative-lifecycle-store' && state.inventoryDigest === inventory.recordDigest &&
          state.historyDigest === historyDigest && state.historyComplete === true && time(state.recordedAt) >= time(events.at(-1).occurredAt) &&
          time(state.recordedAt) >= time(inventory.recordedAt) && now - time(state.recordedAt) <= 300000000000n && now < time(state.validThrough));
        if (runtime) {
          const archived = parseCanonical(graph.historicalEvidenceBytes), retained = parseCanonical(archived.retentionReceiptBytes);
          requireValue(time(retained.recordedAt) <= time(state.recordedAt));
          if (runtime.archival) requireValue(time(archivedOwnerRetainedAt) <= time(state.recordedAt));
        }
        requireValue(['none', 'released', 'active'].includes(state.holdState) && ['cleared', 'active'].includes(state.referenceState));
        const holds = new Set();
        for (const event of events) {
          if (event.eventType === 'hold-applied') { requireValue(text(event.holdId) && !holds.has(event.holdId)); holds.add(event.holdId); }
          if (event.eventType === 'hold-released') { requireValue(holds.has(event.holdId)); holds.delete(event.holdId); }
        }
        requireValue(holds.size === 0 || state.holdState === 'active');
        if (runtime && state.holdState !== 'active') requireValue(state.holdState === (events.some((event) => event.eventType === 'hold-applied') ? 'released' : 'none'));
        const compound = { 'record-superseded-or-rebuild-requested': ['record-superseded', 'rebuild-requested'],
          'earlier-corpus-superseded-or-retired': ['corpus-version-superseded', 'corpus-retired'] };
        // 0068: the frozen table's item-closed surrogate contradicts the exact
        // signed records policy. Preserve that table for review traceability,
        // but require a current, closed manifest and every verified deletion.
        const types = provenance ? ['corpus-retired', 'derived-record-deleted'] : compound[row.trigger] ?? [row.trigger];
        const triggers = events.filter((event) => types.includes(event.eventType));
        requireValue(triggers.length > 0 || immediate);
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
        const boundaryAt = trigger ? lifecycleBoundary(trigger.occurredAt, row.duration, state.parentExpiryAt) : null;
        if (readiness) {
          // Age eligibility is not permission to mutate these objects. Still
          // reject inventory selectors that do not belong to the trusted binding.
          for (const copy of copies) {
            const binding = providers.find((entry) => entry.providerBindingId === copy.providerBindingId);
            requireValue(binding && binding.tenant === scope.tenant && binding.provider === copy.provider && binding.account === copy.account);
            const anchor = registry.bindings.find((entry) => entry.domain === binding.domain && entry.keyId === binding.keyId);
            requireValue(anchor && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt'].every((field) => anchor[field] === binding[field]));
          }
          requireValue(runtime?.reference ? state.referenceRevocationDigest === null || hex(state.referenceRevocationDigest, 64) : state.referenceRevocationDigest === null);
          const held = state.holdState === 'active' || state.referenceState !== 'cleared';
          const eligible = !held && boundaryAt !== null && now >= time(boundaryAt);
          return { state: held ? 'retained-on-hold' : immediate && !trigger ? 'waiting-for-trigger' : eligible ? 'eligible-pending-disposition-evidence' : 'waiting-retention', firstError: null,
            ...readinessLimits, retentionEligible: eligible, boundaryAt, evaluatedAt: evaluationTime, configDigest, policyDigest: readinessPolicyDigest,
            dispositionPolicyDigest: policyDigest, targetDigest: sha256(jcs(readinessTarget)), inputDigest: sha256(jcs({ bytes: serialized, evaluatedAt: evaluationTime })),
            recordId: config.recordId, recordClass: config.recordClass, artifactRevision: config.artifactRevision,
            inventoryDigest: inventory.recordDigest, stateDigest: state.recordDigest, historyDigest,
            ...(runtime ? { runtimeConfigDigest: runtime.configDigest, historicalEvidenceDigest: sha256(graph.historicalEvidenceBytes) } : {}),
            requires: [...(immediate && !trigger ? ['observed-trigger'] : []), ...(runtime?.reference ? ['reference-clearance'] : []), 'human-disposition-authority', 'protected-actions', 'provider-receipts', 'aggregate', 'tombstone'] };
        }
        if (boundaryAt === null) return { state: 'retained-immutable', firstError: null, effects: zeroEffects(), boundaryAt };
        if (state.holdState === 'active' || state.referenceState !== 'cleared') return { state: 'retained-on-hold', firstError: null, effects: zeroEffects(), boundaryAt };
        if (!raw && now < time(boundaryAt)) return { state: 'scheduled', firstError: null, effects: zeroEffects(), boundaryAt };
        let referenceEvidence = null;
        if (row.disposition.startsWith('reference-')) {
          if (runtime?.reference) {
            if (graph.referenceRevocationBytes === '') return { state: 'retained-pending-safe-disposition', firstError: 'REFERENCE_EVIDENCE_REQUIRED', boundaryAt, effects: zeroEffects() };
            referenceEvidence = runtime.referenceVerifier.verify(graph.referenceRevocationBytes, evaluationTime);
            requireValue(referenceEvidence.state === 'verified-reference-revocation' && referenceEvidence.completionDigest === state.referenceRevocationDigest &&
              referenceEvidence.holdState === state.holdState && time(referenceEvidence.completionAt) <= time(state.recordedAt));
            const reference = parseCanonical(graph.referenceRevocationBytes), referenceEvent = parseCanonical(reference.eventBytes);
            const matching = [...graph.historyBytes, graph.eventBytes].filter((bytes) => parseCanonical(bytes).eventType === 'reference-revocation-authorized');
            const archived = parseCanonical(graph.historicalEvidenceBytes);
            requireValue(matching.length === 1 && matching[0] === reference.eventBytes && ![...archived.historyBytes, archived.eventBytes].includes(reference.eventBytes) &&
              referenceEvent.recordDigest === referenceEvidence.eventDigest);
            const referenceAuthority = parseCanonical(parseCanonical(reference.humanBundleBytes).authorityBytes);
            const referenceHolds = new Set(); let priorHold = false;
            for (const event of events) {
              if (event.recordDigest === referenceEvent.recordDigest) break;
              if (!['hold-applied', 'hold-released'].includes(event.eventType)) continue;
              // The owner cannot claim a future release or have the hold context
              // change between its exact decision and the committed reference event.
              requireValue(time(event.occurredAt) <= time(referenceAuthority.decidedAt));
              if (event.eventType === 'hold-applied') { priorHold = true; referenceHolds.add(event.holdId); }
              else referenceHolds.delete(event.holdId);
            }
            requireValue(referenceEvidence.holdState === (referenceHolds.size ? 'active' : priorHold ? 'released' : 'none'));
            const manifest = parseCanonical(parseCanonical(reference.contentBytes).referenceManifestBytes);
            const versions = new Map();
            for (const copy of copies) {
              requireValue(manifest.versions.some((version) => version.versionId === copy.versionId && version.objectSha256 === copy.objectSha256));
              versions.set(copy.versionId, copy.objectSha256);
            }
            requireValue(equal([...versions.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0), manifest.versions.map((version) => [version.versionId, version.objectSha256])));
            qualifiedApprovals.push(referenceEvidence.qualifiedApproval);
          } else {
            const reference = readProof(graph.referenceRevocationBytes, 'authority', ['kind', 'configDigest', 'source', 'inventoryDigest', 'historyDigest', 'decision']);
            requireValue(reference.kind === 'reference-revocation' && reference.source === 'reference-revocation-service' && reference.inventoryDigest === inventory.recordDigest &&
              reference.historyDigest === historyDigest && reference.decision === 'authorized' && reference.recordDigest === state.referenceRevocationDigest &&
              time(reference.recordedAt) <= time(state.recordedAt));
          }
        } else requireValue(graph.referenceRevocationBytes === '' && state.referenceRevocationDigest === null);
        requireValue(Array.isArray(graph.copies) && graph.copies.length === copies.length && new Set(graph.copies.map((entry) => entry.copyId)).size === copies.length);
        let rawEvidence, rawAuthority;
        if (raw) {
          rawEvidence = rawVerifier.verify(graph.rawPolicyBytes, jcs(trigger), evaluationTime);
          requireValue(rawEvidence.state === 'verified-preterminal-grant' && rawEvidence.tupleDigest === tupleDigest && rawEvidence.copyCount === copies.length && rawEvidence.deadlineAt === boundaryAt);
          const rawInput = parseCanonical(graph.rawPolicyBytes), preparation = parseCanonical(rawInput.preparationBytes);
          requireValue(equal(preparation.copies, copies) && time(inventory.recordedAt) >= time(trigger.occurredAt));
          rawAuthority = parseCanonical(parseCanonical(rawInput.humanBundleBytes).authorityBytes);
        }
        const baseDigest = sha256(jcs({ configDigest, policyDigest, eventBytes: graph.eventBytes, historyBytes: graph.historyBytes, inventoryBytes: graph.inventoryBytes, stateBytes: graph.stateBytes, referenceRevocationBytes: graph.referenceRevocationBytes,
          ...(provenance ? { derivedInventoryBytes: graph.derivedInventoryBytes } : {}), ...(raw ? { rawGrantBindingDigest: rawEvidence.batchBindingDigest } : {}),
          ...(runtime ? { historicalEvidenceBytes: graph.historicalEvidenceBytes } : {}), ...(runtime?.qualified ? { qualifiedDecisionBytes: graph.qualifiedDecisionBytes } : {}),
          ...(runtime?.archival ? { archivedOwnerBytes: graph.archivedOwnerBytes } : {}) }));
        const usedAuthorities = new Set(), usedRequests = new Set(), usedIdempotency = new Set(), transactions = new Set();
        const humanProofs = new Set(), humanReservations = new Set(), humanKeys = new Set(), humanHeads = new Set();
        const credentialIds = new Set(), reservationIds = new Set(), actionHeads = new Set();
        const unique = (set, value) => { requireValue(!set.has(value)); set.add(value); };
        for (const approval of qualifiedApprovals) {
          unique(usedAuthorities, approval.authorityId); unique(humanProofs, approval.providerRecordId); unique(humanKeys, approval.idempotencyKey);
          unique(humanReservations, approval.reservationId); unique(humanHeads, approval.headPair);
        }
        if (raw) {
          const enrollment = parseCanonical(parseCanonical(graph.rawPolicyBytes).humanBundleBytes);
          unique(usedAuthorities, rawAuthority.authorityId); unique(humanProofs, rawAuthority.providerRecordId); unique(humanKeys, rawAuthority.idempotencyKey);
          unique(humanReservations, parseCanonical(enrollment.casReservationBytes).reservationId);
          const head = parseCanonical(enrollment.casHeadBytes); unique(humanHeads, jcs([head.headId, head.head]));
        }
        const bindingFor = (id) => {
          const binding = providers.find((entry) => entry.providerBindingId === id); requireValue(binding && binding.tenant === scope.tenant);
          const anchor = registry.bindings.find((entry) => entry.domain === binding.domain && entry.keyId === binding.keyId);
          requireValue(anchor && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt'].every((key) => anchor[key] === binding[key])); return binding;
        };
        const human = (bytes, selected, conditions, method, authorityType) => {
          requireValue(typeof bytes === 'string' && bytes.length <= 1048576); const bundle = parseCanonical(bytes);
          const humanEnvelope = jcs({ version: 'steer-r5-002-human/v1', policyDigest: humanPolicy, bundleBytes: bytes });
          requireValue(bundle.evaluationTime === evaluationTime && (runtime ? runtime.human.verify(humanEnvelope, evaluationTime) : correctedHumanAuthorityDecision(humanEnvelope)).decision === 'ALLOW');
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
          const context = actionContext(grant), result = (runtime?.reference ? createReferenceProtectedActionVerifier : createProtectedActionVerifier)(jcs(context)).verify(entry.actionBundleBytes, evaluationTime);
          requireValue(['AUTHORIZED_CANDIDATE', 'REPLAY_NOOP'].includes(result.decision));
          const bundle = parseCanonical(entry.actionBundleBytes), request = parseCanonical(bundle.requestBytes), operation = request.operation;
          requireValue(parseCanonical(bundle.resourcesBytes).signature.keyId === binding.keyId);
          for (const key of ['upstreamBytes', 'downstreamBytes']) unique(credentialIds, parseCanonical(bundle[key]).credentialId);
          unique(reservationIds, parseCanonical(bundle.reservationBytes).reservationId);
          const actionHead = parseCanonical(bundle.headBytes); unique(actionHeads, jcs([actionHead.headId, actionHead.head]));
          requireValue(!usedRequests.has(result.requestDigest) && !usedIdempotency.has(operation.idempotencyKey) && time(operation.requestedAt) >= earliest &&
            time(operation.requestedAt) >= time(authority.decidedAt)); usedRequests.add(result.requestDigest); usedIdempotency.add(operation.idempotencyKey);
          const receipt = readProof(entry.receiptBytes, binding.domain, ['kind', 'configDigest', 'contextDigest', 'inputDigest', 'requestDigest', 'resourcesDigest', 'authorityDigest', 'action', 'transactionId', 'effect', 'status']);
          requireValue(receipt.signature.keyId === binding.keyId && receipt.kind === 'receipt' && receipt.contextDigest === result.contextDigest && receipt.inputDigest === grant.inputDigest &&
            receipt.requestDigest === result.requestDigest && receipt.resourcesDigest === result.resourcesDigest && receipt.authorityDigest === authority.recordDigest &&
            receipt.action === grant.action && receipt.effect === (grant.action === 'lifecycle.crypto-erase' ? 'crypto-erased' : grant.action === 'lifecycle.commit-tombstone' ? 'tombstone-committed' : 'deleted') &&
            receipt.status === 'terminal-success' && text(receipt.transactionId) && !transactions.has(receipt.transactionId) &&
            time(receipt.recordedAt) > time(operation.requestedAt) && time(receipt.recordedAt) <= latest);
          if (result.decision === 'REPLAY_NOOP') requireValue(result.resultDigest === receipt.recordDigest && time(receipt.recordedAt) <= time(parseCanonical(bundle.replayBytes).recordedAt));
          else requireValue(time(receipt.recordedAt) > time(parseCanonical(bundle.reservationBytes).recordedAt));
          transactions.add(receipt.transactionId); return { receipt, replay: result.decision === 'REPLAY_NOOP',
            batchEntry: { copyId: grant.grantId, requestDigest: result.requestDigest, operationDigest: result.operationDigest,
              idempotencyKey: operation.idempotencyKey, requestedAt: operation.requestedAt, reservationAt: parseCanonical(bundle.reservationBytes).recordedAt,
              receiptAt: receipt.recordedAt, receiptDigest: receipt.recordDigest, replayed: result.decision === 'REPLAY_NOOP' } };
        };
        const receipts = [], batchEntries = []; let replayCount = 0;
        for (const copy of copies) {
          const entry = graph.copies.find((value) => value.copyId === copy.copyId);
          requireValue(exactKeys(entry, raw ? ['copyId', 'actionBundleBytes', 'receiptBytes'] : ['copyId', 'humanBundleBytes', 'rawGrantBytes', 'actionBundleBytes', 'receiptBytes']));
          const binding = bindingFor(copy.providerBindingId); requireValue(binding.provider === copy.provider && binding.account === copy.account);
          const crypto = raw || row.disposition.startsWith('crypto-erase'), action = crypto ? 'lifecycle.crypto-erase' : 'lifecycle.delete-copy';
          const conditions = [`lifecycle-inventory:${inventory.recordDigest}`, `tuple:${sha256(jcs(copy))}`, `input:${baseDigest}`];
          const authority = raw ? rawAuthority : human(entry.humanBundleBytes, [copy], conditions, crypto ? 'cryptographic-erase' : 'provider-delete', 'disposition-authorization');
          if (!raw) requireValue(entry.rawGrantBytes === '');
          const resources = { objectId: config.recordId, recordClass: config.recordClass, ...Object.fromEntries(['copyId', 'copyKind', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId'].map((key) => [key, copy[key]])), inventoryDigest: inventory.recordDigest, tupleDigest,
            ...(runtime?.reference ? { objectSha256: copy.objectSha256 } : {}) };
          const grant = { grantId: copy.copyId, action, actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject, provider: copy.provider, resourceDomain: binding.domain,
            resources, authorityEvidenceDigest: authority.recordDigest, inputDigest: baseDigest };
          const checked = verifyAction(entry, grant, binding, authority, raw ? time(trigger.occurredAt) : time(boundaryAt), raw ? time(boundaryAt) : now);
          receipts.push(checked.receipt); batchEntries.push(checked.batchEntry); if (checked.replay) replayCount++;
        }
        const aggregate = readProof(graph.aggregateBytes, 'provider', ['kind', 'configDigest', 'inputDigest', 'inventoryDigest', 'receiptDigests', 'allCopiesGone']);
        requireValue(aggregate.kind === 'aggregate' && aggregate.inputDigest === baseDigest && aggregate.inventoryDigest === inventory.recordDigest &&
          equal(aggregate.receiptDigests, receipts.map((receipt) => receipt.recordDigest)) && aggregate.allCopiesGone === true &&
          receipts.every((receipt) => time(aggregate.recordedAt) > time(receipt.recordedAt)));
        let batchEvidence, checkpointEvidence;
        if (raw) {
          const batch = parseCanonical(graph.rawBatchBytes);
          requireValue(batch.version === (chained ? 'steer-raw-batch/v3' : continuation ? 'steer-raw-batch/v2' : 'steer-raw-batch/v1'));
          const batchContext = { configDigest, inputDigest: baseDigest, preterminalBindingDigest: rawEvidence.batchBindingDigest,
            authorityDigest: rawAuthority.recordDigest, tupleDigest, terminalDigest: trigger.recordDigest, terminalAt: trigger.occurredAt, deadlineAt: boundaryAt,
            stateAt: state.recordedAt, entries: batchEntries, aggregateDigest: aggregate.recordDigest, aggregateAt: aggregate.recordedAt };
          if (continuation) {
            const opening = parseCanonical(parseCanonical(batch.openingBytes).reservationBytes);
            const checkpointContext = { configDigest, inputDigest: baseDigest, preterminalBindingDigest: rawEvidence.batchBindingDigest,
              authorityDigest: rawAuthority.recordDigest, tupleDigest, recordId: config.recordId, artifactRevision: config.artifactRevision, environmentId: config.environmentId,
              originalHistoryBytes: [...graph.historyBytes, graph.eventBytes], copies, originalStateAt: state.recordedAt, planDigest: parseCanonical(batch.planBytes).recordDigest,
              openingReservationDigest: opening.recordDigest, openingAt: opening.recordedAt, entries: batchEntries };
            checkpointEvidence = chained ? verifyRawCheckpointChain(graph.continuationBytes, { checkpointContext, batchContext, finalBatchBytes: graph.rawBatchBytes }, evaluationTime) :
              verifyRawCheckpointEvidence(graph.continuationBytes, checkpointContext, evaluationTime);
            requireValue(checkpointEvidence.state === (chained ? 'verified-raw-checkpoint-chain' : 'verified-raw-checkpoint'));
          }
          batchEvidence = chained ? checkpointEvidence.batchEvidence : verifyRawBatchEvidence(graph.rawBatchBytes, { ...batchContext,
            ...(continuation ? { checkpoint: Object.fromEntries(['checkpointDigest', 'recordedAt', 'completedCopyIds', 'remainingCopyIds'].map((field) => [field, checkpointEvidence[field]])) } : {}) }, evaluationTime);
          requireValue(batchEvidence.state === 'verified-raw-batch');
        }
        const tombstone = graph.tombstone; requireValue(exactKeys(tombstone, ['humanBundleBytes', 'actionBundleBytes', 'receiptBytes']));
        const conditions = [`lifecycle-inventory:${inventory.recordDigest}`, `aggregate:${aggregate.recordDigest}`, `input:${baseDigest}`,
          ...(runtime?.reference ? [`tombstone:${referenceEvidence.tombstoneRecordId}`, `verification:${referenceEvidence.verificationBundleDigest}`] : []),
          ...(continuation ? [`raw-checkpoint:${checkpointEvidence.checkpointDigest}`] : []), ...(chained ? [`raw-checkpoint-chain:${checkpointEvidence.chainDigest}`] : [])];
        const authority = human(tombstone.humanBundleBytes, copies, conditions, 'provider-delete', 'disposition-authorization');
        requireValue(time(authority.decidedAt) >= time(aggregate.recordedAt));
        if (continuation) requireValue(time(authority.decidedAt) >= time(checkpointEvidence.recordedAt));
        const binding = bindingFor(config.tombstoneProviderBindingId);
        const grant = { grantId: 'tombstone', action: 'lifecycle.commit-tombstone', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
          provider: binding.provider, resourceDomain: binding.domain, resources: { objectId: config.recordId, recordClass: config.recordClass, inventoryDigest: inventory.recordDigest,
            tupleDigest, aggregateReceiptDigest: aggregate.recordDigest, path: config.tombstonePath,
            ...(runtime?.reference ? { tombstoneRecordId: referenceEvidence.tombstoneRecordId, verificationBundleDigest: referenceEvidence.verificationBundleDigest } : {}) }, authorityEvidenceDigest: authority.recordDigest, inputDigest: baseDigest };
        const checked = verifyAction(tombstone, grant, binding, authority, time(aggregate.recordedAt)); if (checked.replay) replayCount++;
        return { state: 'validated-lifecycle-candidate', firstError: null, effects: zeroEffects(), configDigest, policyDigest, boundaryAt,
          copyCount: copies.length, protectedActionCount: copies.length + 1, replayCount,
          ...(runtime ? { executionAuthorized: false, runtimeConfigDigest: runtime.configDigest, historicalEvidenceDigest: sha256(graph.historicalEvidenceBytes) } : {}),
          ...(runtime?.reference ? { referenceEvidenceDigest: referenceEvidence.evidenceDigest, referenceCount: referenceEvidence.referenceCount,
            tombstoneRecordId: referenceEvidence.tombstoneRecordId } : {}),
          ...(raw ? { rawBatchMode: batchEvidence.mode, rawBatchPlanDigest: batchEvidence.planDigest, rawBatchReservationDigest: batchEvidence.reservationDigest,
            rawGrantDigest: rawAuthority.recordDigest, executionAuthorized: false } : {}),
          ...(continuation ? { rawCheckpointDigest: checkpointEvidence.checkpointDigest, completedBeforeContinuation: checkpointEvidence.completedCopyIds.length } : {}),
          ...(chained ? { rawCheckpointCount: checkpointEvidence.checkpointCount, rawCheckpointChainDigest: checkpointEvidence.chainDigest } : {}),
          evidenceDigest: sha256(jcs([...receipts.map((receipt) => receipt.recordDigest), aggregate.recordDigest, checked.receipt.recordDigest,
            ...(raw ? [rawAuthority.recordDigest, batchEvidence.planDigest, batchEvidence.reservationDigest] : [])])) };
      } catch { return blocked(); }
    },
  });
}
