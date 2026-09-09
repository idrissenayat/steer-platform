# Intent 0291 specification

1. Treat installed bundle-use and corpus authority callbacks as read-only policy
   metadata queries, not source readers, effect ports or publication mechanisms.
   The manager authenticates before its first policy lookup. Each subsequent
   boundary evaluates independent bundle policy and then freshly authenticates
   the caller before service continuation. Preserve every invocation, five-second
   dependency bounds, four shared admissions, scope/method ownership and drain.
   Never reuse a principal, permission result or authorization lease.
2. Corpus checks evaluate current inventory/all-grants revision and then the
   current caller. Repository head, inventory and source reads remain bracketed
   by fresh checks. Group final selection/consumed-source validation into a
   policy-only sweep; invoke every policy, guard every await, and require the
   same all-grants revision and current caller before/after. No content IO,
   effect or result publication may occur inside a sweep.
3. A private repository-read constructor may run independent source-grant queries
   before/after the byte read. Order: source grant, current caller/inventory,
   content IO and exact validation, source grant, current caller/inventory.
   Retain nonvoid rejection, lifetime guards and proof identity; default/unknown
   readers preserve their existing path. No duplicated caller pair is required
   around the metadata-only source-grant queries.
4. Native Git readers may read a blob using only an exact immutable inventory
   produced by that same reader at that exact commit. Keep a private weak object
   identity proof, frozen membership, regular-file mode and path/revision checks.
   Always fetch and verify the body anew using the same bounded byte/hash parser.
   Copies, forged/foreign snapshots and missing/mismatched entries deny before
   IO; wrapped/replaced ports retain the full commit/tree/blob path. This proves
   content membership, not access. The corpus still owns current permissions and
   head checks, and no API/profile/credential activation setting is added.
5. Verify mid-policy identity/source/revision loss, closure, timeout/drain,
   replaced ports, malformed blobs and receiver/invocation behavior. Run focused
   and broad tests, types/build, actual authenticated joined regression and the
   capped delayed benchmark prefix. Retain failed/preliminary evidence and
   distinguish request reductions from warmed p95 and full C22 acceptance.
6. Update the plan, delivery ledger, runtime/performance guides and fixed tracker,
   record source hashes and raw samples, then commit/push only verified owned
   changes on the development branch. No new checkpoint until its acceptance is
   demonstrated; no 100% before actual UI and live saved-repository acceptance.
