# 0328 — Effect-separated preparation draft phases

Base: `58d567809475a932381b53a4c17af3fa6e4050b7`.

## Contract

1. The two constructed preparers use the existing private exact-method/config
   draft-read registration. No public input, service method, configuration,
   package export, permission or credential is added.
2. Initial source discovery and empty/incomplete early returns keep their ordinary
   reads. Each subsequent preparation recheck independently opens one draft phase
   enclosing the existing evidence window and all preparation/scope policies.
3. Both draft consumptions validate the selected revision/digests against the
   originally captured source. Each use runs fresh draft permission. After the
   evidence producer returns, the native owner compares key ID/bytes, full stored
   row, latest revision and current lifecycle/clock. No deadline renews.
4. Guard-only inner caller callbacks are confined to the exact preparer-owned
   store. Its metadata policies already freshly invoke the caller after each
   policy; key lookup keeps before/after caller checks. The preparer additionally
   checks its caller at phase entry and after final native verification.
5. Admission and original persistence run only after the preceding phase closes.
   A new phase follows each effect. Borrowed snapshots, key leases and permission
   decisions never carry across phases or requests; the immutable initial source
   remains a comparison target, not current authority. Existing timeouts, admission
   limits, actual-work tracking and close semantics remain.
6. A known source Conflict from dependent validation retains its classification
   through sanitized phase errors. Other failed final checks are unavailable
   before effects and unknown after an effect may have occurred. Never roll back
   immutable acknowledged work or claim readiness after failed validation.

## Verification

- Both native HTTP/SQL preparer suites, including existing unchanged ordinary
  evidence fallback, exact originals, parallel preparation, lost acknowledgements,
  source drift, current authority and expiry tests.
- Count exactly two draft key lookups per validation phase: initial during
  evidence work and final after evidence closure. Observe all three phases and
  both actual INSERT boundaries; verify no phase crosses either write.
- In each of three phases, successfully inject edit, hold, expiry, changed key,
  draft-grant loss and close after evidence closure. Require mutation-success
  assertions. Phase 1 leaves no admission; phase 2 leaves only admission; phase 3
  retains original/admission but never returns readiness. No model reservation.
- Both authenticated synthetic new-distinct and proposal-continuation journeys
  through corrected documents, exact confirmation, one fixed native save,
  uncertain/repeated recovery and exact reopen. These are not live GitHub saves.
- Focused/broad regression checks and typecheck, with exact results recorded in
  evidence. Full delayed C22 and browser/human acceptance remain separate.

## Performance and next constraint

Do not infer completion effort from test count, commits or key-read reductions.
The fixed C22 ceiling and complete protocol are unchanged. Measure all identity,
repository, token and retry traffic. If this only makes a small whole-action
improvement, report that and refresh current caller-chain attribution before
choosing another optimization; do not represent wrapper tuning as C22 closure.
