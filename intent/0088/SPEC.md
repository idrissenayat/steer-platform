# Specification · development candidate

## Explicit shared-verifier profile

The entry point is createReferenceProtectedActionVerifier from
reference-actions.candidate.mjs, implemented by the same private verifier body as
the original 0060 action factory. No caller-defined action table or permission
oracle is exposed. The original factory, seven actions, manifest/policy digest,
context version and return behavior remain unchanged.

The new steer-protected-reference-actions/v1 manifest enumerates exactly two
actions: lifecycle.delete-copy and lifecycle.commit-tombstone. Its separately
selected trusted steer-protected-reference-context/v1 has a distinct manifest
digest; incoming bundles still bind the exact trusted context digest. An evidence
bundle cannot switch profiles or install another action.

## Exact resource additions

Both actions require recordClass=RC-REFERENCED-EVIDENCE. Delete-copy retains every
original object/copy/provider/account/key/version/inventory/tuple selector and
adds required objectSha256 with exact 64-hex shape.

Commit-tombstone retains object/class/inventory/tuple/aggregate/path selectors and
adds required tombstoneRecordId and verificationBundleDigest. The ID is a bounded
literal value and the digest is exact 64-hex. Tombstone paths reject absolute,
traversing or empty segments. Extra, omitted or malformed fields deny.

The complete provider resource snapshot, scoped credentials/delegation/assignment,
authority evidence, request and replay/CAS all bind these exact expanded selectors.
No metadata field is passed alongside an old grant without being authorized.

## Existing complete proof and trust boundaries

All ten shared signed evidence records remain mandatory: request, upstream and
downstream credentials, delegation, assignment, authority, provider resources,
replay ledger, CAS head and reservation. Current/native time, exact target/policy,
provider role, one-use credential, selector and complete replay-result rules are
unchanged. The reference profile additionally disallows public-key aliases across
the selected registry, so a renamed authority key cannot impersonate a provider.

The shared lifetime/age, closed-schema, grant count and request-size limits still
apply. Replay remains REPLAY_NOOP with the exact committed result; it cannot skip
the complete prerequisite checks. Every new-profile output includes
executionAuthorized=false and zero effects, including denial.

## Remaining integration

This profile verifies action evidence only. It does not replace the full qualified
human proof, retention/reference/hold checks, observed removal, copy inventory,
provider completion receipt or durable tombstone evidence in the lifecycle graph.
Current runtime admission still excludes this class pending that composition.
No provider call, action executor, human signature, protected edit, release,
deployment or spending is introduced. All five formal R5 findings remain open.
