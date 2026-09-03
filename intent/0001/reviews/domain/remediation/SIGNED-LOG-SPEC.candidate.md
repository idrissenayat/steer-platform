# Proposed regulated cryptographically signed log specification v1

Status: **unsigned candidate; qualified-human legal determination required**

This specification defines the technical minimum for the Gate 1 requirement
that a cryptographically signed log exist before any regulated pilot. It does
not determine that the mechanism satisfies a law, regulation, contract, agency
policy, DCAA requirement, or FedRAMP control.

## Canonical event and non-circular preimages

The **base event** contains exactly: `logVersion`, `organization`,
`repositoryBinding`, `item`, `recordType`, `recordPath`, `recordDigest`,
`artifactRevision`, `sequence`, `decision`, `serverTimestamp`, `timestampSource`,
`verifiedSubject`, `activeHat`, `identityIssuer`, `identityEvidenceRef`,
`sessionId`, `authorizationPolicyRevision`, `providerProofType`,
`providerRecordId`, `previousEventDigest`, and `signingKeyId`. It contains
neither `eventDigest` nor `signature`.

1. `baseBytes = RFC8785(baseEvent)` encoded as UTF-8.
2. `eventDigest = lowercase-hex(SHA-256(baseBytes))`.
3. The **signed event** is the base event plus `eventDigest`, and contains no
   `signature` member.
4. `signedBytes = RFC8785(signedEvent)` encoded as UTF-8.
5. `signature = base64url-no-padding(Ed25519-Sign(privateKey, signedBytes))`.
6. The **stored event** is the signed event plus `signature`. Verification
   reconstructs both preimages, recomputes `eventDigest`, and then verifies the
   signature over `signedBytes`. Unknown or extra members fail schema validation.

Validation stops at the first failure in this single order; later checks do not
replace the emitted stable code:

1. Parse with duplicate-member rejection and validate exact members/types:
   `EVENT_SCHEMA_INVALID`.
2. Compare caller organization/repository/item context with stored bindings:
   `CONTEXT_BINDING_MISMATCH`.
3. Require lowercase 64-hex digests and canonical unpadded base64url whose
   decode is exactly 64 bytes and whose re-encode is byte-equal:
   `SIGNATURE_ENCODING_INVALID`.
4. Resolve `signingKeyId` and its organization/repository binding:
   `SIGNING_KEY_UNKNOWN` or `SIGNING_KEY_INACTIVE`.
5. Require supplied `baseBytes`, when a conformance vector supplies them, to be
   byte-equal to `RFC8785(baseEvent)`: `CANONICALIZATION_MISMATCH`.
6. Recompute and compare `eventDigest`: `EVENT_DIGEST_MISMATCH`.
7. Verify Ed25519 over reconstructed `signedBytes`: `SIGNATURE_INVALID`.
8. Validate sequence/hash-chain, time, identity, authorization, and durable
   provider proof in that order, using respectively `CHAIN_INVALID`,
   `TIME_INVALID`, `IDENTITY_INVALID`, `AUTHORIZATION_INVALID`, and
   `PROVIDER_PROOF_INVALID`.

## Algorithm and keys

- Signatures use Ed25519. Verification rejects any other algorithm or curve.
- Signing keys are non-exportable keys in an approved HSM/KMS binding. The
  binding, hardware/security validation, region, operator roles, and access
  policy are frozen in the release manifest.
- The service identity may request a signature but cannot export a private key,
  change policy, rotate a key, or erase a public verification record.
- Public keys, activation/retirement instants, revocations, compromise records,
  and cross-signatures are retained with the log. A key signs only in its
  half-open activation interval `[activeFrom, retiredAt)` and revocation is
  fail-closed from the authoritative revocation instant.

## Ordering, time, and authoritative binding

- Each organization/repository log is a gapless positive sequence and hash
  chain. The first event binds a declared genesis digest.
- The timestamp is issued by the server after authorization and before the
  authoritative code-host write. A durable provider record ID and the exact
  authoritative record digest bind the log event to that write.
- A timestamp source must be authenticated, monitored UTC with maximum absolute
  offset 50 ms in the reference environment. Offset breach blocks signing.
- A provider timeout or conflict creates a signed non-approval attempt event;
  it never creates a decision event until reconciliation proves the unique
  durable authoritative result.

## Verification and export

An independent verifier starts from retained public keys and genesis, validates
canonical bytes, digests, signatures, key validity, revocations, sequence,
timestamps, provider record IDs, record bytes, repository binding, and the
complete hash chain. Export contains events, public keys, rotation/revocation
records, provider-proof references and retained verification evidence. Export
must verify without an active application session or mutable database projection.

## Required negative tests

Reject wrong algorithm/key, unknown or retired key, post-revocation signature,
altered bytes, reordered/duplicated/skipped event, truncated prefix or suffix,
forked predecessor, replay in another organization/repository/item, stale
artifact revision, provider-record mismatch, future/backdated timestamp,
unverified or disabled subject, inactive hat, and missing identity evidence.
Crash, timeout, and retry at each pre-sign, sign, provider-write, acknowledgement,
projection, and export boundary must yield either one verifiable decision event
bound to one authoritative result or an explicit non-approval attempt record.

## Fixed conformance vectors

The authoritative machine-readable vectors are
`intent/0001/reviews/domain/remediation/SIGNED-LOG-VECTORS.candidate.json`,
SHA-256 `1a03cdc28b353036ff612f1d8c93bd3f832e3b1adbc7f77a29a13dbc47a7a168`.
Its `changedPaths` and `unchangedPaths` arrays exhaustively partition every
positive-vector stored-event member, `baseBytes`, and caller-context member;
added and removed paths appear only in `changedPaths`. The mutation algorithm
and validation precedence in that file are normative. Any omitted, duplicate,
or incorrectly classified path fails conformance.

Vector `SLV1-POS-001` uses the public RFC 8032 test key material below solely for
conformance; it is prohibited in every non-test environment.

- Ed25519 seed:
  `9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60`
- Ed25519 public key:
  `d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a`
- `baseBytes` UTF-8 text:
  `{"activeHat":"tech-lead","artifactRevision":"118302e080598a147294e32d40cf5296763c8cc4","authorizationPolicyRevision":"kit/policy/gates.json@68f53ae5845445758eb7cb8a1a8518f31c37120cfe92373b6bf0f8dfed404b56","decision":"approved","identityEvidenceRef":"evidence://identity/0001","identityIssuer":"https://idp.test.steer.invalid/realms/steer","item":"0001-flight-deck-foundation","logVersion":"1","organization":"steer-platform","previousEventDigest":"0000000000000000000000000000000000000000000000000000000000000000","providerProofType":"github-commit","providerRecordId":"github:commit:test-0001","recordDigest":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","recordPath":"intent/0001/signatures/gate-2.json","recordType":"gate-decision","repositoryBinding":"github:repo-id:0001","sequence":1,"serverTimestamp":"2026-09-03T18:00:00.000Z","sessionId":"session-test-0001","signingKeyId":"rfc8032-test-key-1","timestampSource":"steer-test-clock-v1","verifiedSubject":"oidc:test:human-1"}`
- expected `eventDigest`:
  `de865407d15346dfbfdc2a6dfc7025d2f261481ba006ff24618d3222d4b64839`
- expected `signature`:
  `QU06HlnIKsWxyEk2N1YsuSWgHYKocaxMqmCpXZTZOHRdhSQVLTvUxXjYHOmOuOn_lQG_Wx1hEEqAHli-KjSuBw`
- expected result: `VALID`.

The following fixed negatives derive from `SLV1-POS-001`. Only paths in that
vector's machine-readable `changedPaths` change; every path in its exhaustive
`unchangedPaths` array remains byte-equal to the positive fixture. Each returns
the named first stable code and creates no authoritative decision or projection:

| Vector | Mutation | Expected code |
|---|---|---|
| `SLV1-NEG-001` | set stored `decision` to `declined`; regenerate supplied `baseBytes` as RFC 8785 of that mutated base event; retain the positive `eventDigest` and `signature`; no other path changes | `EVENT_DIGEST_MISMATCH` |
| `SLV1-NEG-002` | replace final digest hex digit `9` with `8`, retain signature | `EVENT_DIGEST_MISMATCH` |
| `SLV1-NEG-003` | replace first signature character `Q` with `A`; decoded byte 0 changes from `0x41` to `0x01` | `SIGNATURE_INVALID` |
| `SLV1-NEG-004` | add member `unexpected=true` | `EVENT_SCHEMA_INVALID` |
| `SLV1-NEG-005` | remove `providerRecordId` | `EVENT_SCHEMA_INVALID` |
| `SLV1-NEG-006` | use public key ID `unknown-key` | `SIGNING_KEY_UNKNOWN` |
| `SLV1-NEG-007` | prepend one UTF-8 space to `baseBytes` | `CANONICALIZATION_MISMATCH` |
| `SLV1-NEG-008` | replay stored event under repository `github:repo-id:0002` | `CONTEXT_BINDING_MISMATCH` |

Conformance recomputes the vector from the literal `baseBytes`, asserts its
SHA-256 and signature, executes the declared mutation steps, verifies every
changed/unchanged path, and runs all eight negatives in the declared first-error
precedence. Omission is failure. The bounded review harness is
`intent/0001/reviews/domain/remediation/validate-remediation.mjs`; it is review
tooling, not product implementation, product conformance, or authorization.

## Retention dependency

Signed events, public verification material, revocation/rotation history, and
provider proofs follow the signed records policy. For any future regulated
activation, no regulated technical release or pilot activation may proceed while
that policy or the qualified legal determination is absent, expired, stale, or
not bound to the exact Exam and implementation revisions. This requirement is
evaluated after implementation evidence exists; it does not trigger HR-02 for
the current commercial Gate 2.
