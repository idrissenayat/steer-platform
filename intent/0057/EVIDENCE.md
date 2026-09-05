# Development evidence

Baseline 427db4a042d991a8fedc3e78eca1202fa4f89e43 plus this increment.
2026-09-05 UTC. Offline candidate evidence only.

The synthetic two-line fixture retains real signed provider-test records from
the frozen factory and creates only module-private synthetic money signatures
for its reconciliation ledger/variance/successors. No real key is accessed.

The frozen oracle returns ALLOW with only one variance/successor pair. The new
closed envelope denies either missing second pair. Both complete pairs return
9,800,000 nano-USD, rounded once to 1 cent, with zero effects. All 32 independent
array reorderings return the same result. No input source bytes are changed.

Hostile tests cover duplicate IDs/digests, orphan/cross-line references, corrupt
signatures, internally consistent but false amount claims, future variance and
late reconciliation times. Amount/time mutations also re-sign the linked
successor, proving the check reaches the actual truth comparison instead of
merely failing on a stale variance digest. Fixed error responses omit totals.

Six prior reconciliation cases and corrupt authority/price/provider-proof cases
exercise preservation of the original verification path. All six correction test
groups pass. The full pnpm check exits 0: kit/security, typechecks, 88 prototype
tests, 34 control/boundary/correction tests, package suites (domain 10, registry
48, data 20, adapters 61, API 68, web 24, workers 18) and builds. Verified runtime:
Node 24.20.0 / pnpm 11.19.0. Frozen install and diff/remote checks are verified in
the handoff. Frozen-package integrity was fully verified in 0056 (4,027 IDs,
15 schemas, 64 artifacts and 25 preserved prior records); this increment also
leaves all frozen/Exam files unchanged. No production module is changed in 0057.

No production route, provider access, spending, deletion, signature, release or
deployment. No new browser/operational/manual evidence claimed. R5-004/005 now
have development correction candidates, not independent acceptance or formal
closure. R5-001/002/003 corrections and complete-package review remain open.
