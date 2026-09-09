# Intent 0287 specification

1. Add an optional trusted read-only evidence-window hook to scope preparation.
   Install it only in the existing actual corpus factory. Keep the complete
   fallback and initial evidence acquisition unchanged.
2. Wrap only each source/policy/source validation pair. Close the window before
   admission or original writes; open another fresh window after each effect.
   Do not borrow a read proof as write authority, cache permissions or share
   evidence across requests/effect boundaries.
3. Require exactly one completed validation callback. Reject skipped/replayed
   callbacks, early wrapper completion, nonvoid returns, swallowed failures,
   overlapping or unawaited reads and escaped late use. Preserve actual pending
   work ownership, source/draft equality and all independent policy checks.
4. Native Git/SQL checks must prove reduced full-body reads, exact retained source,
   separate window ownership at admission/persistence, final source revocation,
   post-effect drift/unknown recovery, and no model reservation or Git write.
   Rerun the actual authenticated joined save/reopen path and report measured
   scope-preparation requests separately from unmeasured latency acceptance.
5. Run focused and broad regressions, types/build, links and protected hashes.
   Preserve all signed records, credentials, live configuration and user changes.
   No spending, live runtime write, adoption, deletion, gate, deployment or release.
   Progress stays 68% (17/25; +0 points) unless a full checkpoint is accepted.
