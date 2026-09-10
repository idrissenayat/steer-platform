# 0321 — Exact caller identity in shared source review

Base: `9346b93e451616cb8a5c9b1017f57503f2e4d902`. See [Brief](BRIEF.md),
[Spec](SPEC.md) and [machine-readable verification](VERIFICATION.json).

The private constructed review session now carries one immutable owner-guarded
function when parent and child provide the identical original caller. The source
owner invokes that function once at the same boundary. There was no intervening
IO or policy between the duplicate calls. Independent, wrapped, bound and
marker-copied callers remain independent; unregistered readers keep their fallback.
No principal, grant, source or authorization result is cached.

Fresh caller checks around each real read, every source policy, complete final
draft/evidence comparison, method/scope/admission guards and actual pending-work
drainage remain. Counting tests preserve three draft reads, two evidence reads
and four source policies; only duplicate caller invocations disappear. Added
cases reject changed caller/owner/method, nonvoid results, escaped callbacks and
revocation during draft IO, evidence IO, final corpus closure or between reads.

## Measured result

| Authenticated synthetic action | Before | After |
| --- | ---: | ---: |
| Save review, either direction | 211 | 174 |
| New-distinct preview | 330 | 293 |
| New-distinct confirmation / recovery / repeat | 853 / 825 / 823 | 779 / 751 / 749 |
| Continuation preview | 440 | 403 |
| Continuation confirmation / recovery / repeat | 1,073 / 1,045 / 1,043 | 999 / 971 / 969 |

Save review removes 37 attempts (17.54%) and falls below 200 in this sample.
Scope preparation/start, drafting preparation/start and other measured actions
are unchanged. The verification file records all 17 measured actions in each
direction, including identity/token attempts. Undelayed shared-host timings do
not establish warmed p95, browser speed or live-provider acceptance.

## Verification and boundaries

Final source passed 60 focused tests, all 1,553 broad tests (341,415.712209 ms,
zero failures/skips/cancellations), prototype and eight package/application
typechecks, the 95-artifact kit and read-only workflow-token audit. Native
preparation passed 17 checks, new-distinct three joined checks and continuation
one joined check, each plus idempotent migrations. Focused tests overlap broad
tests; these are not the full PostgreSQL suite, build or browser verification.

Both authenticated native journeys retain lost-reply and restart recovery, one
fixed synthetic save, exact older-commit reopen and current policy/Git denial.
The existing scope/original closure and actual shutdown-drain cases also pass.

No paid model calls, real runtime GitHub artifact saving, records/profile
activation, deployment, release, live-record deletion or signature occurred.
Cleanup was limited to each synthetic harness's own containers and tmpfs data.
Protected architecture, Exam, retention policy and prior performance evidence
are unchanged; the user's roadmap and outputs remain untouched. These results
do not explain or replace the retained 0289 recovery failure.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
C22 remains pending: remaining preparation/start/confirmation paths must meet
the unchanged 200-attempt ceiling before the full 20-warm/3-cold/4-concurrent
protocol in both directions, 20 ms per attempt, five-second p95 and negatives.
Real model quality, governed activation and signed-in UI/save acceptance remain
separate requirements. No completion date is inferred from this partial fix.
