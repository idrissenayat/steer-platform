# Development evidence — 2026-09-08

Base: `f441515e8225c1becf323b6c2d7085aab5984876`.

## Implemented

Metadata-only exact preparation, durable review/batch ownership, default-inactive
scope cost terms and atomic reservations against the shared model cap. Dispatch
requires a newly committed transition plus current authority, never an inspection
or replay. No success checkpoint is exposed before encrypted result integration.

## Verification

**1,036/1,036** combined registry/data/adapter/agent/API/worker/web/domain and
package/migration-boundary tests passed on Node 24.19.0. The focused manifest and
boundary run also passed **14/14**. Metadata preparation verifies exact multi-batch
identity and excludes private text; invalid/empty manifests, source changes, extra
caps, borrowed owners and invented checkpoint commands are rejected.

**222/222** disposable PostgreSQL checks passed on PostgreSQL 16.14, including
**13 new scope-review checks**: forced RLS and restricted/default-inactive terms;
concurrent/restarted admission; atomic claims and single dispatch; fenced takeover;
lost admission/claim/dispatch acknowledgements; both-direction and concurrent
cross-role cap contention; missing/inactive/changed cost terms; post-commit current
authority loss with no leased connection; foreign/stale/expired inputs; SQL rejection
of private extras, forged success, rewritten bindings and resets; wrong-role
reservation rejection; and timed-out authority admission/drainage. Existing recorded
development, encrypted originals, native-Git fixture and Temporal paths remain green.
Both new migrations were applied only inside this disposable database; the harness
checks migration replay. Cleanup removed only each run's own synthetic container
and tmpfs data, never operational records. An earlier run caught an obsolete
two-table assertion; updated assertions cover all three usage/four execution tables
and retain forced-RLS checks. The subsequent full run passed.

Prototype plus all eight packages pass typecheck. Optimized Next.js build,
Drizzle migration-history check, kit validation (95 required artifacts), workflow
token-scope audit and whitespace checks pass. The real-local migration hold still
rejects these unadopted migrations before private-state/database access.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits

The adapter is uninstalled. Authority, budget approvals and source records in tests
are synthetic. No real database migration, retained record, key, permission,
provider/model call, runtime Git write, gate, deployment, release or spending was
enabled. D1 is unsigned/inactive and the first-test budget remains unapproved.
The API-key skill preserves the already resolved credential decision.

Next: encrypted scope observations/results, verified successful recovery and
reference-only Temporal execution, real source/lifecycle authority, larger-corpus
context and semantic quality, then authorized UI save/reopen and I1–I6 acceptance.
