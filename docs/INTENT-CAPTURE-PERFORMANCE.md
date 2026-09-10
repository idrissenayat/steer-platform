# Intent capture performance acceptance

Engineering benchmark version 1, established in [0284](../intent/0284/SPEC.md).
These are implementation-plan targets, not measured results, a signed architecture
amendment, a spending authorization or a production SLA. C22 in the
[fixed tracker](INTENT-CAPTURE-PROGRESS.md) remains pending until the measurements
below pass. Actual browser usability and live-provider acceptance remain C23–C25
and C21 respectively; this benchmark cannot substitute for them.

## Owned current-original scope start — 0316

[0316](../intent/0316/EVIDENCE.md) consolidates original reconstruction within
effect-separated read phases, retaining fresh independent grants and complete
final records/key readback. It excludes changing observations and results from
the original-only selection; it does not cache permission or cross scheduling.

| Authenticated synthetic action | 0315 attempts | 0316 attempts |
| --- | ---: | ---: |
| Scope start | 406 | 195 |
| Scope start recovery / repeat | 460 / 460 | 221 / 221 |
| Drafting start / recovery / repeat | 1,407 / 1,594 / 1,594 | 1,407 / 1,594 / 1,594 |

First scope start removes 211 attempts (51.97%); recovery/repeat remove 239
(51.96%). Only the first scope start is below 200 in these functional samples.
Recovery/repeat, scope preparation (292), drafting preparation (532 / 487),
save review (211), new-distinct preview/confirmation (330 / 853) and continuation
(440 / 1,073) still exceed 200. No complete performance checkpoint is earned.

Exact verification scope and samples: [0316 verification](../intent/0316/VERIFICATION.json).
These are undelayed synthetic runs on a shared host, not the unchanged 20 ms per
attempt, five-second p95, 20 warm / three cold / four concurrent protocol in both
directions plus negatives. Next consolidate drafting-start current-original reads,
then remaining preparation and confirmation controls. Do not relax thresholds or
infer browser, live provider or real-model acceptance.
**68% (17/25; eight remaining; +0 percentage points).**

## Preparation and scope-start metadata authority — 0315

[0315](../intent/0315/EVIDENCE.md) removes redundant pre-policy caller traversal
for explicit metadata-only reads. All policies, fresh caller validation before
storage continuation and full key/content/effect barriers remain.

| Authenticated synthetic action | 0314 attempts | 0315 attempts |
| --- | ---: | ---: |
| Scope preparation | 320 | 292 |
| Scope start / recovery / repeat | 596 / 676 / 676 | 406 / 460 / 460 |
| Drafting preparation / repeated preparation | 594 / 548 | 532 / 487 |
| Drafting start / recovery / repeat | 1,407 / 1,594 / 1,594 | 1,407 / 1,594 / 1,594 |

First scope start improves by 190 attempts (31.88%). Save review remains 211;
new-distinct preview/confirmation remain 330 / 853 and continuation 440 / 1,073.
Every action above still exceeds 200. No latency or live-UI acceptance is inferred
from undelayed functional samples on a shared host. Exact samples and tests are in
[verification](../intent/0315/VERIFICATION.json). Next consolidate current-original
records reads in preparation/start phases and remaining confirmation controls;
full independent policy/key/source validation and effect separation must remain.
The unchanged complete warm/cold/concurrent protocol is still required.
**68% (17/25; eight remaining; +0 percentage points).**

## Owned current-source validation phase — 0314

[0314](../intent/0314/EVIDENCE.md) removes repeated complete review reconstruction
inside one source phase, with fresh authority per consumption and complete final
draft/evidence comparison. The corpus owner retains final validation, followed by
an exact draft reread. Independent caller checks remain active during dependent IO.

| Authenticated synthetic action | 0313 attempts | 0314 attempts |
| --- | ---: | ---: |
| Save review, either direction | 224 | 211 |
| New-distinct preview | 343 | 330 |
| New-distinct confirmation / recovery / repeat | 879 / 851 / 849 | 853 / 825 / 823 |
| Proposal-continuation preview | 453 | 440 |
| Proposal-continuation confirmation / recovery / repeat | 1,099 / 1,071 / 1,069 | 1,073 / 1,045 / 1,043 |

This saves 13 attempts per review/preview and 26 per confirmation, but none of
these actions meets the 200-attempt limit. Preview still contains 308 identity-head
checks for new-distinct and 400 for continuation. Scope preparation remains 320;
scope start 596 / 676 / 676; drafting preparation 594 / 548 and drafting start
1,407 / 1,594 / 1,594. The next work is action-level current-draft/authority and
preparation/start read composition, preserving separate pre-/post-effect phases.
Another source-only reduction is not a substitute for whole-action acceptance.

Both synthetic native save/recovery/reopen selections pass. Undelayed functional
samples shared the host with regression tests; they are not p95, live-provider or
UI measurements. Full unchanged warm/cold/concurrent acceptance remains required.
Exact samples and scope: [verification](../intent/0314/VERIFICATION.json).
**68% (17/25; eight remaining; +0 percentage points).**

## Destination membership and authority integration — 0313

[0313](../intent/0313/EVIDENCE.md) reuses the exact native inventory for destination
artifact reads and the existing private authorizer bracket for nested bundle reads.
Independent per-source checks remain; metadata-only grant groups use fresh caller
checks before and after, with no content IO or effects within the group. Full
pointer/manifest/documents, target surface, lifecycle and final head checks remain.

| Authenticated synthetic action | 0312 attempts | 0313 attempts |
| --- | ---: | ---: |
| New-distinct preview | 343 | 343 |
| New-distinct confirmation / recovery / repeat | 879 / 851 / 849 | 879 / 851 / 849 |
| Proposal-continuation preview | 633 | 453 |
| Proposal-continuation confirmation / recovery / repeat | 1,459 / 1,431 / 1,429 | 1,099 / 1,071 / 1,069 |

Continuation falls by 180 requests per preview (28.44%) and 360 per confirmation
(24.67% for first confirmation). New-distinct is unchanged. These actions remain
over 200, as do scope/drafting preparation and start paths recorded below. Next
consolidate remaining repeated current-source/draft validations and preparation/
start effect boundaries. The whole-action protocol, not another isolated request
reduction, is the C22 acceptance condition. Exact samples and verification scope
are in [0313](../intent/0313/VERIFICATION.json). No live-provider or UI measurement
is claimed. **68% (17/25; eight remaining; +0 points).**

## Shared final-review phase in preview — 0312

[0312](../intent/0312/EVIDENCE.md) consolidates repeated full final reviews within
one read-only preview. Initial validation is lazy, each consumption checks current
authority, and full draft/source/scope validation follows dependent work. Final
source closure and separate pre-/post-effect preview phases remain intact.

| Authenticated synthetic action | 0311 attempts | 0312 attempts |
| --- | ---: | ---: |
| New-distinct preview | 485 | 343 |
| New-distinct first confirmation | 1,163 | 879 |
| Proposal-continuation preview | 775 | 633 |
| Proposal-continuation first confirmation | 1,743 | 1,459 |

The reduction is 142 attempts per preview and 284 per confirmation, about 29%
and 24% respectively for new-distinct. All four actions remain above 200. Scope
preparation/start and drafting preparation/start also remain above the ceiling;
this change does not address them. New-distinct preview still contains 321
identity-head checks. Continuation's destination validation adds 290 requests
relative to new-distinct. Next address remaining source/draft and destination
read phases plus effect-separated preparation/start controls. Source sharing or
one more isolated preview reduction cannot establish whole-action acceptance.

Exact verification scope and samples: [0312](../intent/0312/VERIFICATION.json).
These undelayed, synthetic functional runs shared the host with regression tests
and are not p95 or UI measurements. The complete unchanged protocol below remains
required. **68% (17/25; eight remaining; +0 percentage points).**

## Shared generation phase in preview — 0311

[0311](../intent/0311/EVIDENCE.md) shares one owned original/history computation
through the dependent reads of a single preview, with fresh per-consumption
policies, final records/key/source readback and actual pending-work drain. Each
separate confirmation validation still opens a new phase. No authority crosses
admission, persistence, scheduling or publication effects.

| Authenticated synthetic action | 0310 attempts | 0311 attempts |
| --- | ---: | ---: |
| New-distinct preview | 509 | 485 |
| New-distinct confirmation / recovery / repeat | 1,211 / 1,183 / 1,181 | 1,163 / 1,135 / 1,133 |
| Proposal-continuation preview | 799 | 775 |
| Proposal-continuation confirmation / recovery / repeat | 1,791 / 1,763 / 1,761 | 1,743 / 1,715 / 1,713 |

This is a small improvement, not a resolution of C22. The new-distinct preview
still has 463 identity-head attempts out of 485 total; save review alone remains
224 attempts. Repeated surrounding current-draft/source/scope reviews and
destination/preparation checks remain the next integration target. Do not infer
that removing additional original reads alone will meet the whole-action budget.
Exact samples and verification are in [0311](../intent/0311/VERIFICATION.json).
These undelayed functional runs are not the required p95 protocol or UI acceptance.
Overall remains **68% (17/25; eight remaining; +0 points)**.

## Owned development history integration — 0310

[0310](../intent/0310/EVIDENCE.md) connects retained development history to the
actual factory, with separately authorized development and scope read sets and
the existing canonical SDK/worker verifier. Both real leases are rechecked and
drained; there is no cached permission, deadline increase or weaker lineage check.

| Authenticated synthetic action | 0309 attempts | 0310 attempts |
| --- | ---: | ---: |
| New-distinct preview | 1,815 | 509 |
| New-distinct confirmation / recovery / repeat | 3,823 / 3,795 / 3,793 | 1,211 / 1,183 / 1,181 |
| Proposal-continuation preview | 2,105 | 799 |
| Proposal-continuation confirmation / recovery / repeat | 4,403 / 4,375 / 4,373 | 1,791 / 1,763 / 1,761 |

Scope read remains 25; source review 75; scope preparation 320; scope start
596 / 676 / 676; drafting preparation 594 / 548; drafting start
1,407 / 1,594 / 1,594; save review 224. These are counted synthetic application
actions, not actual provider authority or user-visible latency measurements.
Smoke runs share the host with other verification and are not the fixed latency
protocol. Exact samples, verification scope and failed iterations are in
[verification](../intent/0310/VERIFICATION.json).

Next integrate remaining original/preparation/confirmation read phases and their
effect-separated controls. C22 stays pending: no action over 200 attempts passes,
and none of these samples substitutes for the full warm/cold/concurrent protocol.
The fixed completion report remains **68% (17/25; eight remaining; +0 points)**.

## Owned scope service integration — 0309

[0309](../intent/0309/EVIDENCE.md) connects current/history scope projections to
the owned metadata-first records reader, canonical codecs and SDK verification.
The actual constructor graph uses explicit separate records/key authorities; no
permission cache, raised deadline or relaxed source check is introduced.

| Authenticated synthetic action | 0308 attempts | 0309 attempts |
| --- | ---: | ---: |
| Scope read | 227 | 25 |
| Drafting preparation, first / recovery | 3,826 / 3,376 | 594 / 548 |
| Drafting start, first / recovery / repeat | 7,871 / 8,866 / 8,866 | 1,407 / 1,594 / 1,594 |
| Final save review | 628 | 224 |
| New-distinct preview | 3,447 | 1,815 |
| New-distinct confirmation / recovery / repeat | 7,087 / 7,059 / 7,057 | 3,823 / 3,795 / 3,793 |

Source review remains 75; scope preparation 320; scope start 596 / 676 / 676.
Proposal-continuation has its own destination-read cost and must not be compared
with the new-distinct baseline. Exact verification, samples and failed iterations
are retained in [verification](../intent/0309/VERIFICATION.json).
Undelayed samples and passing synthetic functional journeys are not the complete
20 ms / 200-attempt / five-second p95 warm/cold/concurrent acceptance protocol.

Next integrate development originals/results/history and remaining effect-separated
action boundaries. C22 remains pending, with the original denominator and limits.
No live model, actual runtime GitHub save, profile activation or UI claim is made.

## Application corpus integration — 0308

[0308](../intent/0308/EVIDENCE.md) connects the owned native corpus to the actual
source-review and scope/development preparation constructors. Unknown adapters
retain compatibility; a failed native read never selects fallback. Current partial
search remains explicit and historical verification remains strict. Blob batches
count as provider read attempts, not mutations, with all identity traffic included.

Authenticated synthetic counts are now source review **75** (was 210), scope
preparation **320** (was 844), new-distinct save review **628** (was 871), preview
**3,447** (was 3,722), and confirmation/recovery/repeat **7,087 / 7,059 / 7,057**
(was 7,637 / 7,609 / 7,607). Drafting preparation is 3,826 / 3,376; scope start,
scope read and drafting start retain their prior counts. These are whole-action
counts in the authenticated synthetic journey, not a live UI measurement.

The unchanged delayed prefix passes for both new-distinct and proposal-continuation:
20 warm, three cold and four concurrent draft reads, plus one source review each.
Each source review uses 75 attempts. Single source-review samples are not its p95;
the full multi-action C22 benchmark still has not passed. Exact samples, earlier
failures and final verification scope are in [verification](../intent/0308/VERIFICATION.json).

Next bind records/history, authorized discovery and remaining action/effect controls.
Neither the fixed 200-attempt/5-second limits nor the 25-checkpoint denominator
changes. Source-only integration is insufficient to close the remaining bottleneck.

## Production SDK and recorded-history verification — 0307

[0307](../intent/0307/EVIDENCE.md) uses actual production SDK and worker schemas
over the owned content reader, including exact scope-to-development lineage and
partial-history handling. Thirty-seven native isolation cases and 44 focused tests
pass. The portion retains 52 simulated attempts, 51 SQL statements, 80 record
policies, 40 key policies and two key reads. A single undelayed 1,652 ms sample
with an extra test comparison oracle is not p95 or an accepted application budget.

The actual factory remains unchanged: confirmation/recovery/repeat are 7,637 /
7,609 / 7,607. Next bind actual services, authorized stage-specific discovery and
effect-separated phases to these shared readers. The 200-attempt/5-second limits,
full warm/cold/concurrent protocol and eight pending checkpoints remain unchanged.

## Canonical content and owned key access — 0306

[0306](../intent/0306/EVIDENCE.md) composes the metadata-first reader with the actual
production encryption codecs and independent per-group key policies. It shares
key material only within an invocation and one exact provider identity, preserves
final key/records/source checks and drains pending work. It does not install an
application service or establish SDK/source authority merely by decoding records.

The native selection uses a separate test-only SDK/crypto comparison oracle, so
its extra 20 local decodes are reported separately. The portion uses 52 simulated
attempts, 51 SQL statements, 80 record policies, 40 key policies and two reads of
one key. Its single undelayed 1,820 ms sample does not substitute for the full
benchmark. Application confirmation/recovery/repeat remain 7,637 / 7,609 / 7,607
and still use the existing readers. Complete SDK/lineage/service
composition and outer effect phases before measuring the unchanged C22 protocol.

## Owned metadata-first records reader — 0305

The [production-source records owner](../intent/0305/EVIDENCE.md) replaces the
test-only SQL reader in the combined native experiment. Explicit per-group grants
precede ciphertext retrieval, and full final rows/lifecycle remain mandatory.
The portion uses 56 simulated provider attempts (12 source repository, 43 identity,
one JWKS), 38 caller checks, 13 metadata grants, 80 record policies, six role
transactions/51 SQL statements and two checks of one physical key. Twenty encrypted
rows and six recorded SDK exchanges pass, with final source revocation and expiry
denials. The initial native null-budget mismatch and its correction are retained.

Its single undelayed 1,592 ms sample is not p95 or an accepted allocation. Policy
services and the crypto oracle are still synthetic/test-only. The application
factory is unchanged: confirmation/recovery/repeat remain 7,637 / 7,609 / 7,607.
Complete production codec/key-policy and outer-action/effect integration before
the full unchanged C22 benchmark; this portion alone earns no progress point.

## Owned native corpus graph — 0304

The [production-source graph](../intent/0304/EVIDENCE.md) owns current/historical
source collection and final closure after dependent work. The native records/source
selection measures 53 simulated attempts (12 source repository, 40 identity-provider
and one JWKS), with 35 caller checks, 252 revision/path policies and full final
records/key readback. A single local 1,686 ms sample has no injected latency and is
not p95. The isolated component's 32-attempt sample uses a simpler caller stand-in;
it is not directly comparable and does not validate the proposed 30-attempt corpus
allocation. No component allocation or full-action budget is accepted here.

Ordinary factory/HTTP actions still use the old collectors: confirmation/recovery/
repeat remain 7,637 / 7,609 / 7,607 in the same native run. Independent production
records/key policies, full lifecycle authority and owned outer effect phases remain
to integrate before the complete unchanged C22 protocol. Do not interpret either
component measurement as an installed application speedup or completed checkpoint.

## Application GitHub batch primitive — 0303

The [native adapter primitive](../intent/0303/EVIDENCE.md) reads up to 100 distinct
revision/path references with at most 16 object aliases per request and a conservative
2 MiB response budget. A native fixture verifies four references sharing two objects
in one content query, and 17 distinct small objects in two. These are component
query counts with synthetic policy callbacks, not all-provider action totals.
Existing caller, source-policy, scoped-token, immutable-membership and byte checks
remain mandatory. No collector/factory automatically uses this primitive yet.
The last whole-confirmation measurement remains 7,637. Complete owned corpus/records
and outer-effect integration under [0298](../intent/0298/REQUEST-BUDGET-PLAN.md),
then measure the full unchanged C22 protocol; this component does not close C22.

## Combined lifetime experiment — 0302

The [final native lifetime check](../intent/0302/EVIDENCE.md) keeps the earliest
draft/candidate deadline effective through final source checks and return. Late
expiry, invalid times and regressing clocks reject without a new provider read.
The combined experiment still uses 52 attempts; application confirmation still
uses 7,637. The 1,534 ms local sample is not delayed p95 or a full action. Independent
production policies, ownership and outer effect integration remain unproven. C22
and all fixed request/latency acceptance limits are unchanged.

## Combined records and multi-revision graph experiment — 0301

The [combined native comparison](../intent/0301/EVIDENCE.md) measures the same
records/retained-source portion with separate readers (74 attempts) and one
bounded revision graph (50 attempts). The two retained revisions share 40 immutable
objects; each still receives its own membership/selection and 126 path-policy
checks. The graph's 12 repository plus 16 identity attempts fit the proposed
30-attempt corpus portion for this fixture. That is not whole-phase acceptance:
production policies, final cross-component source closure, outer callbacks,
ownership and separate phases around effects remain unproven. Full confirmation
still costs 7,637. No production installation or completed C22 is claimed.

Single local samples (3,116 / 1,621 ms) have no injected network delay and are not
p95, comparable to a records-only sample, or actual user-action latency. The
200-attempt/5-second limits and full warm/cold/concurrent protocol are unchanged.

The [final-source follow-up](../intent/0301/FINAL-SOURCE-CLOSURE.json) adds two fresh
identity checks and moves records/key readback inside the source phase. The updated
combined stage costs **52**, not 50, and rejects source revocation after records
readback. Eleven focused tests, the native selection and final types pass. This
does not prove lifecycle expiry through final closure, independent production
policies, owner drainage or outer effect integration. Full confirmation stays 7,637.

## Records protocol experiment — 0300

The [native records experiment](../intent/0300/EVIDENCE.md) reads and fully rechecks
the actual synthetic journey's records through existing PostgreSQL runtime roles.
It reconstructs 20 encrypted records and six SDK exchanges using 22 simulated
provider attempts (including identity/bootstrap), four transactions and 34 SQL
statements. This is a records portion, **not a 22-request confirmation action**.
The current confirmation still costs 7,637 attempts. Fixture policy calls are
counted but production per-purpose policies, all outer callbacks/effects and owner
drainage are not integrated. A single local elapsed sample is not delayed p95.
The records allocation and whole C22 remain unaccepted. Next prove the combined
boundary plan, integrate the coherent correction and run the full protocol below.

## Representative interactive budget

Use the existing authenticated 34-source journey, both new-distinct and proposal
continuation, with native Git, encrypted disposable PostgreSQL, fixed Temporal
workflows and synthetic model replies. Preserve both separate drafting roles,
human correction, exact confirmation, one save and exact reopen. No service-result
stubs may replace the actual service composition.

For source review, scope preparation, drafting admission/start acknowledgement,
save review, preview and confirmation, target **at most five seconds p95** from
authenticated request receipt to response under **20 ms added delay per provider
attempt**, counting identity and repository traffic together. Waiting for an
asynchronous model to finish is separate from its admission/start acknowledgement;
the response must not falsely claim generated documents or a save are complete.

Set a **200 provider-attempt ceiling per interactive request** for this fixed
34-source benchmark. This allocates four seconds of the five-second target to
200 sequential 20 ms round trips, leaving one second for local work. It is a
conservative request-load budget even where safe bounded concurrency reduces
wall-clock time. It is not a universal limit for arbitrary repository sizes.
Include fresh head checks, grant-document reads, token acquisition and retries;
do not exclude expensive identity traffic or weaken checks to meet the number.

## Required measurement protocol

1. Report all per-action counts, identity/repository partitions and latency samples.
   Inject delay only in disposable fixture transports. Never slow or load the
   user's real issuer, repository or model provider for this benchmark.
2. Run at least 20 sequential warmed measurements per action/direction, plus three
   cold/reconstructed-runtime measurements. Calculate p95 by nearest rank, keep
   every sample and report the maximum. All warmed samples must meet the request
   ceiling; p95 and each cold run must meet the five-second limit. A failed or
   timed-out sample is a failure, not an omitted outlier.
3. Repeat with four overlapping admitted calls and report aggregate load and
   per-call latency. Each call must remain within the same bounds; admission
   above the existing four-call limit must fail promptly without duplicate effects.
   Preserve owner admission while timed-out dependencies drain.
4. Exercise source/records/key/hold/identity revocation, changed heads, stale edits,
   owner shutdown and lost responses around the optimized boundaries. Unsafe
   cases must deny or report uncertainty without stale data, a duplicate dispatch,
   a second original, an extra reservation or another save. A fast unsafe response
   is never a performance pass.
5. Record fixture size, exact source commit, software versions, hardware/load,
   delay injection, concurrent work and cold/warm distinction. Compare like-for-like
   request counts separately from variable single-run local timings. Keep a
   larger-corpus scaling diagnostic separate; do not present this fixed-fixture
   result as proof of unlimited scale.

## Current gap and next work

Prior: [0299](../intent/0299/EVIDENCE.md) verifies a test-only corpus batch protocol:
42 distinct files, the same 34 semantic sources, five dependency queries and 27
simulated provider attempts, including separate identity and repository tokens.
All 126 per-source policy calls execute. Metadata authorities are synthetic and
the caller stand-in is not the complete authenticated resolver, so this does not
accept even the integrated corpus allocation, much less whole-action C22.
The 30-document / 128 KiB size diagnostic preserves bytes but uses 63 attempts;
it is not a representative-budget or universal-size performance pass.

Follow-up [authorization evidence](../intent/0299/AUTHORIZATION.json) replaces the
head-only caller with actual OIDC/Git grant verification: cold bootstrap seven plus
one corpus phase 26 equals 33 attempts. The next request totals 31; two independent
phases total 57 with a five-attempt warm-process bootstrap. All traffic is retained;
26 is not the cold total. Three revocation/expiry/composition tests pass. Source
metadata remains synthetic, and HTTP/records/effect-boundary acceptance is open.

No production source changes; actual confirmation remains 7,637. Next complete
the records/history/key/policy and outer-callback feasibility portion before
integrating the coherent correction. See [results](../intent/0299/FEASIBILITY.json).
The ceiling, full benchmark and prior failed samples below remain unchanged.

Prior: [0298](../intent/0298/EVIDENCE.md) completes a diagnostic/plan increment,
not a production optimization. All 45 HTTP invocations in each synthetic run are
retained; identity vectors match exactly (81,500 attempts each), with no origin
capture errors or overflow. Confirmation stays 7,637 attempts: 7,491 identity
and 146 repository. [The trace](../intent/0298/PROFILE.json) separates scope,
history, preview and confirmation-own costs.

The current unbatched corpus protocol has a **258-attempt lower bound** for two
independent previews of 43 blobs with two fresh caller checks each. It cannot fit
200 even if all other work becomes free. The next step is the
[bounded boundary/batch experiment and whole-read-graph correction](../intent/0298/REQUEST-BUDGET-PLAN.md),
including explicit proposed component budgets and stop conditions. These budgets
are unproven design allocations; the ceiling and entire protocol above remain
unchanged. Do not continue presenting partial records/body reductions as a
sufficient path to acceptance. No latency, live acceptance or higher progress is
claimed; C22 stays pending at 68% (17/25).

Prior: [0297](../intent/0297/EVIDENCE.md) shares exact immutable source evidence
through every repeated review within one read-only preview. Confirmation's two
previews retain independent sessions separated by persistence. All current grants,
head/draft/provenance/history/scope/destination checks and final readback remain.

Repository-body downloads drop **75%**: preview **172 → 43**, confirmation
**344 → 86**. Total attempts fall **4,017 → 3,722** (7.34%) and **8,227 → 7,637**
(7.17%). Reconstructed/repeated confirmation use 7,609 / 7,607. Standalone save
review falls only 886 → 871: new session/final-draft guards add 32 identity-head
checks even as body reads halve. All traffic is retained in
[raw samples](../intent/0297/PERFORMANCE.json), not hidden behind the body metric.

The authenticated synthetic save/recovery/reopen and final regression pass. This
is still partial C22: first confirmation performs 7,488 identity-head checks;
source review stays 210. Next consolidate whole records/result/observation and
current-identity validation within each read-only phase, keeping independent
policies and fresh authority at content/effect/release boundaries. Body-only
improvements cannot meet the unchanged 200-attempt ceiling. Finish the remaining
source gap, then run the complete protocol above. Other checks overlap portions
of the single undelayed diagnostic; its timings are not warmed p95 or a speedup
claim. Prior failed evidence, live prerequisites and the fixed 17/25 tracker remain.

Prior: [0296](../intent/0296/EVIDENCE.md) removes only redundant leading identity
checks around explicitly proven metadata-only historical source queries. Preview
falls from 4,957 to **4,017** requests (18.96%); first confirmation from 10,107 to
**8,227** (18.60%). Every source policy still runs, followed by fresh caller checks
before data/continuation; initial authentication and full final history reads remain.
Source review remains 210 and other preparation/start counts are unchanged.
[Raw samples](../intent/0296/PERFORMANCE.json) retain the request partitions.

This is partial C22, not latency or live acceptance. Broad regression overlaps the
beginning of this single undelayed diagnostic; timings are not comparable p95.
Confirmation still downloads **344 repository blobs**, greater than the entire
200-attempt budget before identity/metadata traffic. Next consolidate exact
immutable-source reads alongside identity/records validation within each read-only
phase, with fresh grants/head checks and no reuse across writes/requests. Do not
spend more source-only or identity-only increments claiming they can close C22.

[0295](../intent/0295/EVIDENCE.md) consolidates retained-original reads
across history and observations with fresh intermediate key/lifecycle/authority
checks and full first/final source readback. Preview falls from 5,057 to **4,957**
requests (1.98%); first confirmation from 10,307 to **10,107** (1.94%). Reconstructed
and repeated confirmation use 10,079 / 10,077. This is only a small partial reduction:
confirmation still exceeds the ceiling by more than 50 times. Source review stays
210; scope/drafting preparation and start counts are unchanged.

The authenticated synthetic save/recovery/reopen, final records verification and
1,468 broad tests pass. [Raw measurements](../intent/0295/PERFORMANCE.json) retain
all 12 action, two preparation, nine start and recovery samples. Single undelayed
preview/first-confirmation times are 8,872 / 17,887 ms, not warmed p95 or a timing
speedup claim. No delayed prefix, full performance protocol or live acceptance
was run. Next target repeated result/observation/operation and source-authority
traversal across the whole read set; original-only consolidation is insufficient.

[0294](../intent/0294/EVIDENCE.md) forwards privately proven source reads
through the catalog while retaining actual parent callback admission. Source
review is **210** requests, scope preparation **844**, save preview **5,057**,
first confirmation **10,307** and drafting preparation **4,350 / 3,900**. Every
repository/body request remains. The authenticated synthetic journey passes;
all counts are still single undelayed samples, not warmed p95. The delayed prefix
was not rerun because even source review remains above the unchanged 200-attempt
ceiling. Prior delayed failures remain retained, not counted as current passes.
[Raw measurements](../intent/0294/PERFORMANCE.json) include all action, preparation,
start and recovery samples. Prioritize bulk records/history read consolidation
across the entire save path; source-only reductions cannot finish this checkpoint.

[0293](../intent/0293/EVIDENCE.md) reads explicitly canonical pointer-free
items without redundant directory catalogs, consolidates metadata-only selection/
freshness checks, and reduces draft-read policy traversal while preserving write
and key barriers. Source review drops from 317 to **232** attempts (26.81%), scope
preparation from 1,250 to **932** (25.44%), and first confirmation from 11,213 to
**10,483** (6.51%). All source bodies and repository requests remain; savings are
identity traffic. The authenticated synthetic save/recovery/reopen passes.

Both delayed prefix integrity checks pass but report the C22 failure: source
review returns HTTP 401 at 202 attempts / 200 dispatches with no late work. Warmed
draft-read p95 is 546.138 / 542.654 ms; all three cold and four concurrent draft
reads per direction meet their bounds. These draft results and the failed prefix
are not complete performance acceptance. [Raw samples](../intent/0293/PERFORMANCE.json)
retain every measurement. Next remove remaining catalog/read boundary duplication
and address bulk records validation; do not change the request ceiling.

[0292](../intent/0292/EVIDENCE.md) reduces nested records metadata-policy
traversal, without caching permission or changing content/key/SDK/effect barriers.
Compared with 0291, scope-result reads fall from 337 to 227 requests, save review
from 1,326 to 1,106, preview from 7,309 to 5,501 and first confirmation from 14,829
to 11,213 (24.38%). Initial/repeated drafting preparation falls from 6,516 / 5,846
to 4,756 / 4,306, and initial drafting start from 11,537 to 7,871.
The authenticated synthetic save/recovery/reopen passes. Source review remains
317 and scope preparation 1,250; neither improved in this increment.

[Raw samples](../intent/0292/PERFORMANCE.json) retain all twelve action samples,
two preparations, nine start logs, origin partitions and recovery diagnostics.
The source-review delayed prefix was not rerun because it stops before these
changed records readers; its prior failure remains open. No full warmed/cold/
concurrent protocol, p95, actual UI or live provider acceptance is claimed.
Next reduce remaining identity-policy/records traversal, not raise the 200-attempt
ceiling. The historical account below preserves earlier positive and failed evidence.

0283's new-distinct confirmation used 60,372 attempts and 37.6 seconds without
injected network delay. The history-barrier optimization in 0284 is a partial
reduction only. [0285](../intent/0285/EVIDENCE.md) adds an executable **prefix**, not
the complete benchmark: twenty warmed, three reconstructed and four concurrent
authenticated draft reads per direction, followed by a bounded source-review
probe. Draft reads meet their prefix targets; source review exceeds the request
ceiling and fails closed. [Raw samples](../intent/0285/PERFORMANCE.json) retain the
negative result. Later stages, full repeated/concurrent failure protocol, origin
partitions and issuer/JWKS latency remain unimplemented or unverified.
[0286](../intent/0286/EVIDENCE.md) removes another class of privately proven
duplicate nested repository-read policy checks. The observed undelayed source
review now uses 2,634 rather than 3,042 requests; confirmation uses 45,716 rather
than 48,980. Both are still far above the 200-attempt target, and the delayed prefix
still fails closed. Counts and single-run local latency are separate evidence;
the latter is not a warmed p95 or a reliable speedup claim.

[0287](../intent/0287/EVIDENCE.md) adds separate read-only windows around each
scope-preparation validation pair, closing before admission/persistence and opening
fresh afterward. Preparation falls from 11,365 to 9,598 requests (15.55%): identity
traffic 10,434 to 9,054, repository traffic 931 to 544. The single undelayed local
sample is 9,619 ms, not warmed p95. Source review (2,634), first confirmation
(45,716), and drafting-start counts are unchanged; the
[raw artifact](../intent/0287/PERFORMANCE.json) preserves all samples and origin
partitions. The delayed prefix was not rerun because it stops before this changed
boundary. Its prior source-review failure and the full later-stage protocol remain
open. No new latency or C22 acceptance is claimed.

[0288](../intent/0288/EVIDENCE.md) removes only privately proven duplicate caller
barriers in read-only current-scope validation. Drafting start drops from 41,768
to 23,064 requests (44.78%); receipt recovery/repeated starts drop from 47,350 to
25,974 (45.14%). The single local samples are 10,887 / 12,027 / 12,123 ms, not
warmed p95. Start logs do not yet partition those counts by origin. The twelve
corrected-package counts and their recorded origin partitions stay unchanged;
see [raw measurements](../intent/0288/PERFORMANCE.json). Both full current scope
reads and all independent policies remain. The complete synthetic save/reopen
regression passes, but no delayed prefix or complete performance acceptance is
claimed; the earliest source-review limit remains open.

[0289](../intent/0289/EVIDENCE.md) applies separate read-only windows to drafting
preparation. The native two-source fallback comparison reduces requests from 70
to 52 (25.71%) and body reads from fourteen to eight, with the same original and
fresh reads after each effect. The managed 34-source journey now logs preparation:
20,130 requests initially and 18,790 when repeated, with identity traffic of
19,586 / 18,246 and repository traffic of 544 in each. There is no earlier managed
preparation baseline. Final-run local times are 14,868 / 13,562 ms; they are not
warmed p95 or a latency speedup. Both are far above the 200-attempt budget.

The [raw artifact](../intent/0289/PERFORMANCE.json) retains the failed first joined
run and the passing final rerun. The first run failed at already-sent durable
recovery after one verified native commit/HTTP receipt; the final run completed
reconciliation and exact old-commit reopen. Root cause is unestablished, not fixed
by a rerun. Forty focused save/recovery checks also pass. All twelve corrected-
package request counts/partitions and drafting-start counts remain unchanged from
0288. The delayed prefix and other full dispositions were not rerun.

[0290](../intent/0290/EVIDENCE.md) adds a bounded diagnostic for the retained
already-sent recovery observation. Twenty ordinary and twenty 2-ms-SQL-delay
repetitions pass on the final harness, with 920 clock samples and no database
failures/reversals. This is a smaller native fixture, not the 34-source authenticated
performance protocol; its timings cannot be substituted for interactive latency.
No production code, request counts or deadlines changed. The unexplained 0289
failure remains recorded, and its cause was not established by these repetitions.
The new content-free trace separates leases/resets/late completions and is
available when the full joined recovery assertion is next exercised.

[0291](../intent/0291/EVIDENCE.md) consolidates metadata-only permission queries,
preserving every independent policy and fresh caller checks before content
IO/effects and before results escape. Retained-source sweeps use exact current
all-grants revisions, not permission caches. Native readers reuse only their own
exact frozen commit/tree membership; all 43 source/marker bodies are still fetched
and verified in source review. Unknown readers retain their full original path.

The final authenticated undelayed source review uses **317 attempts** (265 identity,
52 repository), versus 2,634. Scope preparation uses **1,250** versus 9,598; first
confirmation uses **14,829** versus 45,716. Initial/repeated drafting preparation
uses 6,516 / 5,846; initial drafting start uses 11,537. The complete synthetic
save/recovery/reopen selection passes. These reductions do not establish warmed
p95 or C22; even source review remains above 200. [Raw measurements](../intent/0291/PERFORMANCE.json)
preserve source hashes, preliminary/final samples and request-origin partitions.
The earlier 0289 recovery uncertainty remains recorded and unexplained.

The final 0291 delayed prefix retains all 20 warmed, three reconstructed and four
concurrent draft reads per direction; draft-read warmed p95 is 601.545 / 592.283 ms
and all draft groups meet their bounds. Source review still fails closed in both
directions at 202 attempts / 200 dispatches (HTTP 401, 5,509.654 / 5,480.445 ms),
with no late work at return. Two prefix integrity checks passing does not make
those performance failures a C22 pass. An initial truncated tool-output capture
was repeated separately on unchanged code; the final raw reports are complete.

Next retain diagnostics for any recovery-unknown recurrence and reduce remaining
repeated identity-policy traversal, including source review and final-package
verification, then extend the prefix to later stages
and the full measurement protocol. Preserve every independent policy and fresh
revocation boundary. No permission cache, longer deadline, hidden background write
or substituted preview is an acceptable shortcut.
