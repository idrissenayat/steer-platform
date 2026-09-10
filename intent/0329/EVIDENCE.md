# 0329 — Shared draft graph in final review and preview

Base: `66c48ca5a804c62701e937c42d47db7d862507c7`.
[Brief](BRIEF.md), [Spec](SPEC.md), [verification](VERIFICATION.json).

The constructed source reviewer now explicitly lends its owned draft phase
through nested final-review and preview callbacks. Opaque private tokens bind the
exact draft service and parsed input. Each review boundary owns failure, close,
sequential consumption and actual promise tracking. Consumers retain fresh caller
checks and all document/provenance validation; the native owner retains fresh
draft permissions and full final keys/rows/lifecycle checks after source closure.

Other instances/revisions, unregistered services and forged tokens retain full
ordinary reads. Changed original ports/scopes deny. Loans close when their
consumer returns, not merely when a producer finishes its later final checks.
No public API/export, request flag, ambient cache or cross-effect sharing exists.

## Whole-action measurements

| Authenticated synthetic action | 0328 attempts | 0329 attempts |
| --- | ---: | ---: |
| Final save review, either direction | 150 | 129 |
| New-distinct preview | 265 | 230 |
| New-distinct confirmation / recovery / repeat | 685 / 657 / 655 | 615 / 587 / 585 |
| Continuation preview | 375 | 340 |
| Continuation confirmation / recovery / repeat | 905 / 877 / 875 | 835 / 807 / 805 |

First confirmation falls 10.22% / 7.73%, but remains well over 200. Preparation
277 and 517/472, drafting start 458/521/521, source review 70 and the 155-attempt
confirmation control outside its two previews remain unchanged. All identity,
repository, token and retry traffic remains included. These undelayed functional
samples are not warmed p95, browser speed or the complete C22 protocol.

The actual factory HTTP path asserts exactly **two draft-key lookups** for each
successful final review and complete preview in both directions. An independent
native review comparison proves two shared draft-key lookups versus ten with
wrapped ordinary sources, with exact output parity. Independent current scope
still performs its own two key lookups (four with a wrapped ordinary scope reader).

## Verification

**1,589 broad regression tests pass**, zero failures/skips/cancellations, in
348,193.539541 ms. **55 focused tests pass** in 486.412875 ms; scopes overlap.
Prototype and all eight apps/packages typecheck in 2.614 seconds. Kit validation
and workflow token-scope checks pass. A final comment-only clarification of loan
versus ordinary validation does not change executable behavior; hashes identify
the final source.

Both final native selections pass: three default joined checks and one
continuation joined check, each plus idempotent migrations. The extended native
review helper verifies ordinary/shared parity, thirteen actual final-key denial
cases and held-scope shutdown drainage. The five new draft-final-key cases cover
grant loss, caller loss, close, method replacement and changed key bytes; each
asserts that its intended second key callback executed. No fixture mutation is
inferred from a caught error. Six new unit tests cover identity/fallback, guard
propagation, caller brackets, failure poisoning, overlap, forgotten reads and
consumer-return closure.

The joined journeys retain corrected-document provenance, exact human
confirmation, one fixed native save, lost scheduler/HTTP replies, restart/replay,
older-commit reopen and current authority denial. Canonical/prior proposal files,
original targets, immutable records and model reservation counts remain intact.
Final action samples and four actual HTTP draft-key proofs are retained in the
verification artifact. Initial native runs preceded the added instrumentation;
both selections were rerun after it, without further production behavior changes.

## Remaining work and authority

**68% (17/25; eight remaining; +0 percentage points).** This is partial C22,
not another completed acceptance checkpoint. Next consolidate the remaining
confirmation/preservation controls and current-caller/read-set graph; preview
itself and drafting start still exceed the limit. Keep the 200-attempt ceiling
and full 20-ms, warmed/cold/concurrent protocol unchanged.

Real-model duplicate/drafting quality, governed records/clock adoption, runtime
GitHub save/reopen and signed-in UI/human acceptance remain open. No live model
call/spending, runtime GitHub artifact write, activation, deployment/release,
signature or real-data deletion occurred. Cleanup removed only owned synthetic
PostgreSQL containers and tmpfs data. User drafts, signed artifacts, the untracked
roadmap and outputs remain untouched. The implementation loop remains active.
