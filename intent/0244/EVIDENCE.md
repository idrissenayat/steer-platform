# Development evidence — 2026-09-08

Base: `f58c47c9542d0efd98caf3dc1e76e6c60536e247`.

## Implementation and observed integration

`intent.scope.prepare` is a strict current-human command in the shared registry
and authenticated HTTP API. It restores the exact latest saved draft, excludes its
Exam, rechecks independently collected evidence and prepares one immutable scope
review plus encrypted original. An explicit API composition joins the actual
repository-wide collector to this service. Neither factory is installed by default.

The thirteen new HTTP/SQL integration cases exercise:

- Exact 34-source/two-batch preparation, encrypted readback and same-reference
  replay after service recreation, with no reservation or model dispatch.
- Four concurrent preparations converging on one review and immutable original.
- Lost admission and encrypted-original commit acknowledgements, recovering the
  same identity and retained bytes without renewed expiry.
- Empty, entirely missing, partially missing and inaccessible source coverage,
  preserving gaps and never asserting uniqueness.
- Missing/agent/foreign identity, denied grants and caller-injected source,
  profile, budget, review ID and batch-list fields.
- Stale saved revisions/snapshots and repository evidence changing during work.
- Current records/key/preparation denial, nonvoid approvals and mismatched profiles.
- Post-admission grant revocation concealing the response, followed by authorized
  exact replay rather than duplicate admission.
- Human edits or a durable hold after admission, preventing original capture
  while retaining immutable metadata.
- Expiry and attempts to renew the original execution configuration.
- Actual native-Git discovery through the recorded GitHub reader into encrypted
  SQL, exact evidence reopen and exclusion of the repository Exam.
- A changed native-Git head or lost corpus authority before admission.
- Expiry during the final awaited preparation-authority check, withholding
  readiness without deleting the already preserved original.

The final expiry guard was added during implementation review: a check before
asynchronous final authority work was insufficient to guarantee unexpired readiness
after that wait. The added real-clock regression passes with no longer deadline,
renewed expiry or fabricated authority.

Native Git objects, SQL roles/transactions/encryption, the authenticated request
path and source collector code are real. Identities, records/product/lifecycle
grants, keys, budgets, App token and GitHub transport are synthetic. No real GitHub
repository or model provider was called by these tests; native Git writes exist
only inside each test's disposable object database.

## Verification

- Full regression: **1,068/1,068 passed**, including six new contract/registry and
  preparation-admission unit cases. The focused 16-case unit/dependency run passes
  and overlaps this total.
- Final full PostgreSQL 16.14 integration: **309/309 passed**, including all thirteen
  new preparation cases and the existing actual scope/development/save Temporal
  cases. All 28 existing migrations apply idempotently. An earlier full run passed
  308 checks before the final expiry guard/test; it is not the final total.
- An earlier focused `--scope-runtime` run passed 35 scope checks plus idempotent
  migrations, before the native-Git and final expiry cases were added. This focused
  diagnostic overlaps full-suite coverage and is not a full or final-suite total.
- Prototype and all eight package typechecks pass after the final code change.
  Optimized Next.js 16.3.4 build and existing Drizzle migration-history checks pass.
- Kit validation (95 required artifacts), workflow token scope audit and whitespace
  checks pass. No dependency, table or migration was added.
- The local document links resolve. Test harnesses removed only their own native
  Git temporary object databases and synthetic PostgreSQL container/tmpfs data;
  no real application records or repositories were deleted or migrated.

## Boundaries and next work

The API command prepares input only: it does not start Temporal, reserve budget,
call a model, choose disposition, draft documents, save Git or sign a gate. A ready
receipt means an exact original was preserved, not that search is semantically
complete. Partial reviewable input retains `plannedComplete: false`; empty or
entirely unavailable input admits no unnecessary model work.

Continue an authorized start/recovery API over the retained original and exact
workflow identity, then connect the actual editor's review/progress/recovery. The
starter must verify current records/source/model authority and namespace retention,
and reconcile a lost scheduling response against exact retained start input rather
than accepting a same-ID foreign workflow. Existing recorded-SQL findings, not
Temporal completion alone, remain the source of result truth.

Real authority, larger-corpus context, expired observation access, semantic
evaluation and I1–I6 human save/reopen acceptance remain open. No frontend/auth
bypass, alternate preview, real migration, D1 adoption, credential provisioning,
paid model call, runtime Git save, gate, deployment or release occurred. The API-key
skill preserved the resolved credential decision without inspection or recreation.
D1 is unsigned/inactive and the first-test model budget is unapproved.

Protected source SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

User-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` are excluded. The existing
one-minute implementation loop remains active.
