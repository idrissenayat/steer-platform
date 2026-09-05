// Explicit in-memory successors. Frozen source files and signed bytes are untouched.
import { schemaRegistry, bundleSchema, compileOffline } from '../0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const registry = schemaRegistry();
const names = ['HUMAN-AUTHORITY.schema.json', 'LIFECYCLE-EVENT.schema.json', 'RAW-POLICY-GRANT.schema.json'];
const sourceDigests = names.map((name) => ({ name, digest: sha256(jcs(bundleSchema(name, registry))) }));
const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{9})?Z$/.source;
registry.get('HUMAN-AUTHORITY.schema.json').$defs.time.pattern = pattern;
registry.get('LIFECYCLE-EVENT.schema.json').properties.occurredAt.pattern = pattern;
for (const name of names) registry.get(name).$id = `https://steer.invalid/schemas/precision-0070-${name}`;
export const schemaPolicyDigest = sha256(jcs({ version: 'steer-lifecycle-precision-schema/v1', timePolicyDigest, sourceDigests,
  successorDigests: names.map((name) => ({ name, digest: sha256(jcs(bundleSchema(name, registry))) })),
  changes: 'human time definition and event occurredAt grammar; exactInstant validation for every declared human time and event occurredAt; all other schema rules retained' }));
const humanTimeFields = Object.entries(registry.get('HUMAN-AUTHORITY.schema.json').properties).filter(([, definition]) => definition.$ref === '#/$defs/time').map(([field]) => field);
if (humanTimeFields.length !== 6) throw new Error('PRECISION_SCHEMA_INVALID');
const compiled = new Map(names.map((name) => {
  const shape = compileOffline(name, registry);
  return [name, (value) => {
    const errors = shape(value), record = name === 'RAW-POLICY-GRANT.schema.json' ? value?.authority : value;
    for (const field of name === 'LIFECYCLE-EVENT.schema.json' ? ['occurredAt'] : humanTimeFields)
      if (exactInstant(record?.[field]) === null) errors.push(`/${field}/exact-time`);
    return errors;
  }];
}));
export function compilePreciseSchema(name) {
  if (!compiled.has(name)) throw new Error('PRECISION_SCHEMA_INVALID');
  return compiled.get(name);
}
