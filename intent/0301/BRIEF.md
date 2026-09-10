# Combined records and retained-source cost

Extend the [whole-request feasibility work](../0298/REQUEST-BUDGET-PLAN.md) by
reading the actual retained Git revisions discovered from the native records
experiment. Do not assume that the 0299 single-revision source measurement covers
all current/historical contexts, or that the 0300 records measurement includes
retrieving those source bytes.

Verify exact source content/status independently for each original context, count
all provider and permission calls, and identify physically shared immutable blobs
without treating shared bytes as shared authorization. Preserve the existing
authenticated journey and all approval boundaries. This is test-only cost evidence,
not another isolated production optimization or a completed C22 checkpoint.

When separately collected historical revisions exceed the proposed source budget,
test one multi-revision graph with invocation-local immutable bytes. Keep distinct
tree membership, root selections and current per-path grants for every revision.
This is the bounded design correction anticipated by 0298, not a stack change or
permission to cache authorization.
