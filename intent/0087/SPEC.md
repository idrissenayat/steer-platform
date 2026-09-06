# Specification · development candidate

## Trusted selection and complete prerequisites

`createReferenceRevocationVerifier(trustedContextBytes)` selects a closed
steer-reference-revocation-context/v1 record containing contentContextBytes,
environmentId and tombstoneRecordId. It constructs the full 0086 content verifier,
0085 qualified-reference human profile and 0059 current event verifier from that
trusted content registry. These are actual prerequisite verifications, not
caller-supplied success flags.

The closed steer-reference-revocation/v1 envelope contains policyDigest, contentBytes,
eventBytes, humanBundleBytes, referenceReceiptBytes and completionBytes. Limits
are 256 KiB trusted context and 8 MiB evidence envelope, measured in UTF-8 bytes.
Existing content, event, nine-human-record and 128-reference limits still apply;
each removal/completion record is at most 64 KiB. IDs and environment/tombstone
selectors are bounded literal values without wildcards/control characters.

## Actual qualified reference event

The exact event must be reference-revocation-authorized for the selected
RC-REFERENCED-EVIDENCE record, revision, organization/item/environment and retention
policy. Full event and independent provider signatures are verified at native and
current times. Its actorId/actorAuthority equal the qualified human subject/hat;
authorizationRecordId equals authorityId. Event referenceInventorySha256,
verificationBundleSha256 and tombstoneRecordId equal the retained content and
trusted tombstone identity, not caller alternatives.

The complete human proof binds event ID/payload, reference inventory/bundle and
tombstone fields. Its selector inventory is the exact selected record/revision
and digest of organization/item/environment/record/class/revision. ReferenceState
must be active, representing the nonempty pre-revocation set. HoldState remains a
truthful none/active/released context value; this result never releases a hold.

Conditions are exactly event, selector, references, verification and tombstone
binding strings. Safeguards are exact-record-scope, independent-provider-proof,
retained-verification and separate-disposition-authority. The owner decision must
follow retained verification; selector capture follows inventory observation.
The winning owner reservation must precede or equal event commitment. All complete
current owner/profile expiry, assignment, qualification and CAS/replay rules remain.

## Removal is distinct from approval

There is exactly one provider-signed reference-removal-receipt per manifest
reference, in the same order. Each uses authoritative-reference-store and binds
context/policy, event/authority/reservation digests, manifest/bundle digests,
tombstone identity, unique receipt ID, exact reference ID/tuple digest,
afterRevision, status=removed and remainingMatches=0. The resulting revision must
be a 40-hex revision distinct from the original source revision. References sharing
the same source repository/revision/path must report the same resulting revision.

A separate record-domain reference-revocation-completion from
authoritative-reference-state binds the same transaction and exact ordered receipt
digest array, full reference count, referenceState=cleared and no remaining IDs.
Missing, duplicate, reordered, forged, partial, orphan or substituted receipts and
completion records deny. A qualified approval by itself cannot satisfy this state.

Every proof is current and natively timed, with age/lifetime at most 300 seconds
and exact half-open expiry. Removal follows the event in nondecreasing order;
completion follows all removals. Validity cannot outlive the owner, retained content
or predecessor removal receipts. The shared trust selection disallows role aliases.

## Result and remaining work

Success is verified-reference-revocation, factOnly=true, executionAuthorized=false,
currentActionAuthorityRequired=true and zero effects. It provides completion/event
digests and time, hold context, content/tombstone identities, full evidence digest
and bounded qualified-approval identities for later composition/replay guards.

These are verified signed source observations, not independently performed live
repository mutations or source reads. There is no action endpoint, provider access,
human signing, deletion or CAS consumption here. The full lifecycle must still
match the exact event/history and fresh cleared state/completion digest, enforce
retention and active holds, reconcile copy/version inventory, require separate
current copy/tombstone authority and reject cross-decision reuse. Current runtimes
still exclude referenced-evidence erasure. Formal review and all five R5 findings
remain open; no deployment, release or spending is authorized.
