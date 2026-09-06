# Specification · development candidate

## Factory and compatibility

`createHumanAuthorityVerifier(trustedRegistryBytes)` in
`intent/0058/human-authority.candidate.mjs` returns policyBytes, policyDigest,
registryDigest and `verify(serializedEnvelope, evaluationTime)`.

The original `correctedHumanAuthorityDecision` export, correctionPolicyBytes and
correctionPolicyDigest stay exact. Its full verification body is shared with the
new factory, not copied into a weaker future path. With the original registry,
the selected policy digest and decision/evidence output match the original;
the new factory additionally reports executionAuthorized=false.

## Trust selection

The registry is a trusted constructor input, never a bundle/envelope field.
The standard bounded registry validator applies. Every original domain/key ID,
algorithm, public key and notBefore/notAfter must remain exact. Successor keys
can be added; original keys can be revoked but not omitted, replaced or extended.
An existing revocation cannot be removed or postponed. The selected policy is the
original policy contract with the exact selected registry digest substituted.
Evidence must bind that policy; old policy pins are not silently migrated.

## Current authority

The caller must provide a valid explicit current evaluationTime. The unsigned
bundle clock must equal it exactly; missing, invalid or conflicting clocks deny.
This factory never rewrites that clock or re-dates signed approvals.

All original schema, target, policy-byte, identity, qualified records-owner hat,
assignment, full human/provider binding, exact inventory, replay/head/reservation
and native/current key checks still run. All nine signed records are required.
Qualification and assignment retain the original observed-as-of-decidedAt basis;
this increment does not invent native timestamps absent from their schema.

Future approval requires fresh valid signed evidence under current trusted keys,
including the exact independently selected human-provider anchor. No historical
fact-only attestation is accepted as an identity, qualification, assignment,
approval, inventory or reservation. Current expiry and revocation are half-open
at exact nanosecond precision. Every response has zero effects and explicitly
no execution authority, including the candidate ALLOW result.

## Scope boundary

The API is a development verifier, not registry provisioning, authentication,
an approval UI, live human signing or permission to delete. Existing 0061/raw
compositions still use the original binding until an explicit successor
composition selects the new factory. Full future lifecycle, reference evidence,
runtime integration and independent/protected review remain required. The seven
future signing roles in tests are synthetic fixtures, not approved infrastructure.

