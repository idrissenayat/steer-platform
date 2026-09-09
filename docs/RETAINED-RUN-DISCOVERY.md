# Find retained agent work after navigation or editing

0259 adds `intent.runs.discover` to the shared authenticated HTTP/MCP registry
and a read-only history browser in the actual Next conversation. It searches
captured scope-review and development originals across all preserved revisions of
one owner-bound draft, not only the newest revision.

## Human journey

1. Choose **Find my drafts**, then **Browse agent run history** for a draft.
   A stored revision preview also offers **Browse this draft’s agent run history**.
2. Choose **Find retained agent runs**. Only metadata is fetched. References are
   ordered by source revision, run type and ID, not by invented generation dates.
3. Explicitly select a scope review or drafting run. Then choose **Read historical
   findings** or **Read original agent documents** to use the separately authorized
   readers from [0255](SCOPE-ASSESSMENT-HISTORY.md) and
   [0258](GENERATION-HISTORY-COMPARISON.md).
4. Earlier Brief/Spec/Exam output can be compared with the current preserved editor
   snapshot. Listing, selection and inspection never replace text, rebase a save,
   adopt findings, restart a workflow, reserve model budget, sign or save to GitHub.

Pagination, refresh, context/identity changes, hidden pages, session loss and the
listed records deadline clear earlier selections. Failed or changed pages clear
their references; they do not become empty-history claims. An unpreserved editor
is not presented as a verified comparison snapshot. A newer draft edit between
pages invalidates the cursor and requires an explicit first-page refresh.

## Server contract and evidence boundary

- A distinct current human tool grant and current records configuration are
  required. Metadata access does not grant access to historical document content.
- Only `steer_draft_runtime` with its existing forced tenant/owner RLS is used.
  No execution pool, draft key, ciphertext, model transport or write operation is
  available to the factory. It remains explicitly configured and uninstalled.
- Both retained-original types are checked against their exact preserved revision
  metadata and current lifecycle. Different configurations, held, discarded,
  published and retention-expired drafts are excluded. Execution-window expiry
  alone does not erase a retained reference or renew execution authority.
- A read-only SQL snapshot lists at most 21 rows; 20 are returned and the extra
  row establishes continuation. Current metadata authority is checked for every
  candidate outside leased transactions. A final snapshot must preserve the exact
  latest revision, entries and records deadline before references are released.
- Cursors bind the latest preserved revision digest. Ordering is stable, but the
  pages are not a frozen complete inventory across future preparations. Explicit
  refresh includes newer references. No page establishes semantic uniqueness.
- Four server requests and one browser request are admitted at a time. Timeouts
  and cancellation retain admission until the actual dependency drains. SQL,
  response byte/chunk and request limits remain bounded; no automatic retry exists.

Captured originals can now be rediscovered even when their preparation response
was lost or their editor context is gone. This does **not** enumerate an admission
whose original was never captured, unavailable configurations or inaccessible
records. A pointer proves neither that an agent started nor that it finished.
Uncaptured admission diagnostics remain separate from content recovery; absence
must never authorize a replacement paid run.

## Acceptance status

SQL/SDK, HTTP/MCP and actual React-graph tests use synthetic authority and model
responses. They are not real records-policy adoption, model-quality acceptance,
paid-provider evidence or a signed-in saved-repository walkthrough. The existing
credential decision stays resolved; D1 and the proposed $5 model budget remain
inactive/unapproved. No auth bypass or alternate preview was created.

See [0259 evidence](../intent/0259/EVIDENCE.md) and
[the remaining journey](INTENT-JOURNEY-PLAN.md). Next priority is immutable final
save preparation, confirmation and authorized start, followed by the real human
acceptance matrix once its authority prerequisites are resolved.
