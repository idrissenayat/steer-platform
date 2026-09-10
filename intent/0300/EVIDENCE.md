# Native records experiment: verified, not installed

The final focused selection passes the unchanged authenticated native journey,
then the bounded records experiment and its negative cases. Source hashes and
exact counts are in [FEASIBILITY.json](FEASIBILITY.json). No production source or
runtime configuration changes; whole confirmation still costs **7,637 attempts**.

## Observed records portion

| Measurement | Final observed value |
| --- | ---: |
| Encrypted records decoded once | 20 |
| Scope / development SDK exchanges | 4 / 2 |
| Provider attempts, including OIDC/Git bootstrap | 22 |
| Fresh caller validations | 16 |
| Role-scoped SQL transactions / statements | 4 / 34 |
| Distinct physical keys / key-provider calls | 1 / 2 |
| Fixture record-policy / retained-source checks | 82 / 136 |
| Encrypted snapshot JSON bytes | 607,627 |
| Local elapsed sample, no injected network delay | 121 ms |

Provider traffic is 17 fresh head lookups, one commit, tree, grant blob and token
request each, plus one JWKS request. No source/model/provider mutations are emitted
by this records experiment. The preceding unchanged journey performs its existing
six synthetic model calls/reservations and one native Git mutation.

The 15 collected groups contain 40 row projections. The latest-revision metadata
projection repeats a draft row already represented among the two encrypted draft
revisions; it is not another encrypted record. Other groups cover two scope originals,
eight scope observations, one development original, two results, four development
observations, one candidate original, two operations, three steps, two scope runs,
four batches, six reservations, one budget and one scope-terms record.

The actual deterministic renderer reconstructs both development prompts from the
retained source and Architect predecessor. Actual envelope codecs, domain hashes,
scope/development SDK verifiers and confirmation-bound bundle planning execute.
All rows/lifecycle are freshly reread and compared; key bytes are fetched again.

## Verification and failure handling

- Final native selection: idempotent migrations plus the unchanged joined journey
  and records assertions pass. Late fixture-policy denial, changed key bytes,
  foreign subject, a newly appended draft revision and a new hold all reject.
  The final negative checks assert that each intended state change actually ran;
  an unrelated earlier failure cannot count as successful coverage.
- Six snapshot/control tests, five diagnostic-selection/trace tests and six existing
  renderer tests: **17 pass**, zero failures/cancellations/skips, 5,176.494 ms.
- Prototype typecheck and all eight package typechecks pass; five package results
  are cached, 2.434 s for the package run. Kit validation (95 required artifacts)
  and workflow token-scope audit pass.
- Initial scaffold import/type/syntax failures were corrected. An initial native
  attempt rejected the aggregate query; scope reservations must use their actual
  `operation_id`, not a nonexistent `review_id` column. A following run caught the
  missing confirmation in candidate input-digest reconstruction. Both are corrected;
  the final run passes without bypassing either check. The preceding successful
  experiment measured 22 attempts / 125 ms; it preceded stronger negative-trigger
  assertions and is not the final-source verification sample above.
- The runner cleaned up only its own disposable PostgreSQL container/tmpfs and
  native Git fixture. Signed Architecture/Exam/retention policy and the retained
  0289 failure artifact retain their exact hashes. User roadmap/outputs are untouched.

Final audit: 14 recorded source hashes, four protected hashes, 430 relative links
across the five controlling documents and this package, unchanged 17/25 tracker,
and provider/row-count arithmetic pass. `git diff --check` is clean.

## What this does not prove

This is a **records portion**, not a 22-request confirmation or a 121 ms user action.
Policies are synthetic fixture callbacks; production per-purpose records/source
authorities are not integrated. A single fixture key is not proof that independent
key providers can share an authorization boundary. HTTP registry, owner drainage,
all outer callbacks and write-separated phases remain open. Full SQL, broad build,
delayed/warm/cold/concurrent C22, browser, live-model and real GitHub runtime acceptance
were not run or claimed. Production activation and the proposed records allocation
remain unaccepted.

**Progress: 68% (17/25; eight remaining; +0 points).** Next complete combined
corpus/records/outer-boundary feasibility, then one coherent production correction
and the unchanged full benchmark. Follow [0298](../0298/REQUEST-BUDGET-PLAN.md);
do not resume isolated production optimizations or infer a new completion date.
