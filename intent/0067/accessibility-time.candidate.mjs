// Offline structural evidence candidate, never a substitute for a human audit.
import { readFileSync } from 'node:fs';
import { accessibilityMatrixProof } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { exactKeys, jcs, parseCanonical, sha256, strictTime, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
const read = (name) => readFileSync(new URL(`../0001/reviews/domain/round-3/remediation/${name}`, import.meta.url), 'utf8').trimEnd();
const registryBytes = jcs(JSON.parse(read('TRUST-REGISTRY.candidate.json'))), timed = createTimedRecordVerifier(registryBytes);
const manifestBytes = read('ACCESSIBILITY-MATRIX-MANIFEST.candidate.json'), manifest = JSON.parse(manifestBytes);
const surfaces = manifest.routes.reduce((sum, route) => sum + route.states.length, 0) + manifest.stories.length * manifest.storyStates.length;
const rowLimit = surfaces * manifest.scenarios.length * manifest.environments.reduce((sum, environment) => sum + manifest.viewports.filter((viewport) => viewport.class === environment.viewportClass).length, 0);
export const policyDigest = sha256(jcs({ version: 'steer-accessibility-time/v1', registryDigest: timed.registryDigest,
  manifestDigest: sha256(manifestBytes), rowLimit, rowCharacterLimit: 16384, totalCharacterLimit: 536870912,
  rules: 'six explicit-time signatures before rows; independent provider proof binds summary/batch and their identity/qualification/assignment references; qualification/assignment observed-as-of provider time, never inferred issuance; every row within qualified assigned window and before summary; exact original matrix required; candidate only, no human audit completion' }));
const requireValue = (value) => { if (!value) throw new Error('ACCESSIBILITY_TIME_INVALID'); };
const time = (value) => { const parsed = strictTime(value); requireValue(parsed !== null); return parsed; };
const bytes = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
const signatureKeys = ['summaryBytes', 'identityBytes', 'qualificationBytes', 'assignmentBytes', 'batchProofBytes', 'providerProofBytes'];

// Row iterator is an in-process composition seam for immutable retrieved rows,
// not a serialized tool callback. Async/storage ingestion is not implemented.
export function createAccessibilityTimeVerifier(contextBytes) {
  let evaluatedAt;
  try {
    requireValue(bytes(contextBytes, 1024)); const context = parseCanonical(contextBytes);
    requireValue(exactKeys(context, ['version', 'evaluatedAt']) && context.version === 'steer-audit-clock/v1');
    time(context.evaluatedAt); evaluatedAt = context.evaluatedAt;
  } catch { throw new Error('ACCESSIBILITY_TIME_CONTEXT_INVALID'); }
  return Object.freeze({
    verify(serialized, rows) {
      const reject = () => ({ valid: false, error: 'ACCESSIBILITY_TIME_INVALID', rowCount: 0, digest: null,
        effects: zeroEffects(), executionAuthorized: false, manualAuditComplete: false });
      try {
        requireValue(bytes(serialized, 262144)); const input = parseCanonical(serialized);
        requireValue(exactKeys(input, ['version', 'policyDigest', 'metadataBytes']) && input.version === 'steer-accessibility-time/v1' &&
          input.policyDigest === policyDigest && bytes(input.metadataBytes, 131072));
        const metadata = parseCanonical(input.metadataBytes);
        requireValue(exactKeys(metadata, ['manifestBytes', ...signatureKeys]) && metadata.manifestBytes === manifestBytes);
        for (const key of signatureKeys) requireValue(bytes(metadata[key], 16384));
        const summary = parseCanonical(metadata.summaryBytes), identity = parseCanonical(metadata.identityBytes), qualification = parseCanonical(metadata.qualificationBytes),
          assignment = parseCanonical(metadata.assignmentBytes), batch = parseCanonical(metadata.batchProofBytes), provider = parseCanonical(metadata.providerProofBytes);
        const identityAt = time(identity.verifiedAt), summaryAt = time(summary.signedAt), batchAt = time(batch.sealedAt), providerAt = time(provider.recordedAt), evaluated = time(evaluatedAt);
        requireValue(identityAt <= summaryAt && summaryAt <= batchAt && batchAt <= providerAt && providerAt <= evaluated);
        const providerVerified = timed.verifyBytes(metadata.providerProofBytes, { domain: 'human-provider', recordedAt: provider.recordedAt, evaluatedAt });
        for (const [key, domain, recordedAt] of [['summaryBytes', 'summary', summary.signedAt], ['identityBytes', 'provider', identity.verifiedAt],
          ['qualificationBytes', 'provider', provider.recordedAt], ['assignmentBytes', 'assignment', provider.recordedAt], ['batchProofBytes', 'summary', batch.sealedAt]]) {
          const verified = timed.verifyBytes(metadata[key], { domain, recordedAt, evaluatedAt }); requireValue(verified.anchorDigest !== providerVerified.anchorDigest);
        }
        // Prove transitive binding before starting potentially expensive row I/O.
        requireValue(provider.summaryDigest === summary.recordDigest && provider.batchProofDigest === batch.recordDigest && provider.assignmentDigest === assignment.recordDigest &&
          summary.identityDigest === identity.recordDigest && summary.qualificationDigest === qualification.recordDigest && summary.assignmentDigest === assignment.recordDigest &&
          summary.manifestDigest === sha256(manifestBytes) && summary.rowCount === rowLimit * 81 && summary.rawRowsDigest === batch.rawRowsDigest &&
          batch.rowCount === summary.rowCount && batch.assignmentDigest === assignment.recordDigest && batch.manifestDigest === summary.manifestDigest);
        for (const record of [qualification, assignment]) requireValue(time(record.validFrom) <= summaryAt && evaluated < time(record.validThrough));
        requireValue(rows !== null && typeof rows === 'object' && typeof rows[Symbol.iterator] === 'function');
        let rawRowCount = 0, characters = 0;
        function* checkedRows() {
          for (const serializedRow of rows) {
            requireValue(++rawRowCount <= rowLimit && bytes(serializedRow, 16384)); characters += serializedRow.length; requireValue(characters <= 536870912);
            const row = parseCanonical(serializedRow), started = time(row.startedAt), ended = time(row.endedAt);
            requireValue(identityAt <= started && started < ended && ended <= summaryAt);
            for (const record of [qualification, assignment]) requireValue(time(record.validFrom) <= started && ended < time(record.validThrough));
            yield serializedRow; // Original bytes, not an inspection reserialization.
          }
        }
        const result = accessibilityMatrixProof({ ...metadata, rows: checkedRows(), evaluationTime: evaluatedAt });
        requireValue(result.valid === true && rawRowCount === rowLimit);
        return { ...result, effects: zeroEffects(), executionAuthorized: false, manualAuditComplete: false,
          timePolicyDigest: policyDigest, evaluatedAt, timedRecordCount: 6, observedAsOfCount: 2, rawRowCount };
      } catch { return reject(); }
    },
  });
}
