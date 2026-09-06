// Schema execution is structural evidence, never signature or graph acceptance.
import { readFileSync } from 'node:fs';
import { compilePreciseSchema, schemaPolicyDigest } from '../0070/precision-schemas.candidate.mjs';
import { compileOffline, schemaRegistry, bundleSchema } from '../0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs';
import { makeLifecycleEventBytes, mutateLifecycleEventBytes, makeHumanAuthorityBundle, makeRecoveryEvidence, makeAccessibilityBundle,
  makePrivacyGraph, makeCostGraph, makeSpendGraph, makeLifecycleGraph } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const precise = new Set(['LIFECYCLE-EVENT', 'HUMAN-AUTHORITY', 'RAW-POLICY-GRANT']);
const ordinary = new Set(['PROVIDER-RECOVERY', 'ACCESSIBILITY-MANIFEST', 'ACCESSIBILITY-ROW', 'ACCESSIBILITY-SUMMARY', 'PRIVACY-DETECTOR-REGISTRY',
  'PRIVACY-EVIDENCE', 'COST-EVIDENCE', 'SPEND-AUTHORIZATION', 'REPLAY-LEDGER', 'CAS-HEAD', 'PROVIDER-RECEIPT']);
const read = (name) => JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/' + name, import.meta.url)));
export function schemaExecutionInputs(kind) {
  let positive; const negatives = [];
  switch (kind) {
    case 'LIFECYCLE-EVENT': positive = JSON.parse(makeLifecycleEventBytes('record-committed', 150));
      negatives.push(JSON.parse(mutateLifecycleEventBytes(makeLifecycleEventBytes('record-committed', 151), 'missing-record-sha'))); break;
    case 'HUMAN-AUTHORITY': positive = JSON.parse(makeHumanAuthorityBundle().authorityBytes); negatives.push({ ...positive, humanSubject: '' }); break;
    case 'RAW-POLICY-GRANT': positive = { version: 'steer-raw-policy-grant/v4', authority: JSON.parse(makeHumanAuthorityBundle().authorityBytes),
      recordClass: 'RC-CORPUS-RAW-WORKING', sanitizerRevision: 'sanitizer-v1', inspectorRevision: 'inspector-v1', completeInventoryRequired: true,
      receiptRequired: true, permittedTargetKind: 'temporary-copy-only' };
      negatives.push({ ...positive, authority: null }, { ...positive, recordClass: 'RC-DECISION-PROOF' }); break;
    case 'PROVIDER-RECOVERY': positive = JSON.parse(makeRecoveryEvidence()); negatives.push({ ...positive, organization: '' }); break;
    case 'ACCESSIBILITY-MANIFEST': positive = read('ACCESSIBILITY-MATRIX-MANIFEST.candidate.json'); break;
    case 'ACCESSIBILITY-ROW': { const bundle = makeAccessibilityBundle(); try { positive = JSON.parse(bundle.rows.next().value); } finally { bundle.rows.return(); } break; }
    case 'ACCESSIBILITY-SUMMARY': { const bundle = makeAccessibilityBundle(); bundle.rows.return(); positive = JSON.parse(bundle.summaryBytes); break; }
    case 'PRIVACY-DETECTOR-REGISTRY': positive = read('PRIVACY-DETECTOR-REGISTRY.candidate.json'); break;
    case 'PRIVACY-EVIDENCE': positive = JSON.parse(makePrivacyGraph()); break;
    case 'COST-EVIDENCE': positive = JSON.parse(JSON.parse(makeCostGraph('invoice-at-close')).recordsBytes[0]); break;
    case 'SPEND-AUTHORIZATION': positive = JSON.parse(JSON.parse(makeSpendGraph()).authorizationChainBytes.at(-1)); break;
    case 'REPLAY-LEDGER': positive = JSON.parse(JSON.parse(makeLifecycleGraph('RC-FAILED-RUN', 'complete')).replayLedgersBytes[0]); break;
    case 'CAS-HEAD': positive = JSON.parse(JSON.parse(makeLifecycleGraph('RC-FAILED-RUN', 'complete')).casHeadsBytes[0]); break;
    case 'PROVIDER-RECEIPT': positive = JSON.parse(JSON.parse(makeLifecycleGraph('RC-FAILED-RUN', 'complete')).providerReceiptsBytes[0]); break;
    default: throw new Error('UNMAPPED_SCHEMA_CASE');
  }
  negatives.push({ ...positive, unlistedField: true }); return { positive, negatives };
}
export function schemaExecutionHook(required) {
  if (required.family !== 'SCHEMA' || !precise.has(required.coordinate.kind) && !ordinary.has(required.coordinate.kind)) return null;
  const kind = required.coordinate.kind, selected = precise.has(kind);
  return { executor: selected ? 'intent/0070/precision-schemas.candidate.mjs#compilePreciseSchema' : 'intent/0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs#compileOffline',
    scope: selected ? '0070 corrected exact-time structural schema, with original cases and all declared timestamp fields; signature validity and graph acceptance are separate' :
      'retained original record-format schema regression only; not signature, corrected graph, future-profile or manual accessibility acceptance', run(check) {
      const name = kind + '.schema.json', registry = schemaRegistry(), schema = registry.get(name), values = schemaExecutionInputs(kind);
      const validator = selected ? compilePreciseSchema(name) : compileOffline(name, registry);
      const source = { name, bundledSourceDigest: sha256(jcs(bundleSchema(name, registry))), ...(selected ? { schemaPolicyDigest } : {}) };
      check(jcs(source), () => ({ type: schema.type, additionalProperties: schema.additionalProperties }), { type: 'object', additionalProperties: false });
      // Schema data includes fractional linkage thresholds. Preserve ordinary
      // JSON numbers; the signed-record JCS helper intentionally permits integers only.
      const inspect = (value, valid) => check(JSON.stringify({ ...source, value }), () => { const errors = validator(value); return { valid: errors.length === 0, errors }; }, { valid });
      inspect(values.positive, true); for (const value of values.negatives) inspect(value, false);
      if (selected) {
        const fields = kind === 'LIFECYCLE-EVENT' ? ['occurredAt'] : ['authenticatedAt', 'decidedAt', 'validFrom', 'expiresAt', 'qualificationValidThrough', 'assignmentValidThrough'];
        for (const field of fields) for (const [time, valid] of [['2026-09-04T12:00:00.000000001Z', true], ['2026-02-29T12:00:00.000000001Z', false],
          ['2026-09-04T12:00:00.1Z', false], ['2026-09-04T24:00:00.000000001Z', false]]) {
          const value = structuredClone(values.positive); (kind === 'RAW-POLICY-GRANT' ? value.authority : value)[field] = time;
          inspect(value, valid); // Intentional shape-only mutation: copied signatures are not asserted valid.
        }
      }
    } };
}
