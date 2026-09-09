# Corrected-package confirmation: read amplification

This records an observed engineering failure and its bounded confirmation repair,
not signed-in acceptance or authority to change security requirements. Base:
`62fcc03` plus 0274. All data, identities and provider responses are synthetic.

## Observed trace

| Authenticated action | Duration | Native-provider requests |
| --- | ---: | ---: |
| Latest draft read | 62 ms | 32 |
| Current source review | 3,603 ms | 3,973 |
| Corrected-scope preparation | 12,784 ms | 13,997 |
| Recorded corrected-scope read | 526 ms | 664 |
| Final candidate review | 8,407 ms | 9,342 |
| Candidate preview | 44,646 ms | 129,330 |
| Confirmation, discarded client reply | 90,101 ms | 257,195 |
| Reconfirmation after runtime reconstruction | 90,073 ms | 255,388 |

The confirmation request reaches the existing 90-second limit after preserving
one encrypted original. An earlier run also returned `unknown` on reconstructed
reconfirmation. No second original or Git write occurred. This is not a deadlocked
SQL transaction: observed database connections were idle between active checks.
The latest reconstructed request also reaches the deadline and returns `unknown`.
The test correctly fails its required `prepared` acknowledgement and removes its
own disposable PostgreSQL container/tmpfs data. See [evidence](EVIDENCE.md).

Counts include synthetic GitHub transport requests, particularly fresh Git-head
reads performed by nested current-identity callbacks. They are not counts of live
GitHub requests or a remote rate-limit measurement. The observed amplification
must be addressed before provider-load or smooth human-journey acceptance.

## Composed call path to repair

The [confirmation service](../../packages/data/src/candidate-save-preparer.ts)
rebuilds the full preview before admission and again after original preservation.
Each [preview](../../packages/data/src/candidate-save-previewer.ts) verifies final
review and both-role retained history twice. Each [final review](../../packages/data/src/candidate-save-reviewer.ts)
reads current source/draft state twice; the source reviewer itself recollects the
corpus. [History](../../packages/data/src/intent-development-history-reader.ts)
also composes original, scope-history, role observations and repeated authority
checks. Their nested callbacks repeatedly reach the managed identity boundary.

This call graph and measured request growth support repeated composed verification
as the immediate deadline cause. Do not infer a precise per-function share without
instrumenting it. The first expiry failure was separate: a renewed short-lived
synthetic identity lets this request reach the independent confirmation deadline.

## Required repair boundaries

- Keep the 34-source joined case and existing service deadlines. Do not change the
  expected acknowledgement to `unknown` just to make the test pass.
- Preserve exact latest draft, source snapshot, permission/lifecycle, historical
  role/predecessor, original/key and human-confirmation validation, including late
  changes and authority loss. No cross-request decision or stale-head fallback.
- Prefer removing repeated deterministic work or introducing an explicit verified
  read snapshot with equivalent current rechecks; do not silently replace current
  authorization callbacks with no-ops or promote client hashes to authority.
- Add focused equivalence/negative tests for any changed revalidation contract,
  then repeat this real identity/native-Git/SQL/recorded-SDK case. The same command
  must recover one exact original after restart and acknowledge before its bound.
- Keep live activation, D1, model spending, provider writes and signed-in I1–I6
  acceptance closed. This repair needs engineering, not a new user approval.

## Selected repair

The generation-history projection repeatedly reconstructs the same retained scope
assessment inside each original and both role-observation readbacks. A private
[historical scope read window](../../packages/data/src/historical-scope-read-window.ts)
now brackets one read-only projection. Its first scope read is fully authoritative;
intermediate lineage checks reuse detached, frozen evidence while invoking their
own present caller/source authorization. Before the projection can return, a
second full read reopens the scope original, keys, lifecycle, batch observations
and profile/records authority. Any failure or changed evidence withholds the whole
projection. There is no publication, admission, transport or write inside this
window, and current-assessment reads do not use it.

The exact target and reader scope/object/method are pinned. Evidence cannot be
mutated by a caller or reused in another request; closure and the enclosing
30-second deadline reject late callbacks. Historical execution expiry may pass
during the read, but cannot be renewed. Latest draft revision, inventory, original
digests and batch results must remain identical. This is a bounded read-composition
change, not an atomic snapshot across all services, continuous authorization or a
cache of permission decisions. Outer draft/original/result readbacks and existing
identity, source, role, key and lifecycle checks remain in place.

Focused tests cover exact reuse, changed targets/readers, immutable detached
evidence, source/identity loss, nonvoid checks, final records/evidence loss,
expiry, cancellation, overlapping/unawaited reads and cleanup.

## Repaired joined result

The unchanged authenticated 34-source case now passes original preservation,
runtime reconstruction and identical reconfirmation with one encrypted original,
one save operation and no additional model reservation or Git mutation.

| Authenticated action | Duration | Native-provider requests |
| --- | ---: | ---: |
| Current source review | 3,704 ms | 3,973 |
| Corrected-scope preparation | 12,635 ms | 13,997 |
| Recorded corrected-scope read | 476 ms | 664 |
| Final candidate review | 8,493 ms | 9,342 |
| Candidate preview | 23,034 ms | 39,550 |
| Confirmation, discarded client reply | 46,926 ms | 79,532 |
| Reconfirmation after runtime reconstruction | 48,893 ms | 79,470 |
| Identical repeated reconfirmation | 50,069 ms | 79,468 |

Preview and confirmation request counts fell about 69%. The existing 90-second
confirmation bound is unchanged; both observed reconfirmations return `prepared`,
not `unknown`. This closes the measured confirmation-timeout defect, **not** the
remote-performance problem. Tens of thousands of synthetic provider requests and
47–50-second confirmation are not smooth human UX or a viable live-GitHub load
claim. A further bounded-authority read-composition/performance increment remains
necessary before real-provider/UI acceptance. Current corpus review and final
review counts were intentionally not optimized by this historical-only repair.
