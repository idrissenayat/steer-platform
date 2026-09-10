# 0319 — Current-scope permission-query evidence

Date: 2026-09-10. Base: `72d62e6878474170cff0754a56467db38b9adee2`.
Contract: [Spec](SPEC.md). Results: [verification](VERIFICATION.json).

## Cause and correction

The existing synthetic attribution selection passed one joined native journey
plus migrations on the pre-change source. One complete repeated-start sample
shows 1,069 identity attempts: 348 at the current source callback's pre-policy
barrier and 348 at its post-policy barrier. This identifies duplicated caller
traversal, not model/provider dispatch or repeated document generation. The
[retained profile](PROFILE.json) preserves the complete selected sample with
count conservation. Some large tool-output lines were truncated; no full 45-call
capture is claimed or used to infer missing evidence.

The private current-read authority module now distinguishes explicitly constructed
permission-only source policies. Ordinary invocation still runs caller → policy →
caller. Only a current-scope window with the exact same caller callback may choose
policy → fresh caller after it already authenticated on entry. The actual policy
and post-policy caller check rerun on every use, before scope IO or continuation.
No content/key lookup, mutation or scheduling belongs in the optimized policy.

Construction identity is private and cannot be copied into a callback. Genuine
forwarding retains fixed arguments, receiver semantics, intrinsic invocation and
owner guards/tracking. Generic brackets, historical constructors, copied/bound/
wrapped functions and another caller remain on their prior full paths. Current
and historical permission authority remain deliberately separate. No public
package export, HTTP flag, cached decision or permissive fallback is introduced.

Drafting start uses this only for its read-only original source permission. Full
initial/final scope reads, exact canonical source/result binding, complete final
development records/key comparison and fresh final purposes remain. Scheduler
effects remain between independent phases; post-effect denial cannot redispatch.

## Measured result and limits

| Synthetic authenticated action | 0318 | 0319 |
| --- | ---: | ---: |
| Drafting start | 938 | 699 |
| Drafting recovery | 1,069 | 796 |
| Drafting repeat | 1,069 | 796 |

This removes 239 attempts (25.48%) from first start and 273 (25.54%) from recovery/
repeat. Only eligible metadata invocations change; it does not remove every
pre-policy check from the baseline trace. Other measured actions are unchanged:
scope preparation 292, scope starts 195/221/221, drafting preparation 532/487,
save review 211, new-distinct preview/confirmation 330/853, continuation 440/1,073.
All attempts, including identity/token requests, are counted.

These are undelayed synthetic functional samples on a shared host. They are not
warmed p95, actual model quality, signed-in UI evidence or a live GitHub save.
The unchanged complete C22 protocol still requires every action under 200 attempts,
20 ms per attempt, five-second p95, 20 warm, three cold and four concurrent samples
per direction plus negative cases. That checkpoint remains pending.

## Verification boundaries

Focused tests cover current/history proof isolation, immutable real forwarding,
fixed arguments and intrinsic invocation, ordinary-vs-metadata call order, exact
policy count conservation, denied/nonvoid caller or policy, premature tracking,
late rejection and owner closure. The scope tests prove initial authentication
precedes policy and policy-time caller loss blocks actual scope IO. Final records,
source, status, expiry and escaped-port checks remain effective.

Final review explicitly rejected an unknown callback paired with a malformed
undefined caller before constructing a query. The earlier version would return
a query that threw when invoked, not a successful grant. Both malformed cases
now have assertions; every final check below was rerun after that correction.

Final native ordinary/owned start and both synthetic authenticated save/recovery/
reopen selections use the final source, including the existing fifteen joint
scope/original scenarios and actual held-key/final-scope drainage. Exact focused,
broad, type, kit and workflow-scope audit results are in the verification file:
64 focused tests, 1,542 broad tests (344,832.651333 ms; no failures/skips), prototype
and all eight package typechecks, 95-artifact kit validation and the read-only
workflow-token audit passed. Native start passed nine checks plus migrations;
new-distinct passed three joined checks and continuation one, each plus migrations.
Focused cases overlap the broad suite, rather than adding to its distinct count.
Focused selections are not the full PostgreSQL suite. No build/browser result is
claimed, and a fixture is not live acceptance.

No model use/spend, runtime GitHub artifact save, records/profile activation,
deployment, release, deletion of live records or signature occurred. Only the
harness's disposable containers/tmpfs data were cleaned up. Protected architecture,
Exam, retention policy and 0289 evidence hashes are unchanged; user roadmap and
outputs are untouched. Passing recovery does not explain the retained 0289 failure.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next consolidate remaining current-source/caller and records traversal across
preparation/start/confirmation, then the unchanged full benchmark. Governed real
activation, model quality and signed-in human/UI/save acceptance remain required.
