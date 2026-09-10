# 0320 — Owned current-scope projection evidence

Date: 2026-09-10. Base: `c9ee37ac81102fe285545dae954d83aa2b12fafe`.
Contract: [Spec](SPEC.md). Exact checks and samples: [verification](VERIFICATION.json).

## Capability and boundaries

The exact current-scope reader constructed with independent current records/key
authority now registers a private read-only projection phase. The registration
pins the actual service/read identity and scope digest. It exposes no additional
tool method, HTTP flag or public grant. History is not registered. Wrapped, copied
and ordinary readers retain their full two-read behavior; a registered failure
does not fall back.

Each drafting-start validation opens one current scope content lease around the
dependent original work. The scope owner verifies original/source/profile and
recorded SDK observations before consumption. The borrowed reader pins exact
input, freezes the verified result, freshly checks caller/source/review policies,
and rejects expired, superseded, historical or changed authority. Parallel,
unawaited, nonvoid, caught-failed and escaped consumption cannot finalize the phase.

Complete development records/key comparison precedes final scope records/key
comparison. Development-purpose permissions remain fresh through scope work and
return. The borrowed reader closes before finalization, and actual scope work is
drained even when its public result has already rejected on shutdown/timeout.
Scheduler work stays outside these phases. Nothing is cached across requests,
independent revalidation phases or effects.

The source helper imports only portable contracts; storage remains in the runtime
composition root. Ordinary current/history projection behavior is preserved.

## Measured result

| Synthetic authenticated action | 0319 attempts | 0320 attempts |
| --- | ---: | ---: |
| Drafting start | 699 | 552 |
| Drafting recovery / repeat | 796 / 796 | 628 / 628 |

First start removes 147 attempts (21.03%); recovery/repeat remove 168 (21.11%).
Three drafting validation phases use three full scope content leases instead of
six. Full initial/final key comparison within each lease remains: six physical
scope-key reads instead of twelve, alongside the unchanged six development-key
reads. The final native check asserts that development keys have already rechecked
when the second scope key is looked up.

Other measured actions are unchanged: scope preparation 292, scope start 195/221/
221, drafting preparation 532/487, save review 211, new-distinct preview/confirmation
330/853, continuation 440/1,073. All identity and token attempts count. Undelayed
shared-host functional samples are not warmed p95 or a browser speed claim.

## Verification

Final source passed 39 focused tests, all 1,548 broad tests (344,329.596541 ms;
zero failures/skips), prototype and all eight package/application typechecks,
the 95-artifact kit check and read-only workflow-token audit. Native start passed
nine checks plus migrations. New-distinct passed three joined checks, continuation
one, each plus migrations. Both joined selections include all 26 scope/original
closure scenarios below. Focused tests overlap the broad suite; these are not the
full PostgreSQL suite, a browser/build result or live acceptance.

The native fixture keeps the fifteen prior wrapped-reader/final-scope scenarios
and adds eleven exact-reader scenarios: success, nine late-denial cases and a
held-final-scope-key shutdown. These cover scope record/key/revision loss, revoked
development record/key purposes during the last scope key, rotated scope keys,
source/caller loss and replaced reader methods. An early scope-close rejection
must not release the parent while its actual key lookup remains held.

Initial focused checks caught an invalid import outside the API composition root
and a test trying to mutate an already frozen result; both were corrected. A later
typecheck caught test cleanup accessing an optional shutdown method without
narrowing. Review then made per-consumption scope policies explicit and retained
the scope owner's actual drain. Final reruns use those corrections, not the first
experimental native run.

No paid model calls, runtime GitHub artifact save, records/profile activation,
deployment, release, live-record deletion or signature occurred. Synthetic harness
cleanup is confined to its own disposable containers and tmpfs data. Protected
architecture, Exam, retention policy and 0289 performance evidence are unchanged.
The user's roadmap and outputs remain untouched. This does not explain or replace
the retained 0289 recovery failure.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
C22 remains pending under the unchanged 200-attempt ceiling, 20 ms per attempt,
five-second p95 and complete 20-warm/3-cold/4-concurrent protocol in both directions
plus negatives. Next consolidate remaining validation in preparation and save
confirmation, alongside the remaining drafting caller checks, then run that full
benchmark. Real model quality, governed runtime/records activation and signed-in
UI/save acceptance remain separate requirements.
