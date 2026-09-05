# Spec: Pre-terminal raw grant eligibility

## Trusted composition and closed input

`createRawPreterminalVerifier` accepts canonical trusted configuration: version
`steer-raw-preparation-context/v1`, lifecycleConfigDigest, recordId,
artifactRevision and nullable environmentId. Configuration is privately parsed;
its digest is bound into all preparation/grant conditions. The caller cannot
install a registry, clock, state or receipt through the request envelope.

The canonical v1 envelope contains exactly version, policyDigest, configDigest,
preparationBytes, humanBundleBytes and rawGrantBytes. A separate signed terminal
event and explicit trusted evaluationTime are required. Policy identity binds
the human/event/schema/time contracts, trust/provider registries and retention
policy. Limits are 16 KiB configuration, 2 MiB envelope, 64 KiB preparation,
terminal and raw grant, and 1 MiB human bundle; the complete human verifier also
applies its narrower field/envelope limits. Limits measure JavaScript string
length, not encoded network bytes. There is no network route in this increment.

## Preparation and actual terminal

The independently provider-signed preparation contains an exact config pin,
preparation ID, authoritative source, preallocated terminal event ID, complete
ordered inventory, sanitizer/inspector revisions and recordedAt/validThrough.
It must predate the independently verified actual terminal event, whose record,
revision, environment, policy, class and revisions match. All three terminal
outcomes (pass, fail, cancelled) require the same pre-terminal grant.

Each of 1–32 entries contains copyId, copyKind, provider, providerBindingId,
account, objectKey, versionId, keyId and sourceOriginal. Only temporary-working
copies with sourceOriginal false are eligible. Copy IDs are unique and sorted;
physical provider-binding/account/object/version tuples cannot repeat. Provider
and account must match pinned bindings and trust anchors, with keys valid both
when preparation was recorded and at evaluation. No new minimum-copy rule,
live provider completeness guarantee or source-original deletion is introduced.

## Complete human grant and time ordering

Run the full 0058 verifier with all nine supporting signed records, both exact
policy sources and current evaluation time. The precise raw grant must embed the
same authority. Authority conditions bind only preparation record digest,
trusted configuration digest and exact tuple digest. The signed human inventory
contains every prepared tuple digest and binds the preparation. Providers,
sanitizer/inspector, cryptographic erase, 60-second deadline, source-original
exclusion, clear hold/reference declarations and exact safeguards must match.

Preparation precedes terminal. Preparation <= human inventory <= decidedAt <
terminal. Identity, complete provider proof, replay/head snapshots and CAS
reservation must satisfy the full human verifier, with enrollment proof,
snapshots and reservation strictly before terminal. Reservation cannot predate
the decision. Earlier validFrom is not a substitute for earlier decidedAt.
The enrollment replay snapshot must report unused; it is not current batch
consumption evidence. Exact nanosecond arithmetic applies throughout.

The half-open preparation and grant windows must cover the inclusive
terminal-plus-60-second deadline. Evaluation must also satisfy current grant
and trust windows. Eligibility may be audited after the disposal deadline;
this result never proves timely disposal. Actual action/receipt deadline checks
belong to the later execution composition.

## Output and explicit non-authority

Success returns verified-preterminal-grant, scope/policy/authority/preparation/
tuple digests, copy count, named terminal ID and relevant times. The stable
batchBindingDigest identifies config, preparation, authority and terminal ID;
it deliberately excludes the future terminal result/body. It is not a token.
Both success and failure return zero effects and executionAuthorized false.
Success additionally requiresCurrentBatchAuthorization true. Failure uses one
fixed error without leaking input. Repeated audits do not consume the grant.

The actual terminal is validated as a single event, not proof of complete
history. Current inventory, holds, references, authoritative batch consumption,
per-copy credential/reservation/receipt checks and separate tombstone authority
are absent from this helper and cannot be inferred from its success. Subsequent
0074 integration now supplies full lifecycle and original/current batch checks
for all-first/all-replay sets; partial-copy recovery remains open. Frozen
records, Exams, registries, policies and key windows are untouched.
