# Verification evidence

Base: `74975d7585045bbedb333297aad8a38fc8668c56` (0296).

## Implemented boundary

Private construction proof connects the exact source-review and final-review
methods to the existing complete-corpus session. One read-only preview now shares
verified immutable source bytes across all of its repeated reviews. The genuine
API wrapper already forwards the exact method, so no public DTO, package export,
runtime profile or API-root change was needed. Copied/bound/unregistered methods
retain ordinary review behavior; replaced methods/scopes/ports deny.

Each source review still performs both exact latest-draft reads, both evidence/
provenance checks and output verification. Every consumed-source permission,
product/lifecycle selection, all-grants revision and fresh head check remains.
The session performs its existing final corpus freshness check and then reopens
the exact draft, catching a late edit, hold or lost key. All preview history,
original, recorded-scope, destination and draft comparisons remain.

Confirmation admission and persistence are unchanged. Its first and second
previews open separate sessions; no byte/proof crosses a write or request.
Skipped/replayed/empty/premature/nonvoid windows, swallowed failures, overlapping
or unawaited reads and changed ports cannot release output. Trackers cannot
replace actual dependency completion. The parent tracks actual work, and held
source work retains owner admission through cancellation until it drains.

## Verification

All final tests use **Node 24.19.0**:

- **46 focused tests pass**, no failures/cancellations/skips (5,152.050 ms).
  These include hostile private-session callbacks, exact method/scope proof,
  ordinary fallback, changed draft/key/hold/authority, closed/held work, actual
  API construction and native Git source sharing. The two-source native test
  downloads two bodies for two reviews in one session, then two fresh bodies
  again in a separate session. Late grant/head/caller changes reject.
- **40 native candidate-save checks plus idempotent migrations pass** through
  admission, encrypted immutable originals, SQL/HTTP/Temporal/native Git,
  holds, cancellation, lost acknowledgements and replay. This is a scoped
  selection, not the full SQL suite.
- **Three authenticated joined checks plus idempotent migrations pass** through
  both recorded drafting roles, correction/reassessment, exact confirmation,
  one native save, lost acknowledgements, runtime reconstruction, current
  policy/Git-grant denial and exact older-commit reopen. Six synthetic calls/
  reservations are retained without duplicate model dispatch.
- **1,381 package/application tests pass**, no failures/cancellations/skips
  (159,203.341 ms). This selection includes domain/worker/web but excludes the
  root controls included in 0296's expanded broad run. The differing counts
  are not evidence of added/removed acceptance; package-boundary root checks
  are included in this increment's focused run.
- **88 prototype tests** in 17 files pass (15.82 s); prototype and all eight
  package typechecks pass (3.915 s); the Next.js 16.3.4 optimized build passes.

An initial `satisfies`/ASI syntax error was corrected before the preliminary
33-test pass. The final callback/drain hardening and new tests are verified by
the final runs above, not by that preliminary result.

Commands:

```sh
node --test packages/data/test/review-read-session.test.ts packages/data/test/intent-development-reviewer.test.ts apps/api/test/intent-corpus-review.test.ts apps/api/test/candidate-save-review.test.ts apps/api/test/candidate-save-preview.test.ts apps/api/test/intent-journey-factory.test.ts tests/package-boundaries.test.mjs
node --test --test-concurrency=4 packages/*/test/*.test.ts packages/domain/test/*.test.mjs apps/api/test/*.test.ts apps/worker/test/*.test.ts apps/web/test/*.test.mjs
node packages/data/test/postgres.integration.ts --candidate-save
node packages/data/test/postgres.integration.ts --journey-runtime
pnpm test
pnpm typecheck
pnpm --filter @steer/web build
```

## Measured benefit and remaining gap

Repository-body downloads fall **75%**: preview **172 → 43**, confirmation
**344 → 86**. Standalone save review drops **86 → 43**. These are body counts,
not total requests: all identity traffic remains in the measurement.

Total preview attempts fall **4,017 → 3,722** (295 fewer; 7.34%); first
confirmation **8,227 → 7,637** (590 fewer; 7.17%). Reconstructed/repeated
confirmation use **7,609 / 7,607**; both reconstructed token refreshes remain.
Standalone save review falls only **886 → 871**: its identity-head checks
increase from 781 to 813 with the session/final-draft guards. This cost is
retained, not omitted to exaggerate the body-download improvement.

Source review remains 210, scope preparation 844, drafting preparation
4,350 / 3,900 and drafting starts 7,871 / 8,866 / 8,866. The full unchanged
200-attempt budget still fails; the remaining confirmation traffic is primarily
current-identity/records validation, with 7,488 identity-head checks in its first
request. Next consolidate the full records/result/observation validation read
set within each read-only phase, preserving independent policies and fresh
authority at content/effect/release boundaries. More body-only changes cannot
close this gap. Then finish source review and run the full C22 protocol.

[Raw measurements](PERFORMANCE.json) preserve 12 action samples, two preparations,
nine start logs, 14 origin partitions, 12 source/harness hashes and the recovery
trace. Recovery returns committed in 209 ms / 17 requests, with 14 SQL phases,
three clock observations and no database failure or clock reversal. This does
not explain or fix the retained 0289 recovery-unknown observation.

Broad regression and prototype/build overlap portions of this undelayed joined
diagnostic. Native save regression begins after confirmation measurements and
overlaps final recovery/cleanup. Local preview/first-confirmation times are
8,129 / 15,439 ms, not warmed p95 or a like-for-like timing speedup. Full SQL,
other full dispositions, delayed prefix, full performance protocol and live
acceptance were not rerun.

Overall remains **68% (17/25; 8 remaining; +0 points)**. No live model call,
credential change, real records/D1 adoption, runtime GitHub grant/write, signed
source, gate, deployment, release or user-data deletion is part of this change.
Integration cleanup removes only each run's owned synthetic PostgreSQL container
and tmpfs data; signed sources and unrelated user files remain unchanged.

Final delivery audit passes: 95 kit artifacts, workflow token scopes, all 12
source/harness hashes, 14 origin partitions, exact request/body deltas, four
protected hashes, the unchanged 17/25 tracker and 390 relative Markdown links.
Git whitespace checks pass. The unrelated untracked roadmap and outputs are
preserved outside this increment.
