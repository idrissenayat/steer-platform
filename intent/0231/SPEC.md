# Spec — Working-draft discovery and recovery

## Read-only discovery

`intent.draft.discover` is an explicitly granted human query in the common tool
registry. Its input is organization/product/repository and a nullable keyset cursor
of creation time and draft UUID. Caller-supplied subject, limits, model parameters,
content and execution authority are rejected. The current identity and configured
owner/product/repository are revalidated before and after service execution.

The uninstalled data composition uses only the restricted `steer_draft_runtime`
pool, no keys or model/execution pool. Two read-only repeatable-read snapshots
surround current per-entry authority checks outside SQL leases. Query limits, four
admissions and a 30-second response limit apply; timed-out dependencies retain
their slot until settlement, and late replies cannot release metadata.

Select only current-configuration owner records that are not held, discarded,
published or expired. Return up to 20 descending creation-time/UUID references,
using a 21st sentinel for pagination. Verify canonical revision metadata hashes and
parent/index bindings, ordering, lifetime and unchanged results before release.
Empty references have no content revision or run. The latest stored revision may
include the operation ID/input digest of one retained development original.
Ambiguous retained runs fail the query instead of choosing an arbitrary result.
No ciphertext or document content is queried. No row is written or deleted.

The list is explicitly scoped to the current owner and records configuration. It
is not a repository duplicate search, a complete run-history browser, proof of
preserved plaintext, verified generated results or execution authority. It does
not discover older-revision runs or an operation whose original capture never
completed. Current `intent.draft.read` and `intent.development.read` independently
verify and authorize content and results.

## Actual editor recovery

The existing editor adds `Find my drafts`, bounded pages and `Review this draft`.
There is no automatic fetch, restore, preparation or generation after refresh.
Metadata displays creation time, reference, stored revision and retained-run
availability, never plaintext titles. Failed discovery clears its stale list but
does not erase the editor or claim the result is empty.

Selecting a draft uses the existing stored-revision preview. `Keep my current
text` leaves the editor unchanged. Only `Replace editor with this stored revision`
restores content. An exact match between the acknowledged restored revision and
the discovered latest reference enables `Resume this recorded run`.

Resume sends only a status read. A terminal result resolves uncertainty without
prepare/start and remains a preview until explicitly adopted. A pending or unknown
run can only request exact same-reference start/recovery through the existing
explicit action and current server authority; it never automatically regenerates.
Read-only resumption remains possible when the generation UI flag is disabled.
Source changes invalidate replay/adoption; hidden, expired or changed identities
clear private in-page state. No browser storage copy is introduced.

## Boundaries

The factory is not installed in the real runtime. No new environment switch,
migration, grant, key, records service, model call or Git writer is activated.
Discovery supports I4 but does not complete its live acceptance, nor I1–I6 overall.
Production full-corpus/lifecycle authority, semantic duplicate review, authorized
runtime composition, live cost/content acceptance and atomic Git save/reopen remain.
