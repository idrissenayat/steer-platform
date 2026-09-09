# Intent 0277 specification

1. In the history projection only, route original scope-lineage reads through the
   existing private window without duplicate `checked`/`authority` wrappers. That
   window must itself check the caller before and after every supplied original
   callback, reject nonvoid/missing callbacks and verify full initial/final scope.
2. The internal port is unavailable until the window installs it. Never fall back
   to an unwrapped external reader. Keep operation tracking, cancellation, closure,
   concurrency bounds and the original service deadline.
3. Preserve all original/key/records/lifecycle, exact target/source/result,
   predecessor/SDK, expiry and final-read checks. Ordinary current scope reads,
   model dispatch, write admission, Git authorization resolution and live authority
   are unchanged. No stale head, permission cache or cross-request snapshot.
4. Add direct-callback ordering, in-callback revocation and missing-callback tests.
   Run historical SQL regressions and the authenticated joined workflow; compare
   content-free request counts with 0276 rather than claiming live-load acceptance.
   Add synthetic request-category counters to separate head, commit, tree, blob,
   token and mutation traffic without printing paths, identities or provider data.
5. Verify broad regressions/types/build and document actual measurements. Synthetic
   providers only; no D1 adoption, spending, credential access, real runtime writes,
   deployment, signature, release, deletion or user-owned-file changes.
