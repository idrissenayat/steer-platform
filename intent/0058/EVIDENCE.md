# Development evidence

Baseline 54c5a753b9376445b8489177194a134823dd2036 plus this increment.
2026-09-05 UTC; offline Builder-authored candidate, not an independent ruling.

Six native correction groups pass. Tests show the frozen oracle accepts a changed
session with unchanged provider proof and accepts a proof recorded in 2000,
before its trusted key's 2026 activation. The successor rejects both. A newly
full-bound synthetic provider proof passes; subsequent session substitution fails
even with a new synthetic authority signature and matching CAS reservation.

The binding test mutates every authority field and confirms exactly the three
circular exclusions. Eleven omitted-field mutations fail against a retained full
proof. Freshly signed proofs cannot assert a different trust anchor or recording
time. Timed-verifier tests cover pre-activation, exact expiry, evaluation expiry,
revocation before evaluation, pre-revocation success, missing/invalid times,
wrong domain and duplicate registry selectors. No clock default is available.

All 17 prior authority cases run against a full-bound synthetic baseline and
retain expected ALLOW/DENY outcomes. Consumed evidence IDs and zero effects are
unchanged; source bytes are not rewritten. Synthetic test keys are derived and
kept module-private exactly for fixture domains; no real credential is accessed.

The full pnpm check exits 0: kit/security, typechecks, 88 prototype tests, 40
control/boundary/correction tests, package suites (domain 10, registry 48, data 20,
adapters 61, API 68, web 24, workers 18) and builds under Node 24.20.0 / pnpm
11.19.0. Frozen install, diff and exact remote publication are checked in the
handoff. No production module, browser, operational or qualified manual evidence
changed. Frozen-package integrity remains the full 0056 verification; this
increment changes no frozen or Exam file.

## Limitations

R5-002 is not fully corrected by this human-only increment. All other corrected
public oracles must adopt explicit provider/evaluation-time verification before
complete-package review. Qualification/assignment fixture records lack issue
timestamps; the candidate verifies as of decision/evaluation and their existing
validity-through evidence, without inventing an issuance history. The registry
is a trusted immutable composition snapshot, not a live revocation monitor.

Frozen review files/Exams remain unchanged. No human ruling, protected
incorporation, Gate 2, provider access, spending, deletion, release or deployment.
