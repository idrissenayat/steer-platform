# Development evidence — 2026-09-09

Base: `62fcc03ab4e152c4e0959903337072f4413b65d4`.

The existing authenticated generation case now configures explicit synthetic
candidate policies and reuses the native destination authority through the full
production factory. The extension runs after existing restart/correction/history
and grant-denial checks. Scheduling, status/publication and write policies remain
unavailable. No service response or fabricated assessment replaces a real reader.

## Earlier failed runs and diagnosis

API type checking passes. The first extended run preserved prior generation and
recovery checks, rejected the old assessment for the corrected draft, and completed
two fresh scope batches. It then correctly returned 401 at final review when the
original three-minute synthetic identity expired (3,418 ms, 3,120 native requests
in that denied request). No failed run is claimed as successful.

The fixture now renews only its synthetic membership before final corpus capture
and can issue a fresh signed three-minute bearer for each later action. This does
not extend production expiry, change real membership or mutate reviewed Git state
between final review and confirmation. Existing short-lived fixture defaults are
preserved.

The second extended run passed final review/preview and preserved one encrypted
candidate original with two total operations and six synthetic model reservations.
After reconstruction, exact reconfirmation returned `unknown`, not `prepared`, so
the test failed and cleaned up its disposable data. This was not a successful
confirmation-recovery result. Per-request duration/native-read diagnostics were
added to distinguish deadline amplification from a binding mismatch; the next run
measured the independent confirmation deadline.

The third run measures current review at 3,603 ms / 3,973 native requests and
candidate preview at 44,646 ms / 129,330 requests. The first confirmation reaches
90,101 ms / 257,195 requests, matching its existing 90-second deadline. Repeated
composed verification is now a measured engineering failure, not a live-provider
problem or a reason to extend expiry/timeouts. See the [investigation](INVESTIGATION.md)
for the exact trace, call graph and repair boundaries. Reconfirmation after runtime
reconstruction likewise reaches 90,073 ms / 255,388 requests and returns `unknown`.
That test failed its unchanged `prepared` expectation and cleaned up its own
disposable PostgreSQL container/tmpfs data. No failing increment was committed or
pushed; 0273 at `62fcc03` remained the verified checkpoint during investigation.

After diagnosis, API types and 17 focused recorded-runtime/native-corpus/OIDC
regressions pass (7,989 ms), including strict expiry and current Git revocation.
Kit validation (95 artifacts), the read-only workflow scope audit, 202 local links
in the six changed/new documents and `git diff --check` pass. Protected
Architecture/Exam/accepted-retention hashes remain unchanged. These checks do not
override the failing joined confirmation test. No broad regression/build rerun is
claimed for that diagnostic stage.

## Corrected confirmation verification

The private historical-scope read window performs two full authoritative reads
around one read-only generation projection and rechecks current caller/source
authority on every intermediate reuse. See [the investigation](INVESTIGATION.md)
for the exact binding, final verification, cancellation and expiry boundaries.
It does not modify current assessment, admission, model preparation or deadlines.

The corrected `--journey-runtime` selection passes all three joined cases plus
idempotent migration verification, retaining the original 0271–0273 assertions.
The 0274 continuation rejects an old assessment after a Brief correction, records
two fresh scope batches, previews exact older generation/edited-document lineage,
then preserves one encrypted original after explicit synthetic human confirmation.
After discarding the first HTTP reply and reconstructing the real identity/factory,
the same command returns `prepared`; an identical third request returns the exact
same receipt and leaves the encrypted rows unchanged. Counts remain two operations,
one candidate original, two assessments and six synthetic model calls/reservations.
Candidate-policy revocation withholds preview; all three owned runtimes close.
No scheduling, publication or Git mutation occurs.

Preview falls from 129,330 to 39,550 synthetic native-provider requests. First
confirmation takes 46,926 ms / 79,532 requests; reconstructed and repeated
confirmation take 48,893 and 50,069 ms, below the unchanged 90-second bound.
Request amplification is reduced about 69%, not eliminated. These timings/counts
are still unsuitable as smooth-UX or live-provider performance evidence.

Nine new focused read-window tests pass, including every-use caller checks,
final records/key/profile denial, changed evidence/latest revision, target and
reader mutation, nonvoid checks, immutable detached values, monotonic historical
expiry, cancellation during final IO, overlapping/unawaited work and closed-port
reuse. API/data types and adjacent history contracts also pass.

The separate `--development-history` selection passes 10 checks plus idempotent
migration verification, including late identity/key/source/role loss, holds,
quarantine, changing source snapshots and complete assessed multi-batch lineage.
Its composed cases also exercise native candidate preview/confirmation and
Temporal save/reopen/publication. The independent `--candidate-journey` selection
passes its joined check plus migration verification: one fixed activity/native
save, lost acknowledgement recovery, no resend, exact older-commit reopen and
sticky-hold publication denial. Each runner removes only its owned disposable
container/tmpfs data. These are focused selections, not the full SQL suite.

Final broad regression: **1,341 tests pass**, zero failed/cancelled/skipped,
145,019 ms, with concurrency four. Prototype and all eight package typechecks
pass; unchanged package checks may use Turbo's local cache. The optimized Next
production build passes. The 95-artifact kit, read-only workflow scope audit,
210 local links in seven changed/new documents and `git diff --check` pass.
Protected Architecture/Exam/accepted-retention hashes remain unchanged. The
user-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched and excluded.

## Boundaries

Synthetic model responses are executed through recorded SDK steps directly, not
Temporal. The lost confirmation response is a client-observation simulation, not
a new SQL commit-failure test. Real persistence/D1, model/provider/write authority,
remote-provider latency and signed-in I1–I6 acceptance remain outstanding.
