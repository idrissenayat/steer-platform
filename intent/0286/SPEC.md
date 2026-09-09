# Intent 0286 specification

1. A private adapter helper constructs a read that awaits the exact bound,
   argument-independent current policy before and after each successful read.
   Keep construction identity only in a WeakMap, never decisions, heads, results,
   grants or request-provided flags. Freeze the constructed read, use intrinsic
   invocation instead of overridable function properties, and do not export the
   helper publicly.
2. Catalog root/inventory reads may omit their duplicate policy pair only for the
   exact constructed read and authorizer identities. Bundle-facing catalog reads
   still genuinely invoke the catalog check; bundle readers can omit only that
   identical enclosing pair. Do not transfer proof across a skipped callback.
3. Preserve separate caller checks, all source grants, exact commit/tree/blob and
   document validation, final checks, limits, cancellation/admission and receiver
   behavior. Unknown/wrapped/bound/replaced methods and different policies retain
   the complete original path. Reject nonvoid policy responses.
4. Test exact identity, denial, late revocation, closure, unforgeability, receiver,
   no caching and identical corpus bytes/coverage. Measure the authenticated native
   source-review path and rerun the capped latency prefix plus joined regression.
   Report observed request counts separately from latency acceptance.
5. Run focused/broad regressions, types/build and documentation checks. Keep
   progress at 68% (17/25; +0 points) unless the entire C22 acceptance passes.
   No real model calls, spending, user-data migration/deletion, runtime GitHub
   writes/grants, records adoption, gates, deployment or release.
