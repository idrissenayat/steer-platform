// Executable bounded compatibility model, not a database or production adapter.
// Both versioned clients require this explicit compatibility shim during migration.
import { exactKeys, jcs, parseCanonical, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const ensure = (value) => { if (!value) throw new Error('MIGRATION_COMPATIBILITY_INVALID'); };
const name = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value &&
  !/[\u0000-\u001f\u007f*?]/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const cell = (value) => value === null || (typeof value === 'string' && value.length <= 4096);
export function createDualColumnModel(dataBytes, sourceColumn, targetColumn) {
  ensure(typeof dataBytes === 'string' && Buffer.byteLength(dataBytes, 'utf8') <= 65536 && name(sourceColumn) && name(targetColumn) && sourceColumn !== targetColumn);
  const data = parseCanonical(dataBytes);
  ensure(exactKeys(data, ['schemaVersion', 'columns', 'rows']) && name(data.schemaVersion) && Array.isArray(data.columns) && data.columns.length > 0 && data.columns.length <= 32 &&
    data.columns.every(name) && new Set(data.columns).size === data.columns.length && jcs(data.columns) === jcs([...data.columns].sort()) &&
    Array.isArray(data.rows) && data.rows.length > 0 && data.rows.length <= 128);
  const sourcePresent = data.columns.includes(sourceColumn), targetPresent = data.columns.includes(targetColumn);
  ensure(sourcePresent || targetPresent);
  const revisions = new Map(), originalValues = new Map(), commands = new Map();
  for (const row of data.rows) {
    ensure(exactKeys(row, ['rowId', 'values']) && name(row.rowId) && !revisions.has(row.rowId) && exactKeys(row.values, data.columns) && Object.values(row.values).every(cell));
    if (sourcePresent && targetPresent) ensure(row.values[targetColumn] === null || row.values[targetColumn] === row.values[sourceColumn]);
    revisions.set(row.rowId, 0); originalValues.set(row.rowId, sourcePresent ? row.values[sourceColumn] : row.values[targetColumn]);
  }
  ensure(jcs([...revisions.keys()]) === jcs([...revisions.keys()].sort()));
  const rowFor = (rowId) => { ensure(name(rowId) && revisions.has(rowId)); return data.rows.find((row) => row.rowId === rowId); };
  const validClient = (client) => ensure(['old', 'new'].includes(client));
  return Object.freeze({
    originalValue(rowId) { rowFor(rowId); return originalValues.get(rowId); },
    read(client, rowId) {
      validClient(client); const row = rowFor(rowId);
      // Different executable read paths, not precomputed observation labels.
      const value = client === 'old' ? (sourcePresent ? row.values[sourceColumn] : row.values[targetColumn]) :
        (targetPresent && row.values[targetColumn] !== null ? row.values[targetColumn] : sourcePresent ? row.values[sourceColumn] : null);
      return { value, revision: revisions.get(rowId) };
    },
    write(client, rowId, value, expectedRevision, commandId) {
      validClient(client); const row = rowFor(rowId);
      ensure(cell(value) && Number.isSafeInteger(expectedRevision) && expectedRevision >= 0 && name(commandId));
      const requestDigest = sha256(jcs({ client, rowId, value, expectedRevision, commandId }));
      if (commands.has(commandId)) {
        const prior = commands.get(commandId);
        return prior.requestDigest === requestDigest ? { status: 'replay-noop', revision: prior.revision } : { status: 'rejected-key-conflict', revision: revisions.get(rowId) };
      }
      const current = revisions.get(rowId);
      if (current !== expectedRevision) return { status: 'rejected-stale-revision', revision: current };
      ensure(current < Number.MAX_SAFE_INTEGER && commands.size < 256);
      // The selected shim mirrors writes to every present representation.
      if (sourcePresent) row.values[sourceColumn] = value;
      if (targetPresent) row.values[targetColumn] = value;
      revisions.set(rowId, current + 1); commands.set(commandId, { requestDigest, revision: current + 1 });
      return { status: 'committed', revision: current + 1 };
    },
    snapshot() { return jcs(data); },
  });
}
