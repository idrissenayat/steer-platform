# Intent 0279 execution evidence

Status: implemented and verified as a development increment.
Base: `a65f64d1762a4977d03e6c93b7adfde724acc2b0` (0278).

The actual corpus-backed source reviewer now installs a private read-only session.
Ordinary collection still traverses full content. Initial collection and session
revalidation include all consumed source grants, including pointer/manifest/Exam
files. The session does not enclose confirmation admission or external effects.

Focused tests initially found an incorrect test assumption: strict input parsing
rejects forged proof fields rather than ignoring them. The test now explicitly
requires that rejection, then verifies a normal request. A test-only unknown-value
spread required an object assertion for typechecking. Neither fix changes safety
contracts. Adapter/data/API typechecks pass. Prototype and all eight package
typechecks pass (four unchanged checks use local Turbo cache), followed by a
successful optimized Next production build.

## Authenticated joined workflow

The unchanged `--journey-runtime` selection passes all three joined checks plus
idempotent migrations. Both fixed scope workflows and the ordered Architect/Test
Agent drafting workflow precede exact correction/confirmation and the fixed save
workflow. Denied starts, lost scheduler/provider/HTTP acknowledgements, replay,
identity/factory restart and exact older-commit reopen pass. The same one confirmed
encrypted original, six synthetic model requests/reservations and one native Git
commit remain. Current records-policy/Git-grant revocation denies. Owned runtimes,
workers and the run's disposable PostgreSQL/tmpfs resources close. This is not the
full SQL suite or signed-in UI acceptance.

## Same-fixture request comparison

Provider attempts below are measured by the existing aggregate transport meter.
Identity and repository head counts are subsets of total attempts, not inferred
from shared URL shapes. The full original 34-source corpus is unchanged.

| Action | 0278 requests | 0279 requests | Identity heads | Repository heads | Observed ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current source review | 3,973 | 3,042 | 2,901 | 6 | 2,281 |
| Corrected-scope preparation | 13,997 | 14,221 | 13,287 | 14 | 15,124 |
| Scope result read | 664 | 664 | 661 | 0 | 524 |
| Final package review | 9,342 | 7,480 | 7,203 | 12 | 5,731 |
| Candidate preview | 33,694 | 29,970 | 29,409 | 30 | 17,718 |
| Confirmation, discarded reply | 67,820 | 60,372 | 59,253 | 60 | 36,467 |
| Confirmation after reconstruction | 67,758 | 60,310 | 59,189 | 60 | 36,089 |
| Identical confirmation replay | 67,756 | 60,308 | 59,189 | 60 | 36,088 |

Source review removes 931 requests (23.4%), final review 1,862 (19.9%), preview
3,724 (11.1%) and each confirmation 7,448 (11.0%). Ordinary corrected-scope
preparation adds 224 requests (1.6%) because final grants now cover supporting
pointer/manifest/Exam files as well as emitted Brief/Spec. Every consumed-source
grant remains mandatory; stale grants cannot authorize reuse. Two fresh readback heads are added per
session compared with two full collections; immutable body traversal is reduced.

The first confirmation partitions into 59,256 identity attempts (59,253 heads and
one commit/tree/blob) and 1,116 repository attempts (60 heads, 356 commits, 356
trees and 344 blobs). Thus identity still owns 98.2% of all requests. The observed
36-second confirmations are shorter than 0278's 50–54 seconds but are **not** a
controlled remote latency benchmark or acceptable live-provider load. Drafting
starts retain 41,768 / 47,350 / 47,350 requests (13.1–15.7 seconds). High request
amplification, other dispositions and governed startup remain open.

## Broad verification

All **1,367 broad tests pass**, zero failed/cancelled/skipped, 142,960 ms at
concurrency four. The 27 focused corpus/reviewer tests are included, with 12 new
checks covering private proof/strict input, no cross-request reuse, all consumed
grants, head/permission/selection/port/binding changes, excluded roots, corrupt
and incomplete coverage, preserved 34-source batch gaps, parallel/swallowed
failures, monotonic deadlines, four retained occupied slots, closure and exact
draft/provenance checks. The full-read fallback remains exercised. Prototype,
eight-package types and production build results are recorded above.

The separate `--development-history` selection passes all ten checks plus its
idempotent migration check. This includes six native preview cases across five
directions; edited multi-batch/SDK lineage; explicit confirmation and fixed
Temporal/native Git save/reopen; original-bound publication records/lost SQL
acknowledgement; request-key/hold/quarantine boundaries; both historical roles;
and missing/late current source/result/profile/key/identity authority. Its owned
disposable container/tmpfs data is removed. The full SQL suite was **not** run.

Protected Architecture/Exam/accepted-retention hashes, the 95-artifact kit,
read-only workflow-token audit, 312 local links across seven changed/new Markdown
files and diff whitespace checks pass. User-owned `docs/REAL-USER-ROADMAP.md` and
`outputs/` are untouched and excluded from the source commit. The API-key skill
kept the resolved credential boundary intact: no key inspection, replacement or
live model call was needed.

## Remaining work

Continue bounded read-performance work through the actual factory, measuring
both identity and repository traffic. Confirmation still performs roughly 60,000
provider attempts, mostly current identity heads; this is not usable live load.
Do not trade current authority for a smaller count or retain this source-review
session across confirmation admission/effects. The preview still separately
revalidates generation history, originals, scope, destinations and draft state;
any next reduction must preserve their distinct policy and late-change checks.
Other dispositions, governed startup, real provider quality and the actual
signed-in I1–I6 journey remain acceptance work, not completed by this test.

The $5 model test budget remains unapproved; D1 is unsigned/inactive and runtime
GitHub writes remain closed. Synthetic evidence does not demonstrate live model
quality, real permissions, signed-in UX or I1–I6 acceptance.
