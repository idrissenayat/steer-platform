# 0309 — Owned scope services in the actual application graph

Current and historical scope projections now use the owned records/content/SDK
reader when the trusted factory supplies explicit independent read bindings.
This is application integration, not another source-only feasibility prototype.
The real-user runtime profile has not been activated or changed.

## What changed

- Metadata-only RLS discovery resolves the exact draft and revision from a review
  reference. Its separate grant binds the retained budget, which must match the
  decoded original. Scope-only snapshots use zero development operation IDs;
  malformed/changed discovery or incomplete bindings fail closed.
- Per-record grants precede ciphertext and per-purpose key grants precede key
  lookup. Existing original/draft/source/profile/review policies remain. Canonical
  codecs and actual SDK/worker checks reconstruct the unchanged public DTOs.
  Uncheckpointed and unknown responses remain incomplete, with no retry or gate.
- Current reads that are already expired do not retrieve observation ciphertext,
  batch state or reservations. Historical reads remain separate and cannot renew
  execution. Database/monotonic expiry is checked through the final caller step.
- Final key/records readback and source grants remain mandatory. Replaced bindings,
  changed permissions, key denial, holds and metadata races suppress the result.
  Four-call ownership includes discovery and actual cancellation drain. Shutdown
  also drains the private scope reader used by development preparation.
- Existing readers remain available only when no owned binding was supplied.
  There is no fallback after an owned read failure, browser opt-in or environment
  flag. No effects move into read phases.

## Measured improvement

The actual synthetic authenticated constructor graph produces these counts:

| Action | Before (0308) | After (0309) |
| --- | ---: | ---: |
| Scope read | 227 | 25 |
| Drafting preparation | 3,826 | 594 |
| Drafting start | 7,871 | 1,407 |
| Save review | 628 | 224 |
| New-distinct preview | 3,447 | 1,815 |
| New-distinct confirmation | 7,087 | 3,823 |

New-distinct confirmation recovery/repeat use 3,795/3,793 attempts. The distinct
proposal-continuation path uses 2,105 for preview and 4,403/4,375/4,373 for
confirmation/recovery/repeat. It retains its additional destination read cost.
Source review remains 75; scope preparation 320; scope start 596/676/676.
Every reported action includes identity and provider attempts, not only blob reads.

These are functional runs with synthetic authorities and recorded model responses,
not the delayed multi-action benchmark or live UI measurements. Several actions
still exceed 200 attempts, and measured undelayed latencies also remain too high.
No p95, accepted performance allocation, saved real intent or live-model quality
claim follows from these reductions.

## Verification

[VERIFICATION.json](VERIFICATION.json) records commands, measurements, timing,
failed iterations, final source hashes and protected hashes.

- Broad regression: **1,497/1,497 tests** passed. Final focused checks and types
  cover the last scope expiry/budget/projection refinements; timing is explicit.
- Scope-read SQL/SDK/HTTP selection: **21 checks plus migrations** passed,
  including exact legacy-equivalence and independent authority failures.
- Authenticated default and proposal-continuation save/reopen pass through actual
  SQL, native local Git and fixed Temporal workflows, including lost replies,
  idempotent recovery, preserved source files and restart/reopen.
- The owned-history selection repeats the default journey and all **37** SDK/
  lineage isolation cases, plus inherited record/key/source/expiry/hold denials.
  That full development/candidate history portion is still not a factory service.
- All package/application types, **88 prototype tests**, the **95-artifact kit**
  and workflow token-scope audit pass. No build/browser acceptance is claimed.

The first scope-selection failure was a test using an invalid literal profile
revision; it was changed to a valid but mismatched model route. The first expired
SQL fixture expected grants for rows deliberately excluded by the new query;
its expected row set was corrected. Initial type errors in the public projection
were corrected. These iterations are not recorded as passing checks.

## Remaining work and authority

Next integrate development originals/results/history and the remaining separate
read/effect phases, then run the unchanged complete C22 protocol. No new ETA or
denominator change. The unexplained 0289 recovery observation remains unresolved;
successful later repetitions do not establish its cause or a fix.

No real credential access, model call/spend, records adoption, profile activation,
runtime GitHub write, deployment, release, deletion or signature was performed.
Only disposable fixtures were created/removed. User drafts, signed artifacts,
`docs/REAL-USER-ROADMAP.md` and `outputs/` were preserved.

**Intent capture: 68% (17/25 checkpoints; eight remaining; +0 percentage points).**
