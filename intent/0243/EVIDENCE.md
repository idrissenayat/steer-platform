# Development evidence — 2026-09-08

Base: `b6231ddcd02fcdb91772fe53d23a40be4704e4dd`.

## Implementation

The dedicated, uninstalled scope worker now sequences the actual encrypted-SQL /
recorded-SDK runner through Temporal. A planning activity restores the verified
admitted manifest under current authority; callers supply only organization, review
and preparation references, never their own batch list. Up to eight batches run
sequentially. History and heartbeat payloads do not carry original text, findings,
prompts, credentials or grants. The final outcome explicitly distinguishes an
attempt finishing from semantic coverage, uniqueness or authorization.

Planning and execution share the runner's active/draining slot. Strict activity
identity binding, cancellation, bounded deadlines, one-attempt activity policies
and duplicate-start rejection are explicit. Existing SQL checkpoints recover
without a new model call or reservation. Sent/uncertain work cannot automatically
retry or advance to another batch. No public start/recovery API is installed.

## Focused integration

`pnpm --filter @steer/data test:integration --scope-runtime` passed **25/25 scope
checks**, plus the existing idempotent-migration check. This is a focused command,
not the full integration suite. Its results overlap the full totals below.

The scope checks include 14 existing runner cases, two new read-only planning
cases and nine new actual Temporal cases. Planning verifies the exact two-batch
manifest for 34 source records without SQL mutation, budget reservation, gateway
validation or model calls. Denied identity, changed sources and expiry expose no
dispatchable batch list.

The Temporal cases exercise:

- Sequential manifest-driven execution, SQL reader recovery, history replay,
  worker recreation and duplicate rejection, including changed preparation input.
- Recovery of a previously completed SQL batch without a second model call.
- Human correction during a call, preserving the historical checkpoint while
  stopping further work as superseded.
- An uncertain provider response: the workflow can complete with attention
  required, but does not resend or report a successful review.
- Holds, newer edits or expiry after queueing but before planning.
- Wrong workflow identity and foreign references before records/model access.
- Cancellation during planning and after model dispatch, with late work drained
  and no late success or automatic resend.
- Loss of authority during the final planning recheck, before batch references
  are released.

Actual Temporal histories are inspected for absence of synthetic private-source,
Exam, findings, prompt, credential, ciphertext and private-error markers. Temporal
CLI 1.8.3 / Server 1.31.2 runs isolated with in-memory persistence. SQL, encryption,
SDK code, transactions and workflow replay are real; identity/source/records
grants, keys, budgets, provider transport and model responses are synthetic.

## Final verification

- Full regression: **1,062/1,062 passed** on Node 24.19.0. The eight added unit
  cases cover pure reference/result contracts, the internal starter, runtime
  binding, redaction, cancellation/deadlines and shared planning/execution drainage.
- Full PostgreSQL 16.14 integration: **296/296 passed**, including all 25 scope
  cases and the existing development/save Temporal cases. The 28 existing
  migrations remain idempotent; no new migration was added.
- Prototype and all eight package typechecks pass.
- Optimized Next.js 16.3.4 production build passes. No frontend, authentication,
  preview or installed runtime binding changed in this increment.
- Drizzle migration-history check, kit validation (95 required artifacts),
  workflow token scope audit and `git diff --check` pass.
- Disposable integration resources were closed; the PostgreSQL harness reports
  removal of only its own synthetic container/tmpfs data. No integration container
  bearing the test label remained at final inspection.

## Boundaries and next work

Reviewed-source preparation, authorized start acknowledgement and lost-response
recovery, namespace-retention verification, actual editor binding and expired
observation access remain open. Continue those integrations, then real authority,
semantic evaluation and I1–I6 signed-in human/save/reopen acceptance. A trusted
internal starter or synthetic structural finding is not live acceptance.

No real database migration, D1 records activation, credential inspection/provisioning,
paid model call, runtime Git save, gate, deployment or release was enabled. The
API-key skill preserves the resolved credential choice without exposing or
recreating keys. D1 remains unsigned/inactive; the first-test model budget remains
unapproved. The existing one-minute implementation loop remains active.

Protected source SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

User-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` remain outside this increment.
