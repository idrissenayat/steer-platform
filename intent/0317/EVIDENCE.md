# 0317 — Owned current-original drafting-start evidence

Date: 2026-09-10. Base: `6f77d2e1899c13e5691c706cc0361e8b2269f2f7`.
Contract: [Spec](SPEC.md). Exact checks, iterations and samples: [verification](VERIFICATION.json).

## Delivered

Drafting start now accepts an explicit current-original records/key binding from
the authenticated factory. `authorizeDevelopmentOriginalDiscovery` is distinct
from historical discovery. The read selects only the exact draft/latest revision,
development original, operation and budget. Expired executions deny before
ciphertext; generated steps/results/observations/reservations are not fetched.
History-only bindings, invalid explicit bindings and foreign profiles deny without
fallback. No tool flag or implicit runtime activation enables the owned path.

Within each owned read-only phase, canonical source/configuration/profile/input
checks preserve the exact human direction and immutable original. Every use
requires current permissions. The data service validates the recorded current
scope and completes its final scope read; complete development records/key
readback follows. Current scope is then opened again under fresh development
record/key-purpose grants through final IO and return. This handles scope loss
during the key read and development-purpose loss during the final scope read.
Historical, expired or changed scope cannot satisfy the binding.

Scheduling is outside every phase; scheduler revalidation and post-effect checks
open fresh phases. Invalid/escaped/parallel work, changed methods, revocation and
closure deny, while actual owned pending key/records work drains. The absent-binding
fallback retains its original first-policy/admission ordering. No permission cache,
retry, execution grant, public response change or relaxed deadline is introduced.

## Measured effect

| Synthetic authenticated action | 0316 attempts | 0317 attempts |
| --- | ---: | ---: |
| Drafting start | 1,407 | 989 |
| Drafting start recovery / repeat | 1,594 / 1,594 | 1,127 / 1,127 |
| Scope start / recovery / repeat | 195 / 221 / 221 | 195 / 221 / 221 |

The first start removes 418 attempts (29.71%); recovery/repeat remove 467
(29.30%). The intermediate 884 / 1,007 / 1,007 sample predates final scope/purpose
closure and is not the delivered result. Preparation and save counts remain
unchanged: scope preparation 292, drafting preparation 532 / 487, save review 211,
new-distinct preview/confirmation 330 / 853 and continuation 440 / 1,073.
These actions still exceed 200. All provider attempts, including identity/token
calls, count. Undelayed samples on a shared host are not p95, the complete C22
protocol, real-provider performance or signed-in UI acceptance.

## Verification and corrections

Final focused checks pass 86/86, including the existing read-policy owner contracts.
Final broad regression passes 1,532/1,532; all types, kit and scope-audit checks pass.
Native drafting start passes nine checks plus migrations: ordinary/owned receipt
equality, history-only/profile rejection, seven late-change variants, post-effect
key loss without redispatch and actual owned-key shutdown drainage. The focused
fixture uses six physical key reads over three phases; this is not a whole-action
six-request claim. Both joined directions also exercise complete recorded scope,
including eight variants of cross-boundary scope/record/key closure. A successful
recorded-scope start uses nine full scope reads across its three validation phases.
That cost remains a consolidation target, not a reason to omit validation.

The verification file records broad regression, types, kit and audit results and
the exact native-run timing. The final joined selections use the completed owned
path and final closure tests; their processes started before the fallback-only
first-policy ordering correction. Final focused/native-start checks cover that
correction separately. Joined native HTTP/Git/PostgreSQL/Temporal and recorded SDK
verification remains synthetic authority/model evidence, not a live save or useful
real-model output assessment. No full PostgreSQL-suite, build or browser claim.

Three typecheck iterations caught an overly wide action literal and a test-only
union-reader argument signature; explicit types corrected them. An initial broad
run passed 1,530 of 1,532 tests and failed two existing fallback policy-order checks:
moving its initial read into the scope phase introduced an extra early caller
check. The ordinary initial binding was restored; test expectations and limits
were not relaxed. Review also added final scope-after-key validation and fresh
development-purpose grants; earlier passing/lower-cost samples remain intermediate.

No live model use/spend, runtime GitHub artifact save, records/profile activation,
deployment, release or signature occurred. Only harness-owned disposable
containers/tmpfs data were cleaned up. Protected architecture, Exam, retention
policy and 0289 performance evidence retain their hashes; user roadmap and outputs
remain untouched. Passing recovery does not resolve the retained 0289 observation.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next consolidate joint current-scope/original validation and surrounding caller
traversal, preserving final closure in both directions, then remaining preparation
and confirmation controls. The unchanged complete benchmark and governed real
model/runtime/UI/save acceptance remain required; no new ETA is asserted.
