# Spec — Whole-target scope review batches

## Planning

`planIntentScopeBatches` first verifies the existing evidence input and every
provided document's SHA-256 and Git blob identity, including sources excluded by
the legacy first-32 envelope. Sort by target and path. Keep all listed sources for
one target together: canonical, candidate and separately proposed amendment scope
retain their status and whole UTF-8 content. Never extract a convenient passage
that drops a qualifier or makes an incomplete target appear assessed.

Use at most eight batches, 32 documents and 128,000 source-content bytes per batch,
and 32,000 bytes per document. Missing, blank or oversized source content withholds
that entire target. A target too large for one batch is withheld, not split. Record
source-level reasons for missing content, empty content, source context limits,
incomplete siblings, target context limits and batch-count exhaustion.

The inherited input still accepts at most 1,000 inventory references and 50 provided
documents. Planning does not fetch more documents or expand the upstream collector's
read/time limits. Byte limits bound source content, not model tokens or complete
prompt size; they are not a pricing or model-context allowance.

Each batch has an exact local evidence envelope and deterministic identity bound
to the whole input, scope, source snapshot, planning revision, ordering and member
sources. The parent plan binds batch metadata plus global inventory/access/gap
coverage. Input reordering is stable; changed source/scope/access/configuration
changes the relevant digests. Batch-local completeness is never global clearance.

The immutable summary explicitly records zero model calls, no semantic review and
no authoritative clearance. `plannedComplete` means all declared available context
fits the plan, not that any duplicate decision or execution occurred. A declared
empty corpus may be planned completely but has no assessed batch.

## Result validation

`validateIntentScopeBatchResults` recomputes the plan from exact evidence rather
than trusting caller-supplied planning metadata. Accept at most eight strict
receipts, bounded to 4 MB serialized JSON, each binding plan, batch and configured
assessment profile. Reject duplicate, foreign, stale and substituted identities.

Validate each receipt against its local envelope using the existing strict
assessment/citation contract: target/source membership, byte ranges, UTF-8 bounds,
exact quote bytes and one citation for every claimed assessed source. Preserve
findings and per-source canonical/proposed provenance. Missing batches stay pending;
missing findings, abstentions and any global coverage gap stay incomplete.

Only a nonempty plan with complete parent coverage and every validated batch can
return structural `assessed-declared-corpus`. This is not semantic quality, provider
provenance, role independence, permission, budget or action authority. Returned
`semanticQualityVerified`, `authoritativeClearance`, `executionAuthorized` and
`savedToGit` remain false. No cross-target semantic synthesis or model dispatch is
implemented here. No automatic retry is introduced.

## Actual application connection

The unactivated `steer-development-review/v1` response gains required
`scopeBatchPlan` metadata. The API and web contract change together; the portable
verifier independently recomputes and compares the full summary before accepting
it. Existing stored original formats are unchanged. The current recorded-review
service retains its independent draft/source/authority rechecks.

The existing editor displays planned batch/document counts and incomplete coverage
using the established design tokens. It explicitly distinguishes planning from
duplicate assessment or started model calls. It does not introduce another preview,
new execution controls or extra browser persistence.

The legacy evidence envelope and generation gate remain unchanged. For example,
50 small documents may fit two planned batches while the existing first-32 review
still blocks generation as incomplete. Planning cannot bypass that gate; durable,
budgeted semantic execution and its reviewed-result integration remain next work.

## Remaining boundaries

Real access/lifecycle verifier binding, larger-corpus fetching/context handling,
durable semantic role execution and content evaluation, authorized records/model
activation, final save/reopen integration and real I1–I6 acceptance remain open.
No real records, key, grant, migration, model call, runtime Git write, gate,
deployment, release, spending or signed artifact changes in this increment.
