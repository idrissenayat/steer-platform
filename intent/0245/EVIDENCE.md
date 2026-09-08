# Development evidence — 2026-09-08

Base: `a467752b05e4e5558c60a762125bc885ac8dabe1`.

## Implementation and observed integration

`intent.scope.start` is a strict current-human command in the shared registry and
normal authenticated HTTP API. The explicit data factory restores an exact retained
encrypted review original and current draft/manifest, then requires current
execution authority. The explicit scheduler binds namespace and queue and verifies
the initial event for the described workflow run before acknowledging recovery.
Neither factory is installed by default. The existing internal starter is unchanged.

Six new HTTP/SQL integration cases cover exact source binding, read-only scheduling,
missing/foreign grants and inputs, stale source, draft holds/corrections, lost
acknowledgement, current authority/key loss and sanitized failures. Four new actual
Temporal compositions cover:

- Exact preparation replay into start, a lost start response, same-run recovery,
  recorded SDK execution of two batches, SQL findings readback and completed-run
  recovery after scheduler/API reconstruction without another reservation or call.
  This test reuses an admitted original; initial admission is covered in 0244.
- A same-ID workflow with foreign preparation input or a retrying workflow policy,
  neither accepted nor replaced.
- Concurrent independent API/scheduler requests converging on the same Temporal
  run and two total batch reservations/calls.
- Expired reviews and draft corrections during authorization preventing actual
  Temporal creation and model reservations.

Thirteen new unit cases cover portable contracts/registry authorization, data-service
admission and timeout drainage, scheduler retention, exact input/history recovery,
malformed payloads, foreign policy, fixed namespace and late authority changes.
Workflow acknowledgement never grants semantic completion, execution, retry, save
or gate authority. Existing reader verification remains the result boundary.

HTTP, PostgreSQL roles/transactions/encryption, Temporal server/client and recorded
SDK code are real. Identities, lifecycle/records/execution grants, keys, budgets and
model responses are synthetic. No live model/provider/repository is called.

## Verification

- Focused `--scope-runtime`: **48 runtime checks passed**, plus idempotent migration
  checks. These overlap the full suite and are not live UI acceptance.
- Full regression: **1,081/1,081 passed**, including thirteen new unit cases.
- Full PostgreSQL 16.14 integration: **319/319 passed**, including six new HTTP/SQL
  start cases and four new actual Temporal compositions. All 28 existing migrations
  apply idempotently. Focused results overlap this full total.
- Prototype and all eight package typechecks pass. Optimized Next.js 16.3.4 build
  and the existing Drizzle migration-history check pass.
- Kit validation (95 required artifacts), workflow token scope audit and whitespace
  checks pass. All 134 checked local document links resolve. No dependency, table
  or migration was added.
- Integration harnesses removed only their own synthetic PostgreSQL container,
  tmpfs data and native-Git test objects. No real application data was migrated or
  deleted; the isolated Temporal processes also shut down.

Protected source SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Boundaries and next work

Continue actual editor scope preparation/start/read/progress/recovery, real
authority, larger-corpus context, expired observation access, semantic evaluation
and I1–I6 human/save acceptance. A completed workflow is not a duplicate verdict,
uniqueness claim, disposition choice or permission to draft/save.

No frontend/authentication bypass, alternate preview, real records migration, D1
adoption, credential inspection/provisioning, paid model call, runtime Git save,
gate, deployment or release occurred. The API-key skill preserved the resolved
credential decision. First-test spending remains unapproved. User-owned
`docs/REAL-USER-ROADMAP.md` and `outputs/` are excluded; the existing one-minute loop
remains active.
