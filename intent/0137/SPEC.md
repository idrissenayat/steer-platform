# Spec

## Identity assertion verification

Implement an internal `verifyGateIdentityAttestation` primitive and compose it
through the existing exported Git provider proof reader. The identity-service
trust record (`steer-gate-identity-trust/v1`) pins organization, repository,
identity issuer, attestor HTTPS identity, key ID, raw Ed25519 public key, activation,
expiry and optional revocation. Selecting/authorizing that trust root is outside
this module; a key found in Git is not an authorized identity authority.

The `steer-gate-identity-proof/v1` envelope contains the exact serialized
`steer-gate-identity-attestation/v1` payload and a canonical 64-byte Ed25519
signature. Payload binds organization, repository, identity issuer, attestor,
key ID, human subject, opaque non-credential session ID, authentication time,
authentication expiry and recorded time. Unknown fields, including token fields,
are rejected. This is identity metadata, not anonymous or content-free telemetry;
its eventual storage/retention remains governed. No access/ID token, cookie,
password or signing key is issued, fetched or persisted by this implementation.

Sign UTF-8 `steer-gate-identity-attestation/v1` followed by a NUL and the payload
bytes. This is domain-separated Ed25519, not Ed25519ctx or RFC 8785/JCS. Require
schema-ordered compact JSON, valid UTF-8, bounded 16 KiB payload and canonical
base64. Verify the entire envelope digest against the signed gate provider record.
Expected issuer comes from trusted authorization configuration; subject, session,
authentication/signing instants and provider recording time come from the actual
verified gate-provider proof, never request-supplied identity assertions.

Use exact nanosecond UTC chronology. Authentication and receipt recording must
fall within the asserted authentication window; signing must be before its
exclusive expiry. Authentication precedes both signing and receipt recording.
Receipt recording and signing cannot follow the gate provider's recording time,
which cannot be in the future. The identity key must be active by authentication,
remain valid at receipt recording and current evaluation, and not be currently
revoked. An authentication session that naturally expires after signing need not
still be live at historical evidence evaluation. No archival key-expiry exception
or interpretation of token `iat` as a fresh human authentication is introduced.

## Git composition and ownership

`createGitProviderProofReader(...).verifySignerIdentity(...)` requires explicit
`signerAuthorization` plus `signerIdentity` configuration. Identity configuration
contains a pinned trust path/digest and a bounded identity-proof path allowlist.
Input adds only an allowlisted identity-proof path to the existing exact-head,
historical authorization revision and expected governed gate facts. Reject all
trust/proof/authorization path collisions and caller-selected additional sources.

Read both identity sources at the same exact current Git head as the gate proof,
with SHA-256, Git blob hash, UTF-8, coordinates and 16 KiB trust/64 KiB proof bounds.
Verify the two genuine signatures and both actual authorization sources. Preserve
final head/agent-scope checks, monotonic 15-second real/logical deadline, shared
single-flight ownership and draining shutdown. Recheck current grants and both
trust windows at the completion clock so cryptographic work cannot carry evidence
past expiry or revocation.

Return a dedicated frozen `signerIdentity` child observation with exact source
references and verified attestation. Older provider-only and hat-only methods
retain their shapes and conservative requirement flags; a consumer must explicitly
require the identity child, not treat a hat-only observation as verified identity.
Inner standalone source/qualification-required flags remain conservative. No
observation satisfies `BriefWriteAuthority`; gateVerified/writeAuthorized stay false.

## Remaining authority boundaries

This verifies an authorized attestor's signed assertion under supplied trust, not
an independently fetched native IdP authentication event. Approved attestor binding,
actual receipt issuance from verified authentication, historical identity linkage
for existing provider-recorded approvals, specialist qualification, prerequisites,
Critic/domain evidence, full policy/source composition and exact human decisions
remain due. There is no new real identity trust root, receipt issuer, API endpoint,
runtime profile or writer selection. Existing commercial approvals are unchanged.
