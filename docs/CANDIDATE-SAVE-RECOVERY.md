# Check an uncertain candidate save

0253 connects a read-only check of the **original save operation** to the actual
signed-in workspace. It complements [exact bundle reopening](SAVED-CANDIDATE-REOPEN.md).
The service factory remains uninstalled: this does not activate real records,
provider access, Git saving, grants or gates.

## What the human sees

An exact save-status link identifies the organization, product, repository,
branch, preserved draft/revision, operation UUID and input digest. Opening it
checks the original operation. “Recheck original save” reads that same operation
again; there is no automatic polling, new submission, retry or replacement ID.

- **Committed:** the server verified the original Git receipt and bundle bytes.
  “Open exact saved bundle” opens its exact commit through a separately authorized
  read. This does not mean workflow bookkeeping or gate approval is complete.
- **Not found:** no matching receipt was verified at the observed head. A write
  may remain pending or unresolved; this does not authorize another submission.
- **Unknown:** the outcome remains unresolved. Recheck the same operation or
  request separately authorized reconciliation.
- **Conflict:** the receipt conflicts with the original request. Reconciliation
  is needed; no replacement save or quarantine release is permitted by this view.

Current draft text stays untouched. Hidden pages, navigation, expiry, denial or
closure clear the status and reopen link; late responses cannot restore them.
Links contain reference metadata only, never source text, consent or credentials.

## Implementation boundary

`intent.candidate.save.status` is a shared HTTP/OpenAPI/MCP query with its own
explicit grant. Server composition pins the subject and repository/product/
branch/item scope. The input is reference-only: the original documents and human
confirmation are loaded from the encrypted, owner-bound original store, not from
browser assertions. Current records/key/lifecycle checks are enforced before and
after receipt inspection; any changed or inaccessible original suppresses output.

The read-only Git inspector exposes no write or dispatch method. It checks the
original manifest, confirmation, receipt, expected parent and exact changed tree.
Only a verified commit yields a bundle reference. The response contains metadata,
not source documents, and always keeps retry, gate and execution authority false.
Identity is revalidated before, around and after I/O. Bounded admission retains
stalled dependencies until they actually finish; closure suppresses late results.

Status does not create operations, reserve funds, start Temporal, claim dispatch,
checkpoint execution, reconcile or clear quarantine. The original store's existing
monotone lifecycle-denial synchronization remains; reads cannot release a hold,
extend retention or delete records.

## Remaining journey

Save preparation and exact human confirmation/start integration must provide the
original recovery reference. Candidate discovery and live activation are separate.
This feature is verified with synthetic identities, actual temporary Git, disposable
PostgreSQL and actual React components—not a real signed-in human save. See
[0253 evidence](../intent/0253/EVIDENCE.md) and [the journey plan](INTENT-JOURNEY-PLAN.md).
