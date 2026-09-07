# Exact policy-selection source binding

Increment 0170 adds a development source format, not a governance amendment or an
approval. Optional `heldBrief.policy.selection` pins one manifest path and SHA-256
digest alongside the complete configured gate chain. The file is read at the exact
current source revision of the assessment; it never replaces startup configuration.

The compact JSON document has version `steer-gate-policy-selection/v1`, the exact
`organizationId`, `repository` and `branch`, and `configuration: { gates: [...] }`.
Its complete parsed gates must match startup configuration: signer identities,
historical authorization revisions, trust/proof selections, policy and Critic refs,
domain evidence sets and any runner/history/ancestry selections. Array order matters.
The document excludes `selection` itself to avoid a self-referential digest.

The exported `gitGatePolicySelectionDocumentSchema` in the policy adapter defines
the format. Serialize a schema-validated document with `JSON.stringify` for compact
JSON; duplicate keys, alternate whitespace encodings and unknown fields are rejected.
Do not publish a real manifest or choose trusted pins without the existing authority
process. Only synthetic test manifests have been created by this increment.

## Observation and limits

The collector checks current observer identity and current branch head before/after
reading the manifest, then retains its existing evidence-chain and final checks.
Scope/path/revision, exact bytes, SHA-256 and native Git blob identity must all agree.
A missing or invalid configured manifest fails the assessment; it never falls back
to a previous revision or adopts the manifest's configuration as authority.

| Returned fingerprint | Meaning |
| --- | --- |
| `contentDigest` | SHA-256 of the exact manifest bytes, matching the configured pin |
| `blobSha` | Native Git blob identity for those bytes |
| `configurationDigest` | SHA-256 of the complete parsed `{ gates }` configuration |

Only these fingerprints and path/revision reach `selectionSource` in held diagnostics,
not the manifest contents. Without the optional reference, `selectionSource` is null.
The source/configuration match does not verify who approved the selection, authorize
reviewer/attestor keys, establish actual runner isolation or verify review conclusions.
It does not bind or approve the authoring destination inventory. Writer scope/platform/
decision pins are checked separately, and full write authority remains unavailable.

Manifest/configuration size is bounded to 512 KiB; retained manifest bytes count
toward the collector's existing 8 MiB aggregate. A manifest cannot alias another
selected file role, the current human grant file or an authoring target. The same
single-flight, 15-second deadline, monotonic-clock, current observer/expiry and
draining-shutdown boundaries apply; timeout does not permit a new overlapping read.

`governedSelectionVerificationRequired`, review-provenance and current-source
requirements stay true. Held diagnostics and every gate/write flag remain false
for authority. No live profile, manifest, provider grant, API action, UI, signature,
deployment or spending is enabled. All five R5 findings remain open. See
`intent/0170/EVIDENCE.md` and `docs/HELD-BRIEF-RUNTIME.md`.

## Optional selected-key evidence — 0186

`selection.attestation` can additionally specify `trust: { path, digest }`,
`proof: { path, digest }`, `selectorSubject`, `selectionId` and `selectedAt` for
the two-gate save-policy chain. Both files are read at the same current source
revision after the manifest, before gate sources. Each role must be disjoint from
the manifest, other configured source roles, membership records and save targets.
Raw source bytes, SHA-256, native Git blob and current observer/head must agree.

The internal `verifyGateSelectionAttestation` contract uses Ed25519 with the domain
`steer-gate-selection-attestation/v1` followed by a NUL byte. Its closed trust,
payload and envelope schemas are in `packages/adapters/src/identity/gate-selection-proof.ts`.
Both trust and proof digests are independently pinned, and payload bytes use
schema-ordered compact JSON. This is not general JSON canonicalization.

Signed claims bind the exact organization/repository/branch, selector, record item,
platform revision, decision digest, manifest path/digest, complete configuration
digest and selection event/time. The signed manifest digest is content-addressed;
the envelope does not claim its own containing commit, avoiding a Git hash cycle.
Later commits can retain identical manifest/proof bytes, but the collector must
still verify their current source and key state. Proof expiry is finite and no later
than key expiry; current key revocation can shorten it. Expiry is rechecked after
the complete policy collection before an observation can return.

An immutable `selectionAttestation` appears only in the internal collector result;
it is null without this profile. Held runtime diagnostics still expose only the
bounded manifest fingerprints, not the attestation's actor claims. No valid proof
can unlock the held writer: trust bootstrap, actual selector authorization, review
authenticity and action-time authority remain separate unresolved requirements.
This optional development format is not a mandate to replace commercial provider
records or obtain another human signature. No live attestor or trust pin is installed.
Verification and limitations: `intent/0186/EVIDENCE.md`.

## Optional historical/current selector grants — 0187

`selection.attestation.authorization` accepts `path`, `issuer`, `type`,
`historicalRevision` and `historicalDigest`. Identity-aware trust/receipts additionally
bind `selectorIssuer` and `selectorType`; the signed receipt and independent expected
facts also bind `selectorAuthorizationPath`, `selectorAuthorizationRevision` and
`selectorAuthorizationDigest`. The complete identity/history set is atomic. Old
subject-only receipts remain readable without this profile but cannot satisfy it.
Historical grant coordinates are known before the receipt is created, so they do
not introduce a self-referential Git commit or unsigned history substitution.

The collector reads the pinned historical authorization document and separately
reads the same path at the current assessment revision. Each read checks exact
scope/path/revision, bytes, SHA-256, blob identity, observer authority and current
head. No current grant digest is borrowed from history or used as a stale fallback.
The path cannot alias the manifest, trust/proof, existing selected sources, human
membership or save destinations. No live path or grant is installed here.

Both documents use the existing `steer-authorization/v1` format. An exact active
issuer/subject/type/organization record must contain `gate.policy.select` at the
selection instant and now. Duplicate identities, cross-tenant rows, missing or
inactive records and adjacent grants deny. Agents must have no human hats; a human
hat alone grants nothing. This internal capability is not a registered tool or gate
signature. Explicit bootstrap configuration still determines any intended selector.

The collector retains immutable `selectorAuthorization` with historical/current
source fingerprints and grant-binding evidence. The current grant's exclusive
expiry also bounds the final result after all later policy reads. Historical expiry
only bounds the historical event; a later current renewal is independently checked.
Without the optional authorization profile this property is null.

Source-backed grant matching does not authenticate the selector's actual login or
approve ownership of the trust/grant sources. Selector identity and bootstrap
verification requirements stay explicit. Held diagnostics do not expose these new
claims; all three held-authority gaps and every gate/write flag remain unchanged.
Exact verification and the corrected test-clock fixture: `intent/0187/EVIDENCE.md`.

## Optional selector session evidence — 0188

`selection.attestation.authorization.identity` adds `trust: { path, digest }`,
`proof: { path, digest }`, `sessionId` and `authenticatedAt`. The selection receipt
and independent expected facts bind all four new fields atomically:
`selectorSessionId`, `selectorAuthenticatedAt`, `selectorIdentityDigest` and
`selectorIdentityTrustDigest`. An identity-bound receipt cannot be downgraded to
grant-only configuration; legacy profiles still produce no selector identity evidence.

The separate `steer-selector-identity-attestation/v1` NUL-terminated signature domain
accepts an explicit human or agent session without changing human gate-signing rules.
Trust is scoped to organization/repository/branch/identity issuer. Exact subject,
kind, session and authentication time must match selection; both trust and proof
digests are independently pinned and signed by the selection receipt. Closed compact
UTF-8 bytes, nanosecond chronology and current identity-key validity are mandatory.
The historical session covers selection, but need not still be logged in today.

Identity trust/proof are independently read at the current assessment revision,
after selection and historical/current grant checks. All source integrity, observer,
head, deadline and role-isolation requirements apply. Identity-key expiry or scheduled
revocation is rechecked after later policy reads. Immutable `selectorIdentity` stays
internal and is null without this profile; held diagnostics do not expose sessions.

This verifies selected-key session claims, not approved ownership of the attestor,
real identity-service issuance, review provenance or full action-time authority.
The held writer remains closed with all three gaps even when every optional selector
proof passes. No live identity profile, keys, grant or provider call is installed.
The native Git and held HTTP integration evidence is in `intent/0188/EVIDENCE.md`.
