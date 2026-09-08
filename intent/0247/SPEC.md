# Specification — Scope reference discovery and read-first recovery

## Query boundary

`intent.scope.discover` is a separately granted human query. Input is organization,
product, repository, draft ID, revision, revision digest, scope input digest and a
nullable review-ID cursor. Caller subject, limit, configuration, provider, budget,
source bodies and execution settings are rejected. The server supplies current
owner/configuration and mandatory metadata plus per-entry authority.

Output echoes the exact input, adds database observation time and lifecycle use
deadline, at most twenty `{reviewId, preparationDigest}` entries and the next
cursor. It explicitly disclaims content, execution, saving and gates. The retained
original table has no creation timestamp: UUID descending is stable keyset order,
**not chronological or newest-first**. No implicit preferred review is selected.

## Database behavior

The disabled factory accepts only the draft pool; no key or execution pool is
provided. Check current/session role, forced owner/product scope, exact records
configuration, latest revision metadata and digest, and active non-held,
non-discarded, non-published lifecycle. An unavailable or stale draft is an error,
not an empty discovery page. Match and structurally verify original metadata; do
not select encrypted content or claim its cryptographic provenance from metadata.

Read at most twenty-one rows under a read-only repeatable-read transaction. Release
the lease before per-entry authorization; repeat the read and compare entries and
lifecycle to reject changes before release. Revalidate current human authority
around service invocation and before returning. Four requests maximum, thirty-second
deadline, no replacement/retry, and admission held until timed-out dependencies
drain. A late acquired lease is cleared/released without a metadata read.

No schema, migration, runtime installation or grant change is introduced. Discovery
is limited to captured originals, not uncaptured admitted runs. Different corpus or
profile versions of the same exact draft can appear. Current permission to discover
a reference is not authority to read its content or start its workflow.

## Actual editor

After restoring the saved draft and reviewing current sources, use **Find retained
scope reviews**. Pages remain bounded; **More retained scope reviews** uses only the
returned cursor. Empty pages explicitly limit their claim to the current owner,
records configuration and revision. Errors do not become empty/no-match results.

Selecting a listed reference reads it first, never prepares or starts it. Bind the
response to the current human/source revision and validate findings against actual
reviewed corpus bytes and plan. A different retained corpus does not become current
findings. Completed/failed/expired reads do not expose a retry action. A verified
pending read offers explicit same-reference start recovery under separate current
start/model permission; it never automatically sends that action.

Unknown preparation/start inputs remain recoverable as before. Discovery cannot
replace unresolved commands. Edits/undo invalidate retained display; unknown or
denied reads suppress findings. Session changes and closure suppress late results.
No draft content is replaced and no local/sessionStorage is used. Metadata/result
reads remain independent of model-use capability. Legacy direction/generation
coverage gates remain unchanged and larger scope coverage does not bypass them.
