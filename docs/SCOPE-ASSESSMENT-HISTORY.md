# Historical scope assessment review

Increment 0255 adds an explicit historical read to the actual authenticated
conversation. It is inspection of retained evidence, not a current duplicate
decision, new execution grant or proof of semantic accuracy.

## Human workflow

1. Find and open a retained scope review for the preserved draft. Existing discovery
   remains owner/configuration/exact-revision scoped; this is not an all-revision
   historical catalog.
2. Select **Read historical findings**. No automatic history fetch, model call,
   preparation, recovery start or save follows this action.
3. Inspect the assessed draft revision, latest preserved revision, expiry label,
   original source commit, explanations and cited Brief/Spec passages. Sources
   come from the retained assessment inventory, not the current editor inventory.
4. Continue current-scope review separately. Historical findings never enable the
   direction or generation controls and cannot satisfy the current read contract.

The view clears on source/workflow/identity changes, failed history reads,
session expiry, page exit or hidden document. A late response cannot repopulate
cleared content. It does not replace human text or write browser storage.
The existing pink/orange controls and keyboard focus behavior are preserved.

## Service and authority boundaries

The human-only explicit-grant query is `intent.scope.history`. It uses the shared
HTTP/OpenAPI/MCP registry, metadata-only input and no-store replies. The output kind
is `steer-scope-review-history/v1`, deliberately distinct from
`steer-scope-review-read/v1`. It includes historical/expiry/source metadata,
recorded batch states, combined verified results and retained source references.
It excludes wire request/response bodies, keys, reservations, fences and checkpoints.

`createVerifiedScopeReviewHistoryReader` is an explicit, uninstalled composition.
The configured historical profile must exactly match the retained profile and be
currently permitted for verification. Present identity, owner/product/repository,
records-policy, retained-source, draft lifecycle and historical-key permissions
remain mandatory. A valid old configuration is only an immutable binding.

Two additional callbacks separate historical observation and operation access:
`authorizeHistoricalRead` and `authorizeHistoricalReview`. The old execution
authorization callback is never consulted or renewed on this path. Ordinary
expired reads still return no findings, and ordinary observation/checkpoint
paths still reject expiry.

Historical-read authorization is checked for every planned batch before inspection
and before release, even when no observation has completed. Incomplete or quarantined
metadata is not an exception to current historical access controls.

The operation reader uses a read-only, repeatable-read SQL snapshot with forced
tenant/owner/product RLS and the existing limited runtime role. It verifies the
exact original configuration, manifest and batch bindings without taking
ownership, reserving budget, changing state or exposing an execution method.
The observation reader reuses authenticated decryption, exact draft/source checks,
pinned SDK request/response/usage verification, key rechecks and lifecycle holds.
Its historical result strips checkpoint capability.

Only succeeded batches whose payload digests match their durable records enter
the combined public assessment. Uncheckpointed, uncertain or failed observations
are not promoted; their batch states remain visible as incomplete history.
The batch snapshot and original are rechecked before release. History is bounded
to the existing four concurrent queries, 30-second query deadline and existing
source/observation limits; unfinished dependencies retain admission until drained.

## Remaining work and activation

This closes historical scope **inspection**, not development-original lineage.
Assessed generation originals still use current-only scope revalidation; their
independent historical verification/read path must be implemented before save
lineage can be prepared. Do not weaken current admission checks to reuse history.
All-revision run discovery and a human-friendly lineage comparison remain open.

No backend is enabled by this increment. D1 adoption, current records/provider
authority, separately approved model spending, candidate-save preparation/
confirmation/start and actual human save/reopen acceptance remain outstanding.
Local SQL/SDK and production-component tests use synthetic authority and responses;
they do not demonstrate a live provider or signed-in human journey.

See [0255 evidence](../intent/0255/EVIDENCE.md), [the controlling journey](INTENT-JOURNEY-PLAN.md)
and [the workflow contract](architecture/WORKFLOW-CONTRACT.md).
