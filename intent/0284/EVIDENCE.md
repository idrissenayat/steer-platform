# Intent 0284 execution evidence

Status: bounded performance increment verified at the levels below; C22 remains pending.
Base: `92ce7b5aeec12e357d1ffa9e6c1d044cd010b125` (0283).

The private proof is wired through historical original authorization and scope
verification. It identifies an exact caller function, not a cached permission.
No current production identity resolver, OIDC checks, records binding or public
tool signature has changed. Overall remains 68% (17/25; +0 points).

## Verification

All 24 focused proof/forwarding/window/historical-scope tests pass (268 ms in the
final focused rerun). They cover pinned argument lists, preserved method receiver, exact function identity,
unknown/copied/wrong-caller fallback, unchanged source-policy and two full-read
counts, initial/final revocation, owner closure, nonvoid outcomes and late/premature
tracker behavior. Prototype and all eight package typechecks and the optimized
Next.js 16.3.4 build pass.

The default `--journey-runtime` selection passes all three joined checks plus
idempotent migrations. It retains six synthetic model calls/reservations, one
encrypted confirmation original, one fixed Temporal/native Git save and exact
older-commit reopen. Current records/Git-grant loss denies; lost HTTP, scheduler
and provider replies, replay and reconstructed identity/factory do not resend.
Only this run's disposable PostgreSQL container/tmpfs were removed.

Same 34-source new-distinct fixture, unchanged aggregate transport meters:

| Action | 0283 attempts | 0284 attempts | 0283 local ms | 0284 local ms |
| --- | ---: | ---: | ---: | ---: |
| Preview | 29,970 | 24,274 | 18,493 | 17,487 |
| Confirmation, discarded reply | 60,372 | 48,980 | 37,577 | 35,754 |
| Confirmation, reconstructed | 60,310 | 48,918 | 39,213 | 36,489 |
| Confirmation, repeated | 60,308 | 48,916 | 37,562 | 36,566 |

Preview removes 5,696 identity head reads; each confirmation removes 11,392.
Identity head counts are 23,713 for preview, 47,861 for first confirmation and
47,797 for reconstructed/repeated confirmation. Repository traffic is unchanged:
preview has 30 heads/178 commits/178 trees/172 blobs; confirmation has 60/356/356/344
(plus its ordinary token acquisition on reconstruction). The identity reader
still fetches the head on every actual lookup; each request loads its exact
authorization document once. No policy or decision outcome is cached.

Provider attempts fall about 19%; variable local timings improve much less and
are not a tail-latency result. Drafting-start attempts remain 41,768/47,350/47,350;
source review, scope preparation and final save review counts are unchanged.
The [new engineering benchmark](../../docs/INTENT-CAPTURE-PERFORMANCE.md) specifies
repeatable delay-bearing, cold/warm and concurrent acceptance. Its harness and
passing measurements remain future work; 35–37-second confirmations and roughly
49,000 attempts are not acceptable human UX.

The `--journey-runtime-continuation` selection also passes its one joined check
plus idempotent migrations, including original target/exact parent preservation,
one six-file native save, unchanged canonical/prior proposal files, exact old/new
reopen and denial/recovery checks. It keeps six synthetic reservations and one
original/save. Only its disposable PostgreSQL container/tmpfs were removed.

| Continuation action | 0283 attempts | 0284 attempts | 0283 local ms | 0284 local ms |
| --- | ---: | ---: | ---: | ---: |
| Preview | 30,504 | 24,808 | 19,680 | 18,177 |
| Confirmation, discarded reply | 61,440 | 50,048 | 40,509 | 40,752 |
| Confirmation, reconstructed | 61,378 | 49,986 | 39,564 | 38,618 |
| Confirmation, repeated | 61,376 | 49,984 | 38,946 | 38,016 |

The same 5,696/11,392 identity head reads are removed. Repository counts stay
unchanged: preview 30 heads/194 commits/194 trees/186 blobs; confirmation
60/388/388/372, with ordinary reconstruction token requests. First confirmation
is slightly slower in this single sample despite fewer requests. No consistent
latency speedup, p95 result or remote-load acceptance is claimed.

The `--development-history` selection passes ten checks plus idempotent migrations.
It includes multi-direction native previews, confirmation recovery, native save
and records-transition checks, recorded SDK roles, immutable historical scope,
source/key/profile/hold/identity denial, incomplete/quarantined outcomes, changing
role snapshots and final earlier-role authority revalidation. Only its disposable
PostgreSQL container/tmpfs were removed. The full SQL suite was not run.

Verification timing matters: the three SQL selections were launched before a
final compatibility correction that forwards the original callback's method
receiver. That correction does not alter proof membership or request accounting;
the actual joined factory uses arrow callbacks. The final focused receiver test
and fresh typechecks pass after it. The earlier SQL results are not represented
as a rerun of that final source revision. After the correction, all **1,382 broad
tests pass with zero failures/cancellations/skips/todo** (157,972 ms), along with
the focused tests, prototype/eight-package typechecks and optimized production
build. Broad regression ran after the heavy SQL selections, not concurrently.

Verification commands include:

```sh
node --test packages/data/test/historical-read-authority.test.ts packages/data/test/historical-scope-read-window.test.ts packages/data/test/development-scope-history.test.ts
node packages/data/test/postgres.integration.ts --journey-runtime
node packages/data/test/postgres.integration.ts --journey-runtime-continuation
node packages/data/test/postgres.integration.ts --development-history
pnpm typecheck
pnpm --filter @steer/web build
node scripts/validate-kit.mjs
node scripts/audit-workflow-scopes.mjs
git diff --check
```

The broad Node run covers all tool-registry, data, adapter, agent, API, worker,
web and domain test files plus package/migration-boundary tests, with four files
concurrent. The full SQL suite and separate revision/linked/first-amendment joined
selections were not rerun. The 95-required-artifact kit, contents-read-only workflow
audit and private-helper package-export check pass. Local Markdown links and the
fixed 25-checkpoint/17-verified tally were checked across the eight changed/new
Markdown files. Protected SHA-256 values remain unchanged:

| Artifact | SHA-256 |
| --- | --- |
| `intent/0001/ARCHITECTURE.md` | `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65` |
| `intent/0001/EXAM.md` | `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f` |
| `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md` | `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32` |

The API-key skill preserved the already-resolved credential decision and
synthetic-only verification boundary. No credentials, model spending, real
records/D1 adoption, live migration, runtime GitHub grant/write, gate, deployment
or release was changed. Unrelated `docs/REAL-USER-ROADMAP.md` and `outputs/` remain
untouched and unstaged. The local synthetic container/tmpfs removals described
above did not delete user data.

Progress remains **68% (17/25; +0 points)**. Next: reduce remaining repeated reads
and implement the documented latency-bearing benchmark. Neither roughly
49,000–50,000 confirmation attempts nor these single-run 36–41-second timings
satisfy its targets; live model, governed runtime and actual UI acceptance remain
separate unfinished checkpoints.
