# 0315 — Preparation and scope-start authority evidence

Date: 2026-09-10. Base: `cfacfce495132dd7dd832d9fc2547d69142acb5e`.
Contract: [Spec](SPEC.md). Exact checks/samples/hashes: [verification](VERIFICATION.json).

## Delivered

Both preparers and the scope starter now use the established metadata-only
read-policy helper. Every explicit read permission runs, followed by fresh caller
validation before SQL or continuation. Initial action authentication remains.
There is no principal, grant or result cache. Invalid/nonvoid policies, revocation
and close block continuation; actual held callbacks retain admission after timeout.

Keys, content/evidence, preparation approval, admission, original puts and scheduling
retain full barriers. Preparer operation policies are unchanged because their
contract does not distinguish inspection from mutation. Development start already
uses this helper and is unchanged. All separate read/effect phases, exact source
comparisons, public response shapes, deadlines and limits remain.

## Measured effect

| Synthetic authenticated action | 0314 attempts | 0315 attempts |
| --- | ---: | ---: |
| Scope preparation | 320 | 292 |
| Scope start / recovery / repeat | 596 / 676 / 676 | 406 / 460 / 460 |
| Drafting preparation / repeated preparation | 594 / 548 | 532 / 487 |
| Drafting start / recovery / repeat | 1,407 / 1,594 / 1,594 | 1,407 / 1,594 / 1,594 |

First scope start removes 190 attempts (31.88%). Save review remains 211;
new-distinct preview/confirmation remain 330 / 853 and continuation 440 / 1,073.
All these actions remain above 200. Counts include identity and token requests.
Undelayed functional samples on a shared host are not p95, the complete C22
warm/cold/concurrent protocol, live-provider performance or actual UI acceptance.

## Verification and corrected test instrumentation

The final focused run passes 36/36, including six new policy-order, repeated-use,
revocation/nonvoid/rejection/closure and held-policy drainage cases. Native
development preparation passes 17 checks plus migrations; scope preparation passes
18 plus migrations. Broad package/application regression passes 1,526/1,526 before
the final test-selector additions, which are covered by the final focused run.
Both authenticated
synthetic journey directions pass: three default joined checks and one continuation
check, each plus migrations, including save, restart, lost reply/acknowledgement,
recovery and exact reopen. Authority/model inputs are synthetic.

An expanded scope-runtime run initially failed in its older body-count observer:
the observer replaced `reader.readArtifact` after the actual application's owned
corpus had pinned that method. The runtime correctly returned unavailable before
admission. The observer now counts actual transport calls, preserving the native
batch path: four two-document batch queries versus fourteen ordinary fallback
blob reads, equal original/output and no duplicate records or reservations. An
explicit added test confirms method replacement is rejected before SQL admission.
No production pinning, permission or body validation was relaxed to pass the test.
An explicit `--scope-prepare` SQL selection now runs only the preparation checks
for future focused verification, symmetric with `--development-prepare`. Mixed or
extra flags reject. Default/full-suite and C22 routing are unchanged; a focused
result cannot be reported as the entire suite. Final types, kit and scope audit pass.
The corrected scope-runtime selection passes 83 checks plus migrations, including
scope scheduling, SDK execution, Temporal recovery/cancellation and composed native
save/reopen. Exact results are recorded in the verification file; focused selections
are not the entire PostgreSQL suite or browser acceptance.

No live model usage/spend, runtime GitHub save, records/profile activation,
deployment, release or signature occurred. Only harness-owned disposable containers
and tmpfs fixture data are cleaned up. Protected architecture, Exam, retention policy
and 0289 performance evidence retain their hashes; user roadmap and outputs remain
untouched. Passing recovery does not resolve the historical 0289 observation.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next integrate current-original records reads into preparation/start validation
phases with independently authorized keys/sources and full final readback. Keep
phases separate across admission, persistence and scheduling, then finish remaining
confirmation work and the unchanged complete benchmark. Live acceptance remains.
