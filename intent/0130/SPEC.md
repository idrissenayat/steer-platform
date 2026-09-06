# Development specification

## Contract and trust boundary

`verifyGateProviderAttestation(envelope, trust, expected, evaluatedAt)` is an
internal read-only adapter export. All input is strictly validated; failure returns
null without provider details, logging or fallback. It has no fetch, persistence,
signing, key-generation or runtime-configuration behavior.

The trusted composition must independently select and verify the current trust
snapshot, expected facts and evaluation clock. They are not HTTP/MCP request
parameters. A signature validates a provider's assertion under the supplied key;
it does not establish that the supplied key is authorized or currently deployed.
No trust snapshot, private/public production key or provider binding is installed.

Trust binds one organization/repository, provider, HTTPS issuer, key ID, raw
32-byte Ed25519 public key, activation, expiry and optional revocation. No JWK URL,
algorithm substitution, arbitrary key service or key-discovery fallback exists.

Expected facts bind organization/repository/item/gate, exact artifact revision and
decision-record SHA-256, subject, hat, sequence, session ID, authentication/signing
timestamps, provider observation ID, identity/authorization evidence digests and
decision. Every field must equal the signed payload, including timestamp lexemes.
Referenced identity/authorization evidence is bound, not independently verified
by this primitive. Hat claims are not qualification proof.

## Wire profile for the internal primitive

Envelope version: `steer-gate-provider-proof/v1`; fields are `version`, `payload`
and canonical padded Base64 encoding of the 64-byte signature.

Payload version: `steer-gate-provider-attestation/v1`. Field order is `version`,
`provider`, `issuer`, `keyId`, the expected fields in schema order, literal human
`type`, and provider `recordedAt`. The exact compact JSON from strict schema order
must match the payload bytes. This is a named schema-ordered encoding, not an
RFC 8785/JCS implementation. Duplicate/unknown keys, reordered or pretty JSON,
non-round-tripping UTF-8 and payloads over 16 KiB are rejected.

Ed25519 verifies the literal UTF-8 prefix
`steer-gate-provider-attestation/v1` followed by one NUL byte and the exact payload
bytes. This external message prefix separates the protocol; it is not a claim to
implement Ed25519ctx. Verification signs no local data and uses no private key.

The decision-record digest identifies a separate source record referencing the
provider observation; proof bytes live separately to avoid a self-hashing record.
No canonical record is rewritten into this representation by the implementation.

## Time and output

All comparisons use 0129's exact UTC integer parser. Authentication must be no
later than signing, signing no later than provider recording, and recording no
later than evaluation. The key must be active at recording and evaluation, with
half-open expiry and revocation effective at equality. A provider can attest an
earlier human event; this alone does not prove the historical human session.
Expired/revoked keys fail even for earlier recordings: no archival trust profile
or signed-log continuity exception is implemented here.

Success returns frozen copied claims, provider/key identity, payload/proof/trust
digests and explicit evaluation time. It always returns:

- `currentSourceVerificationRequired: true`
- `qualificationVerificationRequired: true`
- `gateVerified: false`
- `writeAuthorized: false`

It fails `BriefWriteAuthority`. An authentic provider observation of send-back can
verify cryptographically but cannot become approval. No trust freshness lease,
source read, policy satisfaction, independent Critic evidence or human second-look
verification follows from these flags.

## Existing approval compatibility

The signed commercial choice remains provider-recorded approvals; the existing
canonical Gate 1 names `openai-codex`. Its plain provider/session metadata is not
this signed envelope, and deliberately returns null here. This primitive does
not replace that provider, fabricate a signature for it, require a user to repeat
Gate 1, or claim to implement the regulated signed log. Actual provider retrieval,
trusted proof/trust-source binding, historical compatibility and the full policy,
qualified-hat and request-bound writer composition remain unfinished.
