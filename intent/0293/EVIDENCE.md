# Intent 0293 execution evidence

Base: `82a04de11d2e13964c1d86e050be0ecc3bb641ab`.
Progress: **68% (17/25; 8 remaining; +0 points)**. Partial C22, not live acceptance.

## Delivered behavior

Explicitly canonical items without CANDIDATE.json or proposals entries now read
their Brief/Spec directly using the verified global inventory and the original
source-grant, caller, byte/hash, mode and deadline checks. Any pointer/proposals
entry remains on the full catalog path. Missing/nonregular sources keep a per-item
gap; no canonical Exam or unrelated content enters scope. Lifecycle comes from
trusted selection, never filenames. Initial and final selections still execute,
including excluded roots, and revocation during selection blocks subsequent IO.

Retained evidence keeps both head reads and their full current-caller/all-grants
brackets. Adjacent brackets also cover the intervening metadata sweep. Four checks
replace seven; no selection, source grant, head read or source body is omitted.

Draft reads use metadata-only policy composition. Create/append retain full
before/after policy checks; every key access retains its full brackets. The
read-only distinction is private, not a caller flag, and cannot create lifecycle
or request a new key. The draft owner now tracks actual identity/policy/key work:
an inner five-second timeout cannot free its four-call admission while a callback
is still pending, and closure suppresses late continuation. Deadlines are unchanged.

## Tests and observed failures

The initial selection passed 43/44 checks; the expanded selection passed 34/35.
Both exposed the same existing exact-count test that still expected seven retained
freshness checks. Updating that expectation to four also adds explicit verification
that both head reads follow their own fresh barriers. No production code was
changed to silence the assertion. All **54 final focused tests pass**
(41,902.780 ms), including source parity, pointer fallback, revocation, source/key
restrictions, read/write order and inner-timeout admission across all three draft
methods. Prototype and all eight package types pass (4.868 s).

The isolated 34-source corpus diagnostic reduces caller validations from 222 to
141 with the same 52 repository requests. It uses a synthetic caller callback,
not actual authenticated latency evidence. The full joined measurement below
includes native Git-backed identity and the real constructor graph.

All **three authenticated joined checks plus idempotent migrations pass**. The
journey covers 34 sources, two scope batches, independent Architect/Test Agent
roles, correction, six synthetic model calls/reservations, one confirmation
original, one native save, discarded acknowledgements, restart, exact old-commit
reopen and current policy/Git-grant denial, without resend or duplication.

| Action | 0292 attempts | 0293 attempts | Reduction |
| --- | ---: | ---: | ---: |
| Draft read | 21 | 19 | 9.52% |
| Source review | 317 | 232 | 26.81% |
| Scope preparation | 1,250 | 932 | 25.44% |
| Save review | 1,106 | 930 | 15.91% |
| Save preview | 5,501 | 5,145 | 6.47% |
| First confirmation, discarded reply | 11,213 | 10,483 | 6.51% |

Drafting preparation uses 4,438 / 3,988 requests, down from 4,756 / 4,306.
Initial/recovery/repeated drafting starts remain 7,871 / 8,866 / 8,866. Scope-start
and scope-result-read counts are unchanged. Source review still fetches the same
43 source/marker bodies and uses 52 repository requests; identity requests fall
from 265 to 180. First confirmation still uses 428 repository requests. Reconstructed
confirmation includes both token refreshes (10,455); repeated confirmation uses
10,453. No expensive traffic is excluded from the count.

Recovery returns committed in 204 ms with 17 requests, 14 SQL phases, three valid
clock observations and no failures/reversals. The earlier 0289 recovery-unknown
observation remains retained and unexplained; this passing run does not fix or
explain it. Single undelayed durations are not warmed p95 or a reliable speedup
claim. [Raw measurements](PERFORMANCE.json) retain all action/preparation/start
samples, origin partitions, source/harness hashes and the delayed prefix.

Live models, records/D1 activation, runtime GitHub authority and actual signed-in
UI acceptance remain separate pending work. No credentials, model spending,
runtime provider grants/writes, signed source, gate, deployment, release or user
data changed. Full SQL, full continuation joined and complete performance protocol
are not claimed. Final broad/build and delayed-prefix results follow.

Both delayed-prefix integrity checks and idempotent migrations pass, while C22
correctly remains failed/incomplete. All twenty warmed, three reconstructed and
four concurrent draft reads per direction meet their bounds; warmed p95 is
546.138 ms (new-distinct) and 542.654 ms (proposal continuation). Source review
fails closed in both directions with HTTP 401, 202 attempts / 200 dispatches,
and no outstanding work at return (5,708.364 / 5,649.708 ms). There are no model
calls or saves in either prefix. Full later-stage performance remains unverified.
Joined and delayed-prefix runs completed before broad/build/SQL regressions started.

The first broad run passed 1,455/1,456 tests (152,863.304 ms). Its boundary checker
misparsed the new generic arrow as JSX. Adding a trailing comma to the type
parameter fixes this syntax ambiguity; no boundary rule or runtime behavior was
changed. Node v24.19.0's native TypeScript transform produces identical JavaScript
SHA-256 before and after: `f43f3a44848927354acfbfc1c281e8200566b8c28215e6573209837e8acccf2a`.
All 19 post-correction boundary/draft checks pass. Raw evidence keeps both measured
and final source hashes. Joined/SQL/prefix measurements precede this syntax-only
correction; their runtime JavaScript is identical.

Seventeen focused development-preparation HTTP/SQL checks plus idempotent
migrations pass, including source/provenance loss, stale/held drafts, exact
preparation recovery and fresh source reads after effects. The two-source native
comparison remains eight versus fourteen body reads and 52 versus 70 requests
with the same immutable original. This is not the full SQL suite.

The final broad rerun passes **1,456/1,456 tests**, with no failures, cancellations
or skips (151,041.753 ms). Prototype and all eight package typechecks pass after
the syntax correction (2.877 s); the Next.js 16.3.4 optimized build also passes.
The 95-artifact kit check, workflow-scope audit, source/harness fingerprints,
request partitions, local document links and unchanged signed-source checks pass.
Progress remains **68% (17/25; 8 remaining; +0 points)**: these changes improve
C22 but do not complete the performance checkpoint or real-user acceptance.
