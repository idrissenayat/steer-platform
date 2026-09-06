// Explicit non-erasure schema; no frozen schema or approval is rewritten.
import { schemaRegistry, bundleSchema, compileOffline } from '../0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const registry = schemaRegistry(), name = 'HUMAN-AUTHORITY.schema.json', schema = registry.get(name);
const sourceDigest = sha256(jcs(bundleSchema(name, registry)));
const removed = ['copyInventoryDigest', 'referenceState', 'allowedCopyProviders', 'sourceOriginalExcluded', 'deadlineSeconds', 'eraseMethod', 'terminalEventId'];
for (const field of removed) delete schema.properties[field];
schema.required = schema.required.filter((field) => !removed.includes(field));
schema.$id = 'https://steer.invalid/schemas/qualified-lifecycle-decision-0082';
schema.properties.version = { const: 'steer-qualified-lifecycle-decision/v1' };
schema.properties.authorityType = { const: 'qualified-lifecycle-decision' };
schema.properties.holdState = { enum: ['none', 'active', 'released'] };
Object.assign(schema.properties, { selectorInventoryDigest: { $ref: '#/$defs/sha256' }, eventId: { $ref: '#/$defs/id' },
  eventBindingDigest: { $ref: '#/$defs/sha256' }, decisionKind: { enum: ['hold-applied', 'hold-released'] },
  previousHoldEventDigest: { anyOf: [{ type: 'null' }, { $ref: '#/$defs/sha256' }] } });
schema.required.push('selectorInventoryDigest', 'eventId', 'eventBindingDigest', 'decisionKind', 'previousHoldEventDigest');
schema.allOf = [
  { if: { properties: { decisionKind: { const: 'hold-applied' } } }, then: { properties: { previousHoldEventDigest: { type: 'null' } } } },
  { if: { properties: { decisionKind: { const: 'hold-released' } } }, then: { properties: { holdState: { const: 'active' }, previousHoldEventDigest: { $ref: '#/$defs/sha256' } } } },
];
schema.$defs.time.pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{9})?Z$/.source;
const timeFields = Object.entries(schema.properties).filter(([, value]) => value.$ref === '#/$defs/time').map(([field]) => field);
export const schemaBytes = jcs(bundleSchema(name, registry));
export const schemaPolicyDigest = sha256(jcs({ version: 'steer-qualified-decision-schema/v1', sourceDigest, schemaDigest: sha256(schemaBytes), timePolicyDigest,
  removed, rules: 'non-erasure qualified hold decisions; exact event/selector/predecessor binding; active hold permitted; no disposition/raw grant fields; original six exact human times retained' }));
const validate = compileOffline(name, registry);
export function validateQualifiedDecision(value) {
  const errors = validate(value);
  for (const field of timeFields) if (exactInstant(value?.[field]) === null) errors.push(`/${field}/exact-time`);
  return errors;
}
