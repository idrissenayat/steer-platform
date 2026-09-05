// Offline R5-004 correction. No runtime route, spending action or frozen-file edit.
import { costDecision } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { exactKeys, jcs, parseCanonical, parseSigned, sha256, strictTime, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

export const correctionPolicyBytes = jcs({ version: 'steer-r5-004-correction/v1', finding: 'PREFLIGHT-R3-R5-004',
  lineLimit: 64, recordLimit: 16384, graphLimit: 4194304, envelopeLimit: 8388608,
  reconciliation: 'exact ledger/usage/invoice/variance/successor bijection before final aggregate',
  signatures: 'unchanged frozen money/provider verification; no caller authority',
  amounts: 'variance totals equal actual provider and ledger; exact integer difference',
  time: 'invoice acknowledgement <= variance <= reconciliation <= evaluation; at most 24h after acknowledgement',
});
export const correctionPolicyDigest = sha256(correctionPolicyBytes);
const deny = (firstError) => ({ decision: 'DENY', firstError, effects: zeroEffects() });
const boundedBytes = (value) => typeof value === 'string' && value.length > 0 && value.length <= 16384;
const varianceKeys = ['varianceId', 'invoiceDigest', 'usageDigest', 'ledgerDigest', 'providerTotalNanoUsd', 'ledgerTotalNanoUsd', 'varianceNanoUsd', 'status', 'recordedAt', 'recordDigest', 'signature'];
const reconciliationKeys = ['reconciliationId', 'predecessorInvoiceDigest', 'predecessorUsageDigest', 'predecessorLedgerDigest', 'varianceDigest', 'successorStatus', 'reconciledAt', 'recordDigest', 'signature'];

function uniqueIndex(rows, idKey, indexKey) {
  const ids = new Set(), digests = new Set(), index = new Map();
  for (const row of rows) {
    if (typeof row[idKey] !== 'string' || !row[idKey] || !/^[0-9a-f]{64}$/.test(row.recordDigest) ||
        !/^[0-9a-f]{64}$/.test(row[indexKey]) || ids.has(row[idKey]) || digests.has(row.recordDigest) || index.has(row[indexKey]))
      throw new Error('Duplicate or invalid lineage');
    ids.add(row[idKey]); digests.add(row.recordDigest); index.set(row[indexKey], row);
  }
  return index;
}

export function correctedCostDecision(serialized) {
  try {
    if (typeof serialized !== 'string' || serialized.length > 8388608) return deny('CORRECTION_ENVELOPE_INVALID');
    const envelope = parseCanonical(serialized);
    if (!exactKeys(envelope, ['version', 'policyDigest', 'graphBytes', 'varianceRecordsBytes', 'reconciliationRecordsBytes']) ||
        envelope.version !== 'steer-r5-004-correction/v1' || envelope.policyDigest !== correctionPolicyDigest ||
        typeof envelope.graphBytes !== 'string' || envelope.graphBytes.length > 4194304) return deny('CORRECTION_ENVELOPE_INVALID');
    const graph = parseCanonical(envelope.graphBytes);
    if (!graph || graph.kind !== 'reconciliation' || graph.varianceBytes !== '' || graph.reconciliationBytes !== '' ||
        !Array.isArray(graph.recordsBytes) || !graph.recordsBytes.length || graph.recordsBytes.length > 64)
      return deny('RECONCILIATION_GRAPH_INVALID');
    const count = graph.recordsBytes.length;
    for (const rows of [graph.recordsBytes, graph.providerUsageRecordsBytes, graph.providerInvoiceRecordsBytes, envelope.varianceRecordsBytes, envelope.reconciliationRecordsBytes])
      if (!Array.isArray(rows) || rows.length !== count || !rows.every(boundedBytes)) return deny('LINEAGE_MULTIPLICITY_INVALID');

    // Maps are only candidate indexes. Every signed record must validate before ALLOW.
    const records = graph.recordsBytes.map(parseCanonical), usages = graph.providerUsageRecordsBytes.map(parseCanonical), invoices = graph.providerInvoiceRecordsBytes.map(parseCanonical);
    const ledger = uniqueIndex(records, 'recordId', 'recordDigest'), usage = uniqueIndex(usages, 'usageId', 'recordDigest'), invoice = uniqueIndex(invoices, 'invoiceId', 'recordDigest');
    const variances = envelope.varianceRecordsBytes.map((bytes) => parseSigned(bytes, 'money'));
    const reconciliations = envelope.reconciliationRecordsBytes.map((bytes) => parseSigned(bytes, 'money'));
    if (variances.some((row) => !exactKeys(row, varianceKeys)) || reconciliations.some((row) => !exactKeys(row, reconciliationKeys))) return deny('RECONCILIATION_RECORD_INVALID');
    const variance = uniqueIndex(variances, 'varianceId', 'ledgerDigest'), reconciliation = uniqueIndex(reconciliations, 'reconciliationId', 'predecessorLedgerDigest');
    const now = strictTime(graph.decisionAt); if (now === null) return deny('RECONCILIATION_TIME_INVALID');
    const usedUsages = new Set(), usedInvoices = new Set();
    for (const [digest, record] of ledger) {
      const v = variance.get(digest), r = reconciliation.get(digest), u = usage.get(record.providerUsageDigest), i = invoice.get(record.providerInvoiceDigest);
      if (!v || !r || !u || !i || usedUsages.has(u.recordDigest) || usedInvoices.has(i.recordDigest) ||
          v.invoiceDigest !== i.recordDigest || v.usageDigest !== u.recordDigest ||
          r.predecessorInvoiceDigest !== i.recordDigest || r.predecessorUsageDigest !== u.recordDigest || r.varianceDigest !== v.recordDigest)
        return deny('RECONCILIATION_LINEAGE_INVALID');
      usedUsages.add(u.recordDigest); usedInvoices.add(i.recordDigest);
      if (v.providerTotalNanoUsd !== i.totalNanoUsd || v.ledgerTotalNanoUsd !== record.totalNanoUsd ||
          BigInt(v.providerTotalNanoUsd) - BigInt(v.ledgerTotalNanoUsd) !== BigInt(v.varianceNanoUsd) ||
          v.status !== 'within-threshold' || r.successorStatus !== 'reconciled') return deny('RECONCILIATION_AMOUNT_INVALID');
      const ack = strictTime(i.acknowledgedAt), at = strictTime(v.recordedAt), reconciled = strictTime(r.reconciledAt);
      if ([ack, at, reconciled].includes(null) || !(ack <= at && at <= reconciled && reconciled <= now && reconciled - ack <= 86400000))
        return deny('RECONCILIATION_TIME_INVALID');
    }
    // Exact multiplicities + unique ledger keys + one match for every ledger prove
    // no missing, reused or orphan variance/successor. Only now derive the aggregate.
    const first = records[0].recordDigest;
    const result = costDecision(jcs({ ...graph, varianceBytes: jcs(variance.get(first)), reconciliationBytes: jcs(reconciliation.get(first)) }));
    if (result.decision !== 'ALLOW') return deny('BASE_COST_REJECTED');
    return { ...result, correctionPolicyDigest, reconciledLineCount: count };
  } catch { return deny('RECONCILIATION_EVIDENCE_INVALID'); }
}
