// Exact non-erasure reference decision profile; no frozen source is changed.
import { schemaRegistry, bundleSchema, compileOffline } from '../0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const registry = schemaRegistry(), name = 'HUMAN-AUTHORITY.schema.json', schema = registry.get(name);
const sourceDigest = sha256(jcs(bundleSchema(name, registry)));
const removed = ['copyInventoryDigest', 'allowedCopyProviders', 'sourceOriginalExcluded', 'deadlineSeconds', 'eraseMethod', 'terminalEventId'];
for (const field of removed) delete schema.properties[field];
schema.required = schema.required.filter((field) => !removed.includes(field));
schema.$id = 'https://steer.invalid/schemas/qualified-reference-decision-0085';
schema.properties.version = { const: 'steer-qualified-reference-decision/v1' };
schema.properties.authorityType = { const: 'qualified-reference-decision' };
schema.properties.holdState = { enum: ['none', 'active', 'released'] };
schema.properties.referenceState = { enum: ['active', 'cleared'] };
Object.assign(schema.properties, { selectorInventoryDigest: { $ref: '#/$defs/sha256' }, eventId: { $ref: '#/$defs/id' },
  eventBindingDigest: { $ref: '#/$defs/sha256' }, decisionKind: { const: 'reference-revocation-authorized' },
  referenceInventoryDigest: { $ref: '#/$defs/sha256' }, verificationBundleDigest: { $ref: '#/$defs/sha256' },
  tombstoneRecordId: { type: 'string', minLength: 1, maxLength: 512, pattern: /^[^\u0000-\u001f*?]+$/.source } });
schema.required.push('selectorInventoryDigest', 'eventId', 'eventBindingDigest', 'decisionKind', 'referenceInventoryDigest', 'verificationBundleDigest', 'tombstoneRecordId');
schema.$defs.time.pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{9})?Z$/.source;
const timeFields = Object.entries(schema.properties).filter(([, value]) => value.$ref === '#/$defs/time').map(([field]) => field);
export const schemaBytes = jcs(bundleSchema(name, registry));
export const schemaPolicyDigest = sha256(jcs({ version: 'steer-reference-decision-schema/v1', sourceDigest, schemaDigest: sha256(schemaBytes), timePolicyDigest,
  removed, rules: 'non-erasure qualified reference decision; event selector reference-inventory verification-bundle and tombstone identity bound; truthful holds/references; no hold predecessor or erase fields; exact six human times' }));
const validate = compileOffline(name, registry);
export function validateReferenceDecision(value) {
  const errors = validate(value);
  for (const field of timeFields) if (exactInstant(value?.[field]) === null) errors.push(`/${field}/exact-time`);
  return errors;
}
