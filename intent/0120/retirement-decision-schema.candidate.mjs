// Separate non-erasure decision schema; existing profiles and frozen source stay intact.
import { schemaRegistry, bundleSchema, compileOffline } from '../0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const registry = schemaRegistry(), name = 'HUMAN-AUTHORITY.schema.json', schema = registry.get(name);
const sourceDigest = sha256(jcs(bundleSchema(name, registry)));
const removed = ['copyInventoryDigest', 'referenceState', 'allowedCopyProviders', 'sourceOriginalExcluded', 'deadlineSeconds', 'eraseMethod', 'terminalEventId'];
for (const field of removed) delete schema.properties[field];
schema.required = schema.required.filter(field => !removed.includes(field));
schema.$id = 'https://steer.invalid/schemas/qualified-retirement-decision-0120';
schema.properties.version = { const: 'steer-qualified-retirement-decision/v1' };
schema.properties.authorityType = { const: 'qualified-retirement-decision' };
schema.properties.holdState = { enum: ['none', 'active', 'released'] };
const selector = { type: 'string', minLength: 1, maxLength: 512, pattern: /^[^\u0000-\u001f*?]+$/.source };
Object.assign(schema.properties, { selectorInventoryDigest: { $ref: '#/$defs/sha256' }, eventId: { $ref: '#/$defs/id' }, eventBindingDigest: { $ref: '#/$defs/sha256' },
  decisionKind: { const: 'corpus-retired' }, previousEventDigest: { anyOf: [{ type: 'null' }, { $ref: '#/$defs/sha256' }] },
  historyHeadDigest: { $ref: '#/$defs/sha256' }, corpusId: { ...selector }, corpusVersion: { ...selector } });
schema.required.push('selectorInventoryDigest', 'eventId', 'eventBindingDigest', 'decisionKind', 'previousEventDigest', 'historyHeadDigest', 'corpusId', 'corpusVersion');
schema.$defs.time.pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{9})?Z$/.source;
const timeFields = Object.entries(schema.properties).filter(([, value]) => value.$ref === '#/$defs/time').map(([field]) => field);
export const schemaBytes = jcs(bundleSchema(name, registry));
export const schemaPolicyDigest = sha256(jcs({ version: 'steer-retirement-decision-schema/v1', sourceDigest, schemaDigest: sha256(schemaBytes), timePolicyDigest, removed,
  rules: 'non-erasure qualified corpus retirement only; exact corpus/event/selector/previous-event/history-head binding; truthful holds; no deletion fields or hold/reference schema substitution' }));
const validate = compileOffline(name, registry);
export function validateRetirementDecision(value) {
  const errors = validate(value);
  for (const field of timeFields) if (exactInstant(value?.[field]) === null) errors.push(`/${field}/exact-time`);
  return errors;
}
