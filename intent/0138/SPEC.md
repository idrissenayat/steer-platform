# Spec

## Qualification assertion

The internal `verifyGateQualificationAttestation` verifies an Ed25519 assertion
from a separately selected qualification authority. The strict trust record
`steer-gate-qualification-trust/v1` binds organization, repository, identity issuer,
attestor, key ID/public key, authorized domains, activation, expiry and revocation.
An issuer authorized for privacy cannot attest money or any other unlisted domain.

The `steer-gate-qualification-attestation/v1` payload binds the same scope/key,
qualification ID, human subject, qualified domains, valid-after, valid-through,
recorded-at and optional revocation. Require nonempty, unique, sorted domains drawn
from the existing seven gate-policy domains. Every asserted domain must be allowed
by the selected authority; every required domain must be covered by the assertion.
Return only the configured required domains as verified policy facts.

The `steer-gate-qualification-proof/v1` envelope uses schema-ordered compact JSON,
canonical base64 and a genuine 64-byte Ed25519 signature over the UTF-8 payload
prefixed by `steer-gate-qualification-attestation/v1` and a NUL. This is not
Ed25519ctx or an RFC 8785/JCS claim. Reject malformed UTF-8, duplicate/unknown fields,
unsupported records and payloads over 16 KiB. Match the exact entire-envelope digest.

Compare UTC instants at nanosecond precision. The record must exist no later than
signing and within its own validity and the signing key's validity. Qualification
must be valid at signing and still valid now, with exclusive expiry. Current key
or qualification revocation denies, even if the original decision predates it.
Natural expiry is not silently treated as archival validity. Invalid or inverted
windows and revocations outside their declared window deny. This is conservative
current-use verification, not an archival or professional-credential ruling.

## Source composition and policy interface

`createGitProviderProofReader(...).verifySpecialist(...)` requires all previous
identity/role configuration plus a trusted `specialistQualification` configuration:
exact trust/proof paths and digests, and required domains. Reject all source-path
collisions, missing identity/role prerequisites and non-specialist gate signers.
The method takes the existing identity-mode input; HTTP callers cannot supply
qualification bytes, evidence pins, required domains or additional source paths.

Read both qualification sources at the same exact current Git head as the gate
and identity sources. Check organization/repository/path/revision, UTF-8, SHA-256,
Git blob SHA and 16 KiB trust/64 KiB proof limits. Trusted selection must bind the
qualification evidence pin and required domains to the governed review. Unlike the
identity digest, this version's qualification pin is not a field in the existing
gate-provider envelope; it must not be inferred from browser input or rewritten
into that signed envelope.

Verify all three real signatures, historical/current human role grants and exact
issuer/subject linkage. All modes share authenticated read scope, final head checks,
15-second real/logical deadline, monotonic clock, single-flight admission and
draining shutdown. Check grants, all key windows and qualification expiry/revocation
again at completion so cryptographic work cannot outlive their validity.

Return a frozen `specialistQualification` child with source references, the verified
assertion and a schema-validated `policySignature`. Its subject, hat, sequence,
session and timestamps come from the verified gate-provider record; qualified
domains come only from the verified qualification. Older modes stay distinct and
conservative requirement flags remain. No result satisfies BriefWriteAuthority,
and gateVerified/writeAuthorized remain false.

## Boundaries

This checks an authorized qualification attestor's recorded assertion; it does not
independently assess professional competence or issue a certification. Trust-root
approval, actual qualification/identity attestor bindings and receipt issuance,
existing commercial provider-record compatibility, all other gate signatures,
prerequisite/Critic/domain/policy source verification and human decisions remain
mandatory. No canonical role policy, user's qualification ruling, gate record,
production profile, provider permission or frontend action changes.
