# Intent 0285 execution evidence

Status: prefix harness and regression verified; performance acceptance remains incomplete.
C22 remains failed/incomplete, not a completed checkpoint.
Base: `b9586480824c9d7804c512eef8985b36feb3d01d` (0284).

This adds a test-only delay/attempt-budget probe and explicit authenticated prefix
selection. Production application source and authority/permission checks remain
unchanged. Overall remains 68% (17/25; +0 points).

## Recorded prefix, not full performance acceptance

The final captured `--journey-performance` run passes two **harness integrity**
checks plus idempotent migrations. Both directions report `prefixTargetsMet: false`
and `completeBenchmark: false`. [PERFORMANCE.json](PERFORMANCE.json) preserves all
raw samples and exact harness-file SHA-256 values against production base `b958648`.

Host: Apple M4 Pro / Mac16,8, 12 logical processors, 24 GiB RAM; macOS 26.6.2
(25G83), Node 24.19.0. Other host activity was uncontrolled. SQL selections were
sequential; typechecks could overlap a prefix run. Fixture seeding, runtime
construction and teardown are outside each sample. The measured invocation also
includes synthetic bearer creation before the in-process authenticated HTTP call.
The real service composition and encrypted SQL draft read are exercised.

| Direction | Warm reads, n=20 p95 | Reconstructed reads, n=3 max | Four concurrent reads, max | Source review |
| --- | ---: | ---: | ---: | --- |
| New-distinct | 848.39 ms | 832.81 ms | 849.91 ms | 401 after 204 attempts / 200 dispatches; 4,818.97 ms |
| Proposal continuation | 798.39 ms | 888.59 ms | 900.91 ms | 401 after 204 attempts / 200 dispatches; 5,025.92 ms |

Warm/concurrent draft reads each use 32 attempts; cold reads and the retained
primer use 33. All have zero work outstanding at return. The twenty-sample p95
uses nearest rank; small cold/concurrent groups are reported as maxima, not
population latency claims. The declared primer is retained separately, not hidden
as a failed outlier. Each direction has exactly one source-review probe.

The cap is shared by native Git authorization and repository-content traffic
within each call, not shared across concurrent users. It permits no more than 200
actual transport dispatches. Four later revalidation attempts are denied without
dispatch, giving 204 attempts. Source review fails closed when current identity
lookup cannot finish; it does not return duplicate clearance, newness, documents
or a save. Records/reservations and repository head are unchanged, with zero model
calls and zero provider saves.

The first exploratory run expected 503 and failed because the actual application
returns 401 for unavailable identity revalidation. The harness was corrected to
accept only 401/503 accompanied by its own measured limit flag and count evidence;
no production status mapping, authentication or authorization was relaxed. Two
subsequent prefix selections passed integrity checks; only the last captured run
is used in the table/artifact. Each run removed only its disposable PostgreSQL
container/tmpfs, not user data.

## Verification and remaining work

All seven focused probe/selector tests pass. They cover aggregate ceilings,
separate concurrent counters, aborted/unawaited/closed contexts, transport failure,
an undefined thrown value, invalid bounds, detached sanitized metadata and
nearest-rank percentiles that refuse failed/incomplete/undrained groups. Prototype
and all eight package typechecks and the optimized Next.js 16.3.4 build pass.

This is only a prefix: later scope/drafting/confirmation/save stages, their full
repeated/concurrent/negative benchmark protocol, per-origin attempt partitions,
issuer/JWKS replica latency, larger-corpus scaling and actual browser acceptance
are not covered. Delay applies to the synthetic native Git-provider transport;
the separate issuer/JWKS fixture is not delayed. No full external-provider latency
or real model-quality acceptance follows from these samples.

Next reduce repeated identity/corpus traversal in source review, then extend the
benchmark beyond its first failed boundary. Existing undelayed source review used
3,042 requests, predominantly identity grant lookups. This prefix makes the ceiling
executable without issuing thousands of delayed requests. A failed benchmark earns
no progress points.

The normal `--journey-runtime` regression passes all three joined checks plus
idempotent migrations with the probe disabled. It preserves six synthetic model
calls/reservations, one encrypted confirmation original and one fixed Temporal/native
Git save, lost-response recovery, current records/Git denial and exact older-commit
reopen. This fresh run also covers 0284's final receiver-compatible production code.
Default request counts are unchanged: preview 24,274; first/reconstructed/repeated
confirmation 48,980 / 48,918 / 48,916. Observed local timings are 16,420 ms and
35,155 / 33,851 / 33,786 ms respectively; no new optimization or reliable speedup
is claimed. Only that run's disposable PostgreSQL container/tmpfs were removed.

Full SQL, historical SQL and other full-disposition selections were not rerun
this increment. The performance prefix includes both directions, but must not
be represented as full proposal-continuation save verification.

Final broad regression passes **1,387 tests, zero failures/cancellations/skips/todo**
(148,996 ms). It ran after heavy SQL, with four test files concurrent across
tool-registry, data, adapters, agents, API, workers, web, domain and package/local-
migration boundary tests. The final seven focused tests pass (91 ms), as do fresh
prototype/eight-package typechecks and the optimized build.

Commands include:

```sh
node --test apps/api/test/intent-performance-probe.test.ts packages/data/test/integration-diagnostics.test.ts
node packages/data/test/postgres.integration.ts --journey-performance
node packages/data/test/postgres.integration.ts --journey-runtime
pnpm typecheck
pnpm --filter @steer/web build
node scripts/validate-kit.mjs
node scripts/audit-workflow-scopes.mjs
git diff --check
```

The raw artifact's six harness hashes match current files; all grouped statistics
were recomputed from its saved samples. The 95-artifact kit and contents-read-only
workflow audit pass. The three protected SHA-256 values match
[0284's recorded values](../0284/EVIDENCE.md). The fixed denominator remains 25,
with 17 verified; links and raw JSON are checked before commit.

The API-key skill preserved the resolved credential decision and synthetic-only
boundary. No production source, live issuer/repository load, model spend,
credentials, records/D1 adoption, live migration, runtime write authority, gate,
deployment or release changed. Unrelated `docs/REAL-USER-ROADMAP.md` and `outputs/`
remain untouched and unstaged. **68% (17/25; +0 points)**: next optimize source-review
identity/corpus traversal, then extend the failed/incomplete benchmark.
