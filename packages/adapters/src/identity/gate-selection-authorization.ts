import { z } from 'zod';
import { authorizationDocumentSchema } from './authorization.ts';
import { authorizationRecordSchema } from './oidc.ts';
import { parseUtcInstant } from '@steer/tool-registry/gate-policy';

const instant = z.string().max(30).refine(value => parseUtcInstant(value) !== null);
const expectedSchema = z.strictObject({ organizationId: authorizationRecordSchema.shape.organizationId,
  subject: authorizationRecordSchema.shape.subject, issuer: authorizationRecordSchema.shape.issuer,
  type: authorizationRecordSchema.shape.type, selectedAt: instant });

/** Internal source-verified grant binding, not login/identity evidence or approved
 * ownership of the grant source. No tool, grant mutation or live scope is created.
 * Historical/current documents must be independently read at exact source revisions. */
export function verifySelectionGrantDocuments(historical: unknown, current: unknown, rawExpected: unknown, evaluatedAt: unknown) {
  try {
    const expected = expectedSchema.parse(rawExpected), evaluation = instant.parse(evaluatedAt);
    const selected = parseUtcInstant(expected.selectedAt)!, at = parseUtcInstant(evaluation)!;
    if (selected > at) return null;
    const grant = (raw: unknown, when: bigint) => {
      const document = authorizationDocumentSchema.parse(raw), identities = new Set<string>();
      if (document.organizationId !== expected.organizationId) throw new Error();
      for (const record of document.records) {
        const key = JSON.stringify([record.issuer, record.subject]);
        if (record.organizationId !== document.organizationId || identities.has(key)) throw new Error(); identities.add(key);
      }
      const record = document.records.find(value => value.issuer === expected.issuer && value.subject === expected.subject);
      if (!record || !record.active || record.type !== expected.type || !record.toolGrants.includes('gate.policy.select') ||
        (record.type === 'agent' && record.hats.length)) throw new Error();
      const from = parseUtcInstant(record.validAfter), until = parseUtcInstant(record.expiresAt);
      if (from === null || until === null || from >= until || when < from || when >= until) throw new Error();
      return record;
    };
    grant(historical, selected); const currentGrant = grant(current, at);
    return Object.freeze({ kind: 'verified-selector-grant-binding' as const, ...expected, evaluatedAt: evaluation,
      validBefore: currentGrant.expiresAt, historicalGrantVerified: true as const, currentGrantVerified: true as const,
      selectorIdentityVerificationRequired: true as const, trustBootstrapVerificationRequired: true as const,
      currentSourceVerificationRequired: true as const, gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
