# Preparation recorded, original input missing

0264 adds an explicit **Check preparation diagnostics** action to the actual
authenticated Next run-history panel. It complements, rather than replaces,
[retained-run discovery](RETAINED-RUN-DISCOVERY.md). Its shared HTTP/MCP query is
`intent.admissions.discover`; its configured server factory remains uninstalled.

## What the human sees

Open a draft's agent run history and choose **Check preparation diagnostics**.
Each reference identifies scope review or document drafting and the preserved
source revision. No source text, generated document or editor change is returned.

| Observation | Meaning | Not established |
|---|---|---|
| Original input metadata was not observed | A preparation admission exists in one configured execution binding, but matching retained-original metadata was not seen in the sampled reads | Never dispatched, never charged, safe to create a replacement |
| Original input metadata is present | Its owner, draft revision, configuration and input references match the recorded admission | Decryptability, verified content, successful execution or complete documents |
| Execution window expired | The configured execution expiry precedes the database observation | Permission to extend, restart or retry |
| No records on this page | This bounded page has no matches in the explicitly configured bindings | Complete historical coverage or absence of earlier attempts |
| Unavailable or changed | Current access, lifecycle, role, metadata or stable-read checks failed | Empty history or permission to retry |

The user can explicitly request another page or return to the first page. To
inspect content, use **Find retained agent runs** and its separate current content
permission. Diagnostics never invoke content recovery, execution status, start,
retry, adoption, signing or saving. The UI clears older content selection when
diagnostics begin; identity/source changes, visibility loss and expiry discard
late results. Failures do not erase editor text or become empty-history messages.

## Server flow and limits

1. Require a current human tool grant and exact organization, subject, product,
   repository and draft scope. Browser input contains only that scope and cursor;
   configurations, model choices, secrets and budgets cannot be supplied by it.
2. Explicit composition supplies one records configuration and 1–16 distinct,
   scope-matched execution bindings for scope review and/or development. Their
   normalized digest binds the page cursor. This is metadata inventory selection,
   not activation of any execution or spending approval.
3. The restricted `steer_app` connection reads admission metadata in a read-only
   snapshot. The separate `steer_draft_runtime` connection checks lifecycle,
   preserved revision metadata and matching original metadata in another read-only
   snapshot. Neither role gains the other's SQL grants. No ciphertext, keys,
   execution-step/result records, budget reservations or write operations are used.
4. Verify each sampled reference's current metadata authority outside leased SQL
   transactions, then repeat the reads. Changed admissions, original presence,
   source revision or records deadline withhold the page. This is stable sampled
   metadata, **not an atomic transaction across two pools** or a promise that no
   event can occur after response. Current principal checks continue through release.
5. Return at most ten entries; an eleventh checked reference establishes a next
   page. Order is revision/type/ID descending, not execution time. Cursors bind the
   latest source digest and execution binding set; new source revisions invalidate
   them. New admissions still require explicit first-page refresh.

Four server operations and one panel request are admitted at a time. The server
has a 30-second total bound and restricted SQL limits; the browser has a 40-second
bound, a fixed authenticated HTTPS same-origin route, 60 KB/10,000-chunk response
limits and no automatic retry or local storage. Pending dependencies retain their
admission until cleanup drains; timeouts do not assert that underlying I/O was
instantly cancelled.

Held, discarded, published, retention-expired, incorrectly configured or corrupt
draft records are unavailable. Other execution configurations and candidate-save
admissions are **not searched**. This intentionally bounded diagnostic cannot
establish global historical absence, novelty, duplicate clearance or retry safety.

## Acceptance boundary

See [0264 specification](../intent/0264/SPEC.md) and
[measured evidence](../intent/0264/EVIDENCE.md). SQL/HTTP/MCP and actual React-graph
checks use synthetic identity, authority and records; they are not a live signed-in
walkthrough. No provider calls, model spending, real draft-records activation,
GitHub runtime writes, credential changes, auth bypass or separate preview exist
in this increment. The credential decision remains resolved. D1 adoption and the
proposed $5 model budget are still unsigned/unapproved.

Next: trusted destination/lifecycle composition, then authorized integration and
the actual [I1–I6 acceptance journey](INTENT-JOURNEY-PLAN.md).
