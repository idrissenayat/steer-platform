# Read-set lifetime: verified experiment, not installed

The final native combined selection passes the unchanged authenticated journey and
its combined-source/records negative checks. [Exact measurements](FEASIBILITY.json)
show **52 simulated provider attempts**, unchanged from 0301's final-source follow-up.
Elapsed-time validity adds no provider calls. Whole confirmation remains **7,637**.

The snapshot's earliest draft/candidate use deadline remains privately bound to
that actual object and its monotonic clock. Both first and final snapshots are
checked before/after caller and policy queries and before the combined return.
A later database clock reading cannot extend the first snapshot's lifetime. Copied
metadata is not a proof; expiry, invalid clocks and regressions latch a denial.
Database clock/time fields are validated before arithmetic, including rejection
of a clock regression within a snapshot. This avoids NaN comparisons that would
otherwise fail to enforce the expiry boundary in this test-only reader.

The native expiry case advances only its injected, run-local monotonic offset
after complete records readback. It asserts both reaching that exact point and
denial by the lifetime check. No host clock, records clock or real record is changed.
Post-record source revocation still rejects, as do prior key, owner, revision and
hold cases. The runner removes only its owned synthetic database/Git fixtures.

## Final observed scope

- Combined stage: 52 provider attempts (39 identity, one JWKS, 12 source repository),
  34 caller checks, 252 revision/path policies, 82 records policies and 136 retained-
  source policies; four role transactions / 34 SQL statements; two key calls.
- Two retained revisions / three contexts, 20 encrypted rows, four scope and two
  development SDK exchanges remain intact. Snapshot size: 607,629 bytes.
- Single local elapsed sample: 1,534 ms with no injected provider delay. This is
  not delayed p95, a UI action, or evidence that the installed application is faster.
- Fifteen focused snapshot/lifetime and diagnostic tests pass, no failures/skips/
  cancellations, 180.587958 ms. Exact deadline, earlier candidate expiry, copied
  proofs, invalid database timestamps and latched clock regressions are covered.
- Prototype and all eight package typechecks pass (five cached; 2.46 s), along
  with the 95-artifact kit check, workflow token-scope audit and diff check.
- An earlier native selection also passed at 52 attempts / 1,876 ms; it preceded
  the within-snapshot database-clock regression guard. The full focused selection
  was repeated on final source; only that final measurement is reported above.

No production source or runtime profile changed. This is elapsed validity, not
current hold/grant authorization, complete distributed lifecycle/authority atomicity,
independent production policy/key-provider integration, owner drainage or proof of
all effect-separated phases. Those remain in [0298's correction](../0298/REQUEST-BUDGET-PLAN.md).
The retained 0289 recovery failure remains unexplained; this is not asserted as its
fix. No signed artifact, user draft, roadmap/outputs, credential, real model call,
runtime GitHub write, records adoption, deployment or release changed.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).** Next bind
independent policy/key-provider and owned effect boundaries into the coherent
application read graph, then run the unchanged full C22 benchmark. Test-only
lifetime verification does not complete operational records or performance acceptance.

Final audit: six current source hashes, four protected hashes, 453 relative links
across the five controlling documents and selected plan/evidence files, the fixed
25-row / 17-verified checklist, provider-count arithmetic and diff checks pass.
