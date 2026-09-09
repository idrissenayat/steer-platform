# Intent 0286 execution evidence

Status: increment verified; performance acceptance remains failed/incomplete.
Base: `13a96574a53b7228bc474f6beef718856b8cbe0a` (0285).

Overall remains 68% (17/25; +0 points). C22 is still pending. No actual UI,
real-provider, live model quality or end-to-end performance acceptance is claimed.

## Implemented boundary

The adapter's private `repository-read-authority.ts` constructs an immutable read
function with the actual bound policy on both sides of successful I/O. Its WeakMap
stores only exact function identities. Receiver and argument order are preserved
through `Reflect.apply`; an overridable `call`/`apply` property cannot redirect the
captured invocation. Nothing is added to the public package exports or request DTOs.

The corpus source read retains its independent before/after source grants, inner
I/O checks, exact mode/tree/blob/content verification and final consumed-path
revalidation (including pointer/manifest/Exam). Catalog root and inventory reads
can omit only an identical outer pair. The bundle-facing catalog port deliberately
still runs its own catalog check: no proof is forwarded across a skipped callback.
The bundle reader may omit that exact duplicate pair only without an independent
current-caller callback. Final bundle/catalog/corpus checks, read limits, timeouts,
pending-work ownership and no-fallback gap handling remain.

Unknown wrappers, bound functions, other authorizers and replacements do not
inherit a proof. Nonvoid authorization results now also fail closed at the catalog
boundary. No principal, grant, decision, head or content cache was added.

## Verification

The initial 56 focused tests passed; initial typechecking found only missing test
type annotations, which were corrected. After the method-replacement and immutable
invocation hardening, all **58 focused tests** pass (44,571 ms), and prototype/all
eight package typechecks pass. Tests cover identity spoofing, a different policy,
independent current caller, pre/post denial, nonvoid results, late closure,
held/failed reads, method replacement, receiver behavior, unchanged catalog
contents, missing/corrupt sources, immutable history and all consumed-path checks.

The first full default joined run began before the final immutable-wrapper and
`Reflect.apply` hardening. A second complete `--journey-runtime` run on the final
production code passes all three joined checks plus idempotent migrations. The
later 24-test focused rerun also checks the independent current caller's full
successful path, not only its denial. Final typechecks and optimized Next.js
16.3.4 build pass.

The final joined run retains 34 exact native sources, two recorded scope batches,
separate Architect and Test Agent drafting roles, six synthetic model calls and
reservations, one encrypted confirmation original, and one fixed Temporal/native
Git save. Lost HTTP/scheduler/provider acknowledgements, identity/factory restart,
receipt recovery, exact older-commit reopen and current records/Git grant denial
all pass without extra originals, model calls or saves.

| Action | 0285 requests | Final 0286 requests | Reduction | Final local time |
| --- | ---: | ---: | ---: | ---: |
| Source review | 3,042 | 2,634 | 408 (13.41%) | 2,040 ms |
| Scope preparation | 14,221 | 11,365 | 2,856 (20.08%) | 12,979 ms |
| Final save review | 7,480 | 6,664 | 816 (10.91%) | 5,014 ms |
| Save preview | 24,274 | 22,642 | 1,632 (6.72%) | 17,362 ms |
| Confirmation, discarded reply | 48,980 | 45,716 | 3,264 (6.66%) | 32,707 ms |
| Reconstructed confirmation | 48,918 | 45,654 | 3,264 | 33,078 ms |
| Repeated confirmation | 48,916 | 45,652 | 3,264 | 33,635 ms |

Removed requests are identity-head lookups; content traffic is unchanged. Source
review still uses 2,496 identity requests and 138 repository requests. Drafting
admission/start remains 41,768 / 47,350 / 47,350 requests. These are single-run,
undelayed synthetic integration measurements, not p95, a reliable latency speedup,
real-provider load evidence or C22 acceptance. The delayed prefix and final broad
regression are recorded below.

Full SQL, historical SQL and other full-disposition selections were not rerun
this increment. The prefix includes both directions but does not substitute for
a full proposal-continuation save. Each SQL run removes only its own disposable
PostgreSQL container/tmpfs; user data and real services are untouched.

## Final delayed prefix: still failed/incomplete

The final `--journey-performance` run on the hardened code passes two **harness
integrity checks**, plus idempotent migrations. Both directions still report
`prefixTargetsMet: false` and `completeBenchmark: false`. The
[raw artifact](PERFORMANCE.json) retains all samples, six harness hashes, four
changed-production-file hashes and the final undelayed joined measurements.

| Direction | Warm draft reads, n=20 p95 | Reconstructed reads, n=3 max | Concurrent reads, n=4 max | Source review |
| --- | ---: | ---: | ---: | --- |
| New-distinct | 866.47 ms | 848.27 ms | 879.98 ms | 401; 204 attempts / 200 dispatches; 5,165.80 ms |
| Proposal continuation | 853.31 ms | 878.08 ms | 884.23 ms | 401; 204 attempts / 200 dispatches; 5,054.91 ms |

All samples have zero work outstanding at return. A declared primer is preserved
separately. Draft samples retain exact bytes, with 32 attempts for warm/concurrent
reads and 33 for reconstructed/primer reads. Source review fails closed at the
request cap, with four further attempts denied without dispatch; no partial
clearance or generated documents escape. Records, reservations and Git heads
remain unchanged, with no model calls or provider saves in the prefix.

Host: Apple M4 Pro / Mac16,8, 12 logical processors, 24 GiB; macOS 26.6.2 build
25G83, Node 24.19.0. Other host activity was uncontrolled. The final SQL selections
ran sequentially; broad tests started only after the final prefix completed.
Fixture setup/teardown and runtime construction are excluded from samples, while
synthetic bearer creation is included. Native Git-provider traffic has 20 ms
injected delay; the separate issuer/JWKS fixture does not. An earlier prefix ran
before final hardening with typechecks/focused tests overlapping; only the final
prefix is retained in the artifact and table.

Later-stage repeated/cold/concurrent samples, the full negative/load protocol,
issuer latency, per-origin delayed partitions and actual browser usability remain
open. The default integration provides origin counts, not a complete delayed
benchmark. Roughly 45,700 confirmation requests are still unacceptable. C22 remains
pending and overall stays **68% (17/25; +0 points)**.

## Final regression and handoff

The broad regression passes **1,399 tests, zero failures/cancellations/skips/todo**
(156,289 ms), with four files concurrent across tool-registry, data, adapters,
agents, API, workers, web, domain and package/local-migration boundaries. It ran
after all heavy SQL selections. The final source/harness hashes, two prefix reports,
all sample statistics and twelve joined request-origin partitions were independently
recomputed from the saved artifact. The helper is absent from public package exports.
The 95-artifact kit and contents-read-only workflow audit pass.

Commands include:

```sh
node --test packages/adapters/test/repository-read-authority.test.ts packages/adapters/test/candidate-bundle-reader.test.ts packages/adapters/test/candidate-scope-catalog.test.ts packages/adapters/test/intent-corpus-evidence.test.ts
node packages/data/test/postgres.integration.ts --journey-runtime
node packages/data/test/postgres.integration.ts --journey-performance
pnpm typecheck
pnpm --filter @steer/web build
node scripts/validate-kit.mjs
node scripts/audit-workflow-scopes.mjs
git diff --check
```

The three protected hashes match [0284's recorded values](../0284/EVIDENCE.md):
Architecture `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
Exam `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`, and
records policy `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.
The fixed tracker remains 25 checkpoints, 17 verified. All 305 local documentation
links across the eight changed/new Markdown files and whitespace checks pass.

Next investigate the remaining repeated policy/evidence traversal in source review
and scope preparation, plus unchanged drafting/history admission. Reusing an
immutable read must preserve every current grant and owner boundary; do not simply
wrap writes or reservations inside the existing read-only corpus session.

The API-key skill preserved the resolved credential decision and synthetic-only
boundary. No real model call/spending, credentials, records/D1 adoption, live
migration, runtime grant/write, gate, deployment or release changed. Unrelated
`docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched and unstaged.
This is **68% (17/25; +0 points)**, not a real-user completion claim.
