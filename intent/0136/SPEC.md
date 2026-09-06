# Spec

## Explicit source-backed signer mode

Extend the existing Git provider proof reader with `verifySigner`, requiring a
trusted configured authorization path and identity issuer plus an exact historical
authorization revision. Reject path collisions with trust/proof sources, unlisted
proof paths, caller-supplied authorization content and incomplete configuration.
The original `verify` remains provider-only and never reports hat verification.

Read the historical authorization document at the selected revision and the current
document at the exact expected current head. Verify organization, repository, path,
revision, SHA-256, Git blob SHA, UTF-8 and the 512 KiB limit for both. The historical
digest must equal the digest inside the cryptographically verified provider claim.
Do not require the current document to retain its old digest: later valid grants
may change bytes, and later revocations must be observed. No stale cache is used.

Parse the existing strict authorization schema. Require organization consistency
and unique issuer/subject records, hats and tool grants. Select the exact configured
identity issuer and attested subject. Require an active human with the attested hat.
Historical validity must include authentication through signing; current validity
must include evaluation. Use exact nanosecond UTC comparison, inclusive valid-after
and exclusive expiry, rejecting invalid, inverted or unsupported-precision windows.
An old grant can have expired since signing if a valid current grant exists.

Both modes share the authenticated agent-only read scope, final source/head/identity
checks, monotonic 15-second deadline, single-flight ownership and draining shutdown.
Return frozen historical/current source references and separate identity-evidence
and specialist-qualification requirements. `gateVerified` and `writeAuthorized`
remain false; the result cannot satisfy the Brief write authority schema.

## Deliberate limits

Matching a source record does not prove the signer's identity/session evidence,
qualified specialist domains, uninterrupted authorization history, historical commit
ancestry, independent Critic or prerequisite/policy satisfaction. A remove/regrant
between snapshots is not reconstructed. This mode conservatively requires current
hat validity; it is not a general retrospective archival-validity ruling.

Trust roots, expected signer facts and historical revision selection must come from
trusted governed source composition, not HTTP input. The identity issuer is a
configured binding distinct from the provider issuer; verifying the associated
identity-evidence digest and issuer/subject/session relationship remains mandatory
before any complete authority claim. Existing provider-recorded commercial approvals
are not converted into signed envelopes, and no cryptographic requirement is added
to those approvals by this increment. No runtime writer or production source is bound.
