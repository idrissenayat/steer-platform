# Intent 0282 execution evidence

Status: verified synthetic integration; C09 complete. Actual live/UI acceptance remains open.
Base: `15f5158b1419a4e62f4628345e16b2254ea56d3f` (0281).

The joined fixture now accepts first-amendment for a reviewed canonical item.
This scenario seeds a canonical Exam and hidden context before its snapshots,
and checks independent drafting, current target/authority, six create-only save
paths, preserved prior blobs, proposal pointer binding and exact target-preserving
reopen. Production source and authority are unchanged.

All six focused choice/selector/diagnostic tests pass, including rejection of
missing, ambiguous, noncanonical or versioned first-amendment targets. Prototype
and all eight package typechecks and the optimized Next.js 16.3.4 build pass.
The `--journey-runtime-amendment` selection passes its one joined authenticated
check plus idempotent migrations. The same 34-source journey completes both
scope workflows, separate recorded drafting roles, human correction, exact
reassessment/confirmation and fixed Temporal save/reopen. Current source denial,
wrong digest and lost acknowledgements remain fail-closed. One encrypted original,
six synthetic model calls/reservations and one candidate-save commit survive replay
and runtime reconstruction.

The actual six-file plan is create-only and does not include any pre-existing
path. All prior canonical Brief/Spec/Exam and hidden-context blob OIDs/modes remain
unchanged at the save commit; the new item blobs are exactly the planned proposal
files. The pointer retains the reviewed target, has no prior parent, and does not
create or alter CANDIDATE.json. Exact reopen after a later simulated external
Brief edit retains the saved proposal's original target. Current read-policy and
Git-grant denial pass without another scheduling attempt, original or commit.
Only this run's disposable PostgreSQL container/tmpfs were removed. This is not
the full SQL suite, live GitHub or signed-in UI acceptance.

Synthetic preview: 30,008 requests / 18,523 ms. First confirmation with discarded
reply: 60,448 / 37,588 ms. Reconstructed/repeated confirmation: 60,386 / 38,410 ms
and 60,384 / 38,736 ms. No performance improvement or acceptable live-load claim.
The default `--journey-runtime` new-distinct regression also passes all three
joined checks plus idempotent migrations, including the final native save/reopen,
current read-policy/Git-grant denials and restart/replay without resend. Its
synthetic preview uses 29,970 requests / 20,481 ms; discarded/reconstructed/repeated
confirmation uses 60,372 / 39,030 ms, 60,310 / 37,753 ms and 60,308 / 37,575 ms.
An earlier process's final output was unavailable; this is the completed rerun,
not an inferred result. The broad regression ran separately from heavy SQL
verification: **1,372 passed, zero failed/cancelled/skipped/todo**, 153,777 ms.
The full SQL suite and prior revision/linked selections were not rerun.

Verification commands include:

```sh
node --test apps/api/test/authenticated-journey-direction.test.ts packages/data/test/integration-diagnostics.test.ts
node packages/data/test/postgres.integration.ts --journey-runtime-amendment
node packages/data/test/postgres.integration.ts --journey-runtime
pnpm typecheck
pnpm --filter @steer/web build
node scripts/validate-kit.mjs
node scripts/audit-workflow-scopes.mjs
git diff --check
```

The broad Node test command covers all tool-registry, data, adapter, agent, API,
worker, web and domain test files plus package/migration-boundary tests, at four
concurrent test files. The 95-required-artifact kit and contents-read-only workflow
audit pass. All 277 local links resolve across the seven changed/new Markdown
documents; the tracker independently contains 25 unique checkpoints, 16 verified.
Protected Architecture, Exam and accepted candidate records-policy
SHA-256 values remain unchanged:

| Artifact | SHA-256 |
| --- | --- |
| `intent/0001/ARCHITECTURE.md` | `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65` |
| `intent/0001/EXAM.md` | `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f` |
| `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md` | `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32` |

No production source, credential, live migration, records/D1 adoption, runtime
GitHub permission/write, model spending, gate, deployment or release was added.
Unrelated `docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched and unstaged.

Progress is **64% (16/25; +4 percentage points)** after verifying C09. Next: C10,
authenticated proposal-continuation save/reopen. The denominator is unchanged;
tests and documentation earn no independent points. Live model quality, acceptable
latency, governed activation and signed-in human acceptance remain pending.
