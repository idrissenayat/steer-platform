# 0325 — Exact-parent current-read policy composition

Base: `a8743a5e8e740d2384ed78bec811976b57b4fa4c`.
[Brief](BRIEF.md), [Spec](SPEC.md), [verification](VERIFICATION.json).

The private current-read construction now preserves a permission-only policy
separately from its exact caller. When two server-owned policies share the same
parent, both policies execute freshly, followed by one fresh parent check and
both owner guards. Current-scope forwarding preserves that construction identity;
unknown, bound, copied, historical and differently parented callbacks keep their
full ordinary behavior. The drafting owner registers all current record, source,
operation, selected-record and key-purpose checks, not just a caller function.

The already-authenticated original phase also retains the explicit metadata query
through scope-binding validation, avoiding restored pre-policy caller traversal.
No policy outcome is cached. This composition is limited to permission-only work
inside a read-only phase; it does not cover content/key lookup, SQL mutation or
scheduling. Full development records/keys still finalize before complete current
scope records/keys, with new phases around scheduler effects and actual drainage.

## Measured effect

The first implementation measured 524/596/596 drafting-start attempts, versus
552/628/628 at 0324. Keeping the explicit source query through binding validation
improves the final implementation further. Both final native directions report:

| Drafting action | 0324 attempts | 0325 attempts | Reduction |
| --- | ---: | ---: | ---: |
| Initial start | 552 | 458 | 94 (17.03%) |
| Lost-reply recovery / repeat | 628 / 628 | 521 / 521 | 107 (17.04%) each |

All other sampled counts are unchanged: scope start 195/221/221, drafting
preparation 532/487, final review 162, new-distinct preview/confirmation 277/709
and continuation 387/929. Both native key families retain six physical reads over
three effect-separated phases. Final scope key comparison follows development
records/keys, including late-denial and held-key-drain scenarios. All identity,
repository and token attempts remain included. These actions still exceed 200.

The eight new unit checks cover exact-parent composition and ordinary-call parity,
generic/copied/bound/history/different-parent fallback, denial/nonvoid/revocation,
late owner closure, actual held-policy drainage, pinned arguments, nested policy
composition, projection purpose order and caught-failure poisoning.

## Final verification

Final focused selection: **58 passed**, no failures/skips/cancellations, in
806.11325 ms. Final typecheck: prototype and all eight apps/packages pass.
Final native drafting-start selection: **nine checks plus idempotent migrations**.
Both final authenticated journeys pass: three default joined checks and one
continuation check, plus idempotent migrations. These retain one fixed native
synthetic save, lost-response/restart/replay recovery, exact old-commit reopen,
current grant denial and preservation of prior/canonical/proposal-target files.
The final broad suite passes **1,576 tests** in 368,643.897584 ms with zero
failures/skips/cancellations. The kit validates 95 required artifacts and the
workflow token-scope audit passes. Eleven source/protected hashes and 34 native
action samples are in the verification artifact. Focused/broad tests overlap;
the native selections are not the full PostgreSQL suite. Build/UI and the full
delayed C22 protocol were not run.

An initial focused run failed two checks because a data import was not exported
and crossed the API helper boundary. Composition was moved through the existing
server-root seam and injected into the helper; no architecture allowlist or
package export path was added. The corrected focused runs pass. Intermediate
native runs and an intermediate 1,576-test broad run also passed, but do not
replace final-source verification.

A read-only baseline attribution run completed its joined test. Bounded terminal
capture retained only 11 complete attribution JSON records, so it is not used as
a whole-run traffic total. The complete 0324 sample baseline remains authoritative
for before/after counts. Neither profiling nor concurrent undelayed test timing
establishes warmed p95, live UI speed or a C22 pass.

**Progress remains 68% (17/25; eight remaining; +0 percentage points).**
No live model calls/spending, runtime GitHub artifact writes, records activation,
deployment/release, signatures or deletion of real data occurred. Tests clean up
only their owned disposable data. Protected artifacts, the unresolved 0289
recovery observation and the user's untracked roadmap/outputs are preserved.

Next consolidate remaining draft/original preparation and confirmation work with
independent purpose grants and full effect-separated closure, then execute the
unchanged all-action 20-warm/3-cold/4-concurrent performance protocol. Real model
quality, governed live save/reopen and signed-in human UX acceptance remain open.
