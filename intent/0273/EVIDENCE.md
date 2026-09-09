# Development evidence — 2026-09-09

Base: `f3ca51b86490da7d6f5fd03958f113a8db7b4942`.

## Implementation and discovered issue

The new joined test establishes native Git authorization before corpus capture,
then uses the real identity runtime and complete service factory for source review,
scope/development preparation, generated result reads, corrections and history.
Existing scope and SDK step runtimes execute directly with synthetic transport
responses. All candidate/write/scheduler authorities stay unavailable in this test.

The first two runs stopped at source review. The instrumented second failure was
30,244 ms with 4,048 native provider requests: repeated current authentication
re-read the same immutable authorization artifact through commit/tree/blob calls.
Both runs cleaned up their synthetic PostgreSQL container/tmpfs data. The source
review deadline was not increased, the 34-source corpus was not reduced and no
failed run is claimed as successful.

The resolver now retains only its most recently verified exact-commit document
within one explicitly scoped HTTP/MCP request. New requests fetch the source again;
unscoped resolver use remains full read-through. Request completion/failure clears
the snapshot and late work from that ended request denies, even inside a new one.
Every lookup still reads current Git head; a changed head re-fetches the source
and verifies head stability. Errors clear retained bytes; source binding/method
replacement denies; returned records are cloned. Token expiry, active membership,
hat intersections and tool grants remain evaluated by OIDC/tool authorization.
No principal, authorization decision, TTL or database fallback is introduced.

## Verification

The initial 14 focused authorization/managed-runtime tests and adapter/API type
checks passed, and the first optimized joined run passed all three checks plus
idempotent migration verification: two scope batches, both recorded SDK roles,
exact restart, human correction and historical lineage with execution denied.
Four synthetic calls/reservations occurred; no native Git save occurred.

The first broad regression run passed 1,327 of 1,328 tests. The existing Git-browser
digest-failure test exposed a boundary in the first optimization: retained bytes
spanned separate requests. The optimization was narrowed to explicit request scope
in HTTP and MCP, leaving the existing failure expectation unchanged. Added tests
cover independent/concurrent scopes, unscoped full read-through and denied late
work.
The first request-scoped focused run preserved the existing Git-browser failure
checks but the architecture detector rejected the newly used Node async-context
primitive. Its allowance is now restricted to the identity authorization adapter
only, with negative tests for core/browser/API/other adapters; no new package or
cross-layer dependency is permitted. This is an explicit platform-primitive
addition, not a relaxation of the failed authentication expectation.

The final 38 focused authorization, Git-backed HTTP/MCP, identity ownership,
managed-journey and architecture tests pass (4,054 ms). Prototype and all eight
package type checks and the optimized Next production build pass. Resolver closure
now clears snapshots and disables async-context storage after owned transport
drain; new/unscoped/late authorization remains closed without provider reads.
The 95-artifact kit and read-only workflow token-scope audit pass. All 351 local
Markdown links in the ten changed/new documents resolve and `git diff --check`
passes. Protected Architecture/Exam/accepted-retention hashes remain unchanged.

After the request-local and owned-shutdown changes, the final
`--journey-runtime` run passes all three joined checks plus idempotent migration
verification. The final generation case preserves all 34 sources, two recorded
scope batches, both separate drafting roles, exact result recovery and human
correction/history with only four synthetic calls/reservations and no Git save.
The existing `--candidate-journey` selection also passes its joined check plus
idempotent migration verification: fixed Temporal save, lost acknowledgements,
read-only recovery, exact older-commit reopen and publication-record handling.
Both isolated runs removed only their own synthetic PostgreSQL container/tmpfs
data. These are focused integration selections, not a full SQL-suite run; the
older candidate journey is not yet joined through the authenticated factory.

The final broad regression run passes all 1,332 tests with no failures, skipped
tests or cancellations (141,512 ms). The existing Git-browser source/digest failure
expectations remain unchanged and pass with request-local reuse.

## Boundaries

Native Git and PostgreSQL are real disposable engines; identity, records/grant
policies, keys and SDK responses are synthetic. Direct worker execution is not
Temporal scheduling. This is not browser, live-model semantic quality, candidate
confirmation/save/reopen through this factory or signed-in I1–I6 acceptance.
Remote provider latency/request budgets still need measurement before live use.
No paid model calls, runtime GitHub writes, real migrations or provider grants occur.
