# Intent 0291 execution evidence

Base: `db1d61ee9494831c22f09a9cc04d5714a700fa6b`.
Status: authenticated synthetic joined verification, broad regressions, types
and build passed; performance acceptance remains incomplete.
Progress: **68% (17/25; 8 remaining; +0 points)**. No live activation is implied.

## Delivered production changes

- The managed journey authenticates initially, then performs each independent
  scope-bound bundle-use query followed by fresh caller authentication before
  service continuation. Metadata-only policy queries do not contain source reads
  or effects. Existing deadlines, admissions, scope/method checks and late-work
  drain remain. Intrinsic invocation preserves the captured service method.
- Corpus inventory authorization is followed by fresh caller validation. Final
  selection/source checks form a guarded policy-only sweep bracketed by the exact
  all-grants revision and caller checks. Every selection and consumed-source grant
  still runs, including pointer/manifest/Exam grants not emitted into scope text.
- Source reads query the source grant, check current caller/inventory, read and
  validate bytes, query the source grant again, then check current caller/inventory.
  This removes the duplicate nested pair around metadata-only queries, not the
  fresh barriers around actual content IO or result release.
- A native reader privately recognizes only its exact frozen inventory object
  at the exact commit and regular-file path. It reuses immutable commit/tree
  membership, but fetches and verifies each body anew with the original bounded
  parser. Forged/foreign/copied snapshots deny. Wrapped or replaced ports use
  the ordinary path. This is not cached authority or a public activation option.

## Verification observed so far

The initial policy-sweep/source-read prototype passed 34 focused tests, all types
and three authenticated joined checks plus idempotent migrations. Its source
review used 1,090 requests. This is preliminary evidence, not the final source.

After manager/corpus flattening, 44 focused checks passed. The immutable-inventory
addition then passed those 44 checks but exposed four failures in the new test
setup: its fake App JWT string did not match the native fixture's explicit fake
credential. Correcting only that test string made all four new reader checks pass
(3,365.115 ms). This was not a live credential or a production-provider failure.
All eight package types and prototype types passed (1.818 s).

The final actual authenticated constructor graph passes all three joined checks
plus idempotent migrations. It uses 34 native scope sources, two recorded scope
batches, separate Brief/Spec and Test Agent Exam roles, corrections and fresh
scope review, six synthetic model calls/reservations, one confirmation original,
one native save, lost replies, restart, exact old-commit reopen, current-policy
and Git-grant denial. No duplicate dispatch/original/reservation occurs.

Already-sent recovery returns committed in 217 ms with 17 provider requests,
14 SQL phases, three valid clock observations and zero SQL errors or clock
reversals. The older 0289 unknown result remains unresolved; this passing run
does not establish its cause or erase that failed evidence.

## Final undelayed request measurements

| Action | Previous | Final | Reduction |
| --- | ---: | ---: | ---: |
| Source review | 2,634 | 317 | 87.97% |
| Scope preparation | 9,598 | 1,250 | 86.98% |
| Initial drafting preparation | 20,130 | 6,516 | 67.63% |
| Repeated drafting preparation | 18,790 | 5,846 | 68.89% |
| Initial drafting start | 23,064 | 11,537 | 49.98% |
| Save review | 6,664 | 1,326 | 80.10% |
| Save preview | 22,642 | 7,309 | 67.72% |
| First confirmation, discarded reply | 45,716 | 14,829 | 67.56% |

Source review now partitions into 265 identity and 52 repository requests; the
repository side still fetches all 43 consumed bodies, but only one corpus commit
and tree. Initial drafting preparation fetches 172 bodies across four separate
read-only validations with four commit/tree pairs, never across a write effect.
Two installation-token refresh requests are included in the reconstructed
confirmation sample; they are not hidden to improve counts.

These are single undelayed synthetic observations, not warmed p95, real provider
latency, actual signed-in UI acceptance or proof of C22. Source review at 317 and
later stages still exceed the 200-attempt ceiling. [Raw measurements](PERFORMANCE.json)
retain all partitions, initial/repeated samples, preliminary evidence and final
source/harness hashes. Final broad/build/prefix results are recorded below.

All **1,430 broad regression tests pass** (150,452.341 ms), with zero failures,
cancellations, skipped or todo tests. This includes the corrected new reader
tests and all policy/read regressions on the final production source. The
optimized Next.js 16.3.4 build passes. No signed-in browser or live-provider
acceptance is claimed. The 95-artifact kit and read-only workflow-token audit pass.

The delayed benchmark prefix passes its two integrity checks and idempotent
migrations, but correctly reports C22 failure: source review hits its 200-dispatch
ceiling and returns a denied result, not a false complete review. Both directions
retain the existing 20 warmed, three reconstructed and four concurrent draft-read
samples. The first prefix tool-output capture was truncated, so a separate final
prefix run records all raw samples; truncation is not a product failure or an
omitted failed measurement. No production source changed between those runs.

The final retained prefix measures warmed draft-read p95 at 601.545 ms for
new-distinct and 592.283 ms for proposal continuation; all three cold and four
concurrent reads per direction meet their existing bounds. Both source-review
probes fail closed with HTTP 401 after 202 attempts / 200 dispatches, no outstanding
work at return, at 5,509.654 / 5,480.445 ms. These are explicit performance
failures, not passing source-review results. No model, save or records mutation
occurs in either prefix; C22 and its full later-stage protocol remain incomplete.

All 338 checked local Markdown links, 18 source/harness hashes, 14 partitioned
final action/preparation samples, two full prefix reports and the unchanged
17/25 tracker calculation validate. All three protected signed-source hashes
and the retained 0289 failure artifact remain unchanged. Whitespace, kit and
workflow-scope checks pass. Only owned disposable native Git/PostgreSQL/Temporal
test data were removed; the user's files and existing work remain untouched.

Next remove the remaining source-review and durable records-validation
multiplication, then run the full warmed/cold/concurrent acceptance protocol.
Real models, live records/D1, runtime GitHub authority and actual signed-in UI
acceptance retain their separate prerequisites. No credentials, live spending,
runtime provider grant/write, policy adoption, gates, deployment or release changed.
Progress remains **68% (17/25; 8 remaining; +0 points)**.
