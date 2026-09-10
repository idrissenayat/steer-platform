# 0329 — Lexical draft loans through constructed review phases

Base: `66c48ca5a804c62701e937c42d47db7d862507c7`.

## Private contract

1. A constructed shared source reviewer lends its already-owned native draft
   read through an opaque WeakMap token with no fields or public package export.
   No HTTP input, public service signature, configuration, ambient context,
   credential, permission or authorization/result cache is introduced.
2. The loan applies only to the exact same draft service object and canonical
   parsed read input. Same-shape clones, other revisions/services and forged
   tokens cannot select it. Unknown tokens and nonmatching readers use the full
   fallback. A changed original method or scope denies, rather than silently
   falling back from a compromised owner.
3. Private review callbacks may carry the token explicitly through nested review
   composition. Each forwarding boundary adds its own close/failure checks,
   sequential-consumption guard and actual-promise tracking. The lifetime is
   lexical: no asynchronous-local/global request cache and no escaped loan after
   consumer return, even during the producer's final verification.
4. Final save review and preview keep their existing before/after caller checks,
   input parsing, revision/digest/subject validation and content/provenance checks.
   Each borrowed native read still freshly checks draft permission. Caller
   bracket ownership in review reads remains unchanged; reading the draft alone
   cannot satisfy the required review consumption.
5. Source review owns complete final key-ID/bytes, ciphertext row, latest revision,
   lifecycle and clock verification after the whole nested computation and
   source/corpus closure. Review/scope/history/destination policy checks remain.
   No loan survives a request, effect or source phase, and no signed requirement
   or immutable candidate/history record is changed.
6. Swallowed failures, overlapping draft/review reads, forgotten awaits, owner
   closure and method/scope changes invalidate the computation. Existing trackers
   retain actual held tasks; a timer or early wrapper cannot turn unfinished
   verification into an acknowledgement. Loaned draft state is not a signing,
   execution or publication capability.

## Required evidence

- Unit coverage for exact identity/input, fallback/forgery, late scope/port/owner
  change, nested guards, caller brackets, escaped loans, swallowed errors,
  overlap, forgotten awaits and actual tracked drainage.
- Native current assessment and source/draft review parity: two draft key lookups
  for the shared graph versus ten with wrapped ordinary source review; scope
  key checks remain two with owned scope or four with ordinary scope.
- Existing eight scope-final-key denial cases plus five actual draft-final-key
  faults (draft grant, caller, owner close, method replacement, key rotation).
  Fault counters prove the intended final callback executed. No destructive
  mutation of the joined journey's immutable draft fixture.
- Actual factory HTTP instrumentation asserts exactly two draft-key lookups for
  each successful standalone final review and complete preview in both native
  directions. Counts cover only its draft service, independently of scope/history
  key purposes, which remain active.
- Both authenticated synthetic new-distinct and proposal-continuation journeys
  through corrected drafts, exact confirmation, fixed native save, restart/lost
  response recovery and exact reopen; focused/broad tests and types.

## Completion limits

Whole-action measurements include identity, repository, token and retry attempts.
This increment must not raise 200 requests or substitute undelayed runs for the
full warmed/cold/concurrent benchmark. Remaining confirmation-control and
drafting-start costs still need their own correction. Governed real-model quality,
records adoption, runtime GitHub saving and signed-in human acceptance remain
separate checkpoints; no synthetic result or extra test earns a progress point.
