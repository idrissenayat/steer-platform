// Retained public capability boundary: no private signer or credentials are introduced.
import { sealRecord, verifyRecord, jcs } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
export function trustDomainExecutionHook(required) {
  if (required.family !== 'TRUST-DOMAIN-FORGERY') return null;
  return { executor: 'intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs#sealRecord',
    scope: 'retained public signing API capability boundary on exact declared domains; not cryptanalysis, current-key custody or provider access', run(check) {
      const payload = { attacker: true }, domain = required.coordinate.kind;
      check(jcs({ payload, domain: 'record' }), () => ({ verification: verifyRecord(sealRecord(payload, 'record'), 'record', '2026-09-04T12:00:30Z') }), { verification: null });
      check(jcs({ payload, domain }), () => {
        try { return { record: sealRecord(payload, domain), error: null }; }
        catch (error) { return { error: error.message }; }
      }, { error: `PRIVATE_SIGNING_DOMAIN_UNAVAILABLE:${domain}` });
    } };
}
