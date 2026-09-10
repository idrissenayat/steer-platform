# Managed intent journey in the authenticated runtime

0271 adds an optional governed binding in the existing identity composition root.
It uses the actual application HTTP and, when explicitly configured, MCP transport.
It does not start a second application, bypass authentication or install a live
profile. The deployed/local real-user configuration remains unchanged.

## Binding and authority

A runtime profile must name the exact organization, owner, product, repository,
branch, records configuration revision/policy digest and candidate item allowlist.
It must be paired with both a trusted `createIntentJourney` factory and a distinct
`authorizeIntentJourney` policy service. None of these can substitute for another.
The organization/repository/branch must match the configured Git binding.

The current activation policy is checked before construction and again before
the runtime is exposed. The factory transfers a complete inventory of 21 existing
journey services plus a separate internal publication-recording service and owned
shutdown. Partial inventories, unrelated writer overrides, missing methods and
foreign owner/home/configuration/branch/item scopes fail initialization. Plaintext
or document-bearing scope extensions are not accepted. A legacy unrecorded agent
or model-gateway binding cannot be installed alongside this recorded journey.

The policy service must independently verify actual records adoption and approved
runtime bindings. Matching hashes or a test callback are not approval. Each method
also rechecks current bundle-use permission around work and through the service's
existing revalidation callback. OIDC verification, current Git grants, human-only
commands and each service's records/key/source/consent/gate/model/provider checks
remain in force. Bundle activation is never action-time write authority.

Only pinned explicit methods and reference scopes reach the tool registry. Changes
to a service, method, scope or configuration invalidate the binding. Current policy
failure withholds results; a late failure cannot undo a committed effect or permit
a replacement operation. Existing original-reference recovery remains necessary.

## Ownership and shutdown

The managed bundle permits four calls in flight across all its services. Identity
and bundle-use callbacks have five-second limits; a call has a 120-second outer
bound without extending its underlying service's tighter limits. Timed-out work
holds its admission until the actual dependency settles. Late revalidation fails,
so timed-out work cannot restore an acknowledgement or authorize another effect.

Shutdown closes transport admission, drains active requests and pending managed
work, closes the owned journey once, then closes shared identity/read-model pools
and other runtime resources. This fixes the previous browser-only gap where newer
intent services were not included in drain-before-resource-close detection.
Cleanup failures remain failed/closed and sanitized while other owned resources
are still closed. A never-settling dependency cannot be reported as clean shutdown.
Rejecting factories remain responsible for their own pre-transfer allocations;
successful transfer is cleaned up if later binding/activation validation fails.

The internal [publication recorder](CANDIDATE-PUBLICATION-RECORDS.md) is validated
and owned but never forwarded as a public tool or automatically invoked by reads.
This manager does not define a publication clock, erase records or wire a new
workflow effect. The real composition must still connect the separately authorized
records transition and its recovery path.

## Evidence and remaining work

The [fixed intent-capture tracker](INTENT-CAPTURE-PROGRESS.md) separates verified
component/joined checks from live startup and signed-in human acceptance. Report
its overall percentage after each verified completion; test count is not progress.

### Canonical contents and key ownership, no factory switch — 0306

[0306](../intent/0306/EVIDENCE.md) adds an internal content reader over the 0305
owner. Existing stores and the new decoder share canonical metadata/AAD/digest
definitions. Separate key policies grant every encrypted record before any key
lookup. Material is shared only by exact provider object, draft and key ID;
independent providers with the same ID may hold different keys. Owned copies are
rechecked and wiped, while provider buffers remain untouched.

The callback must await key and full records/lifecycle recheck before final source
closure. Its validity follows the enclosing request through the final caller check,
not the completion of an inner callback. Cancellation and forgotten rechecks drain
before admission is released. Decoding explicitly does not prove SDK verification,
current source permission, execution authority or any gate.

The application factory is unchanged. Next compose production SDK/operation/lineage
checks and authorized target discovery into the existing service contracts and
separate phases around effects. The current retained-history target requires known
operation/review IDs; it is not a substitute for initial capture. Real profile,
records, key-provider, model and GitHub authorization remain unchanged.

### Owned records reader, no factory switch — 0305

[0305](../intent/0305/EVIDENCE.md) adds internal metadata-first records composition
for retained review/development/save history. A present enumeration grant and
separate per-group policies precede encrypted reads; exact metadata, complete final
rows/lifecycle, one-use awaited recheck and current grant-revision closure remain.
The trusted decoder/source callback is read-only and cannot dispatch or save.
The owner retains cancelled connect/SQL/policy/verifier/recheck work until it drains.
Native null-budget candidate-save steps do not gain model-spending authority.

The local native experiment uses this production-source reader with the existing
test-only cryptographic/SDK oracle, synthetic independent policies and owned corpus
graph. Its 56-attempt portion is not application performance or records adoption.
Canonical production codecs, key/policy services and outer effect-separated paths
still need to be composed before switching the factory. Real startup/profile,
records adoption, model budget and actual runtime GitHub write grants are unchanged.

### Owned native corpus graph, no factory switch — 0304

[0304](../intent/0304/EVIDENCE.md) composes the actual batch adapter into an owned
current/historical collector. Exact independent revisions, root selections and all
consumed document/pointer/manifest grants survive through final closure. A trusted
read-only callback verifies dependent records before that closure; it cannot stand
in for records/key policy or contain dispatch/save effects. Up to four admitted
calls retain their slots while real callbacks drain after timeout/cancel/close.
Shutdown waits for actual pending work, not merely returned races.

The native records experiment uses this collector, the signed test App JWT and
actual OIDC/Git resolver and preserves late revocation/expiry/key/hold checks. Its
53-attempt result remains local/synthetic. No runtime service/profile/factory is
switched. Next is owned records composition with independent policies/key providers
and all effect-separated phases; full confirmation still costs 7,637.

### Native batch adapter, no runtime switch — 0303

[0303](../intent/0303/EVIDENCE.md) registers a private batch read on the actual
GitHub reader, reusing restricted token acquisition and exact native inventory
identities. It has no new HTTP tool, package export or factory activation; ordinary
collectors stay on their current path. Per-revision/path grants bracket bounded
queries. A refresh-time port/cancellation check prevents content dispatch after
the captured reader/authority methods change. No cross-call content/grant cache.

The enclosing composition must still own source/root selection, all-grants revision,
lifecycle/key checks, complete final source/records readback and pending-work
drainage. A successful batch is not authority for a phase, save, records activation
or runtime installation. Coherent corpus/records and effect integration remains next.

### Combined lifetime experiment, no runtime installation — 0302

The [lifetime follow-on](../intent/0302/EVIDENCE.md) rejects expiry after dependent
records readback and keeps the initial snapshot's earliest deadline effective
even if a later database clock would extend it. Invalid/regressing clocks and
copied metadata deny. Native/focused/type checks pass with the same 52 simulated
attempts for this test-only combined portion. It is not hold/grant authority or
production activation. Independent policies/key providers, owner drainage and
all outer effect phases remain to integrate; full confirmation stays 7,637.

### Combined revision graph experiment, no runtime installation — 0301

The [combined experiment](../intent/0301/EVIDENCE.md) preserves the authenticated
native journey, then reads the records and their two distinct historical Git
revisions. Sharing 40 immutable objects within one invocation reduces this portion
from 74 to 50 simulated provider attempts. Both revisions keep all membership,
selection and path policies; records retain decryption/SDK verification and full
final readback. Denial at one revision does not inherit another revision's grant.

No application factory, profile or service is changed. This is not complete
production policy integration, final cross-component source closure, owner
drainage, outer effect-boundary integration or C22. Actual confirmation remains
7,637; overall stays 68% (17/25; eight remaining; +0). Live authority and spending
prerequisites are unchanged. The next integration must retain those boundaries;
the prototype is not a drop-in production service.

The [follow-up](../intent/0301/FINAL-SOURCE-CLOSURE.json) puts dependent records/key
readback before the graph's final source checks. A native post-record revocation
now rejects; two added identity checks bring this portion to 52 attempts. The
initial 50-attempt comparison remains historical. Complete lifecycle/authority
closure, independent production policies, ownership and effect phases remain open.

### Native records experiment, no runtime installation — 0300

The [bounded read-set experiment](../intent/0300/EVIDENCE.md) follows the unchanged
authenticated synthetic native save/reopen journey. Existing draft/execution SQL
roles, RLS, encryption, prompt reconstruction and SDK verifiers cover 20 encrypted
records, with a complete final snapshot comparison. The records portion emits 22
simulated provider attempts including actual OIDC and Git-grant bootstrap. This
does not install a history service, change authority or fix application performance.

The fixture's policy and single physical key are not proof that independent
production authorities/providers can be collapsed. Per-purpose policies, owner
drainage, outer callbacks and write-separated phases must still be included in the
combined feasibility and integrated correction. Confirmation remains 7,637;
progress stays 68% (17/25; eight remaining; +0). No live model or runtime write.

### Corpus protocol experiment, no runtime installation — 0299

The [test-only experiment](../intent/0299/EVIDENCE.md) collects all 42 distinct
physical files and preserves the existing 34-source semantic result. Five bounded
queries, metadata and fresh-head/token traffic total 27 simulated attempts, with
126 independent source-policy calls. Metadata policies are synthetic; the caller
stand-in is not the full HTTP/OIDC/grants resolver. Large-document coverage uses
63 attempts, so the representative result is not a general corpus-size guarantee.

The [follow-up](../intent/0299/AUTHORIZATION.json) uses the actual OIDC verifier and
Git grants resolver: 33 cold single-phase attempts (seven bootstrap plus 26 corpus),
31 for a new warm-process request and 57 for two separate source phases. Membership/
grant revocation and expiry deny. This is still test-only; source metadata authority,
the HTTP registry, records and actual persistence boundaries are not integrated.

No adapter, runtime profile, real records policy, credential, write authority or
startup path is installed or changed. Full confirmation remains 7,637 attempts.
The next feasibility step covers records/history, keys, policies and outer action
boundaries; only then may the coherent production correction be integrated and
the unchanged full performance protocol run. Progress stays 68% (17/25; +0).

### Diagnosed request-cost correction, no runtime change — 0298

Two synthetic diagnostic runs preserve 45 HTTP invocations and identical request
counts. Source-location attribution maps the nested scope/history/preview and
confirmation-own identity calls; confirmation remains 7,637 attempts. The existing
per-file corpus protocol alone requires at least 258 calls across its two separate
preview phases, so history-only consolidation cannot meet the 200-call target.
See [evidence](../intent/0298/EVIDENCE.md), [traces](../intent/0298/PROFILE.json) and
[correction sequence](../intent/0298/REQUEST-BUDGET-PLAN.md).

Next is an executable batch/read-boundary feasibility experiment, followed by a
coherent bounded corpus/records read graph. No production port, permission cache,
signed architecture, startup configuration or live activation is changed here.
The diagnostic preload is restricted to the synthetic selection and is never a
production startup option. Proposed budgets do not establish C22 or a new ETA.

### Whole-preview immutable corpus session — 0297

Private construction proof keyed by the exact review method/scope allows the
actual source-review, final-review and preview owners to share one complete
immutable corpus per read-only preview. Genuine API forwarding retains proof;
copied/bound/unregistered methods keep ordinary reads. No public input, package
export, profile or activation change exists. Current source grants, product/
lifecycle selection, head, draft, provenance and all other preview verification
remain. The final corpus callback is followed by an exact draft reopen, catching
late edits, holds and key loss. Invalid windows and changed ports deny; owners
retain actual held work until drainage, not merely until a tracker returns.

Confirmation admission/persistence is unchanged. Its two previews open separate
sessions, never sharing bytes/proof across a write or request. Native source tests
and the authenticated synthetic save/recovery/reopen pass. Repository bodies fall
75% (preview 172 → 43; confirmation 344 → 86), while total requests fall only about
7% (3,722 / 7,637). Identity/records validation remains the dominant bottleneck;
this is not C22 or live acceptance. Overall stays 68% (17/25; +0 points). See
[0297 evidence](../intent/0297/EVIDENCE.md) and [raw samples](../intent/0297/PERFORMANCE.json).

### Explicit historical source-policy query composition — 0296

The generation-history owner explicitly marks its read-only source-permission
query through a private constructor. Ordinary calls retain caller/policy/caller.
The authenticated historical scope window may select policy/fresh-caller ordering
before content, SQL, keys or continuation, without repeating the leading check.
Generic/copy/foreign-caller callbacks cannot acquire this stronger proof. Genuine
forwarding retains arguments, intrinsic invocation and every owner guard/tracker;
nonvoid/late failures and incomplete policy work still deny. No grant is cached.

Initial authentication, all source queries, both full scope reads and final
original/key/lifecycle/records verification remain. Preview now uses 4,017 provider
requests and first confirmation 8,227 (about 19% fewer); these still fail C22.
The next read-set work must also address repeated immutable-source bodies: 344
repository blobs per confirmation already exceed the full 200-attempt budget.
Any reuse remains within a read-only phase, with exact commit identity and fresh
grants/head checks, never across effects or requests. See
[0296 evidence](../intent/0296/EVIDENCE.md) and [raw samples](../intent/0296/PERFORMANCE.json).

### Retained-original read set for generation history — 0295

The private generation-history owner now shares one exact original-store read
set with its observation readers. First and final reads fully reopen originals/
sources; intermediate reads recheck historical/draft/source authority, every
observed original/draft key, lifecycle/hold/expiry and encrypted row/source identity.
Final metadata readback and the existing outer full scope-history verification
remain. No permission lease, request-provided proof or write-spanning cache exists.

Copied/foreign/expired tokens, replaced ports, concurrent/abandoned reads and
swallowed failures deny. Failed windows close their original store before draining
late work. Successful owners remain alive for outer scope-history final source
callbacks, then close with the history owner. Ordinary reads/writes are unchanged.

The authenticated synthetic save/recovery/reopen, eight final native records
checks and 1,468 broad tests pass. Preview now uses 4,957 requests and first
confirmation 10,107: about 2% fewer, not a resolved bottleneck. The broader repeated
result/observation/operation and source-authority traversal remains next. C22 and
real signed-in acceptance are open; progress remains 68% (17/25; +0 points).
See [0295 evidence](../intent/0295/EVIDENCE.md) and [raw samples](../intent/0295/PERFORMANCE.json).

### Proven catalog forwarding and parent callback ownership — 0294

The candidate catalog forwards only an exact privately proven source read, which
still executes current authority and both source grants. Unknown ports keep the
full policy path; a replaced proven source method rejects. Forwarding adds owner
guards and bounded read accounting, not a permission cache. The bundle reader's
optional parent enter/leave callbacks track actual pending work, including final
policy queries after cancellation; these callbacks do not grant authority.

The authenticated synthetic journey still saves once and reopens the exact old
commit through lost acknowledgements and restart. Source review is 210 requests,
preview 5,057 and first confirmation 10,307. Full C22 and live acceptance are not
complete. The next priority is a coherent read-only records/history read set with
fresh lifecycle/key/current-authority checks and final readback before effects.
See [0294 evidence](../intent/0294/EVIDENCE.md) and [raw samples](../intent/0294/PERFORMANCE.json).

### Canonical-source reads and draft callback ownership — 0293

After explicit canonical selection, items with neither CANDIDATE.json nor a
proposals entry read Brief/Spec from the verified global inventory without
constructing another catalog over the same in-memory directory. All source
grants, caller/byte/hash/mode checks and incomplete-source gaps remain. Every
pointer/proposals case uses the full catalog path; layout never establishes
lifecycle. Canonical Exam and unrelated context remain excluded.

Selection is permission metadata, followed by fresh checks at actual IO. The
final sweep still rechecks every selection and consumed-source grant. Retained
evidence keeps both head reads with independent current/all-grants brackets;
those adjacent brackets also cover the intervening metadata sweep, reducing
seven checks to four without skipping any policy or head read.

Only draft read permission metadata uses the private read-policy composition.
Create/append and every key access retain full caller brackets. The private read
mode cannot create lifecycle or obtain a new key. Actual pending identity/policy/
key callbacks retain the draft owner's admission after an inner-store timeout;
closing suppresses late continuation. No permission cache or public bypass exists.

[0293 evidence](../intent/0293/EVIDENCE.md) and [raw samples](../intent/0293/PERFORMANCE.json)
record source review at 232 requests and first confirmation at 10,483. The
authenticated synthetic save/recovery/reopen passes, but delayed source review
still fails the 200-attempt target. C22 and live activation remain pending.

### Deeper records metadata authorization — 0292

Current/historical scope and development readers, plus the read-only portion of
development start, use a private metadata-policy helper. Owners authenticate
before work; each independent read permission query then runs before fresh caller
validation and before SQL/content continuation. Installed authorizers are strictly
permission-metadata queries: no content fetching/transmission, key retrieval,
SDK verification or effects belong in them. No policy or principal is cached.

Key access and SDK verification retain their original full caller brackets.
Historical exchange verification explicitly stays on checked(), not the metadata
helper. Existing private historical/current bracket proofs and scope windows
retain their stronger semantics; the new helper cannot supply either proof.
All full source/readback checks, separate start authorization/scheduling, strict
void outcomes, four-call admissions, deadlines and pending-work drain remain.

[0292 evidence](../intent/0292/EVIDENCE.md) records the authenticated synthetic
save/recovery/reopen and [raw measurements](../intent/0292/PERFORMANCE.json).
Preview falls to 5,501 requests, first confirmation to 11,213 and initial drafting
start to 7,871. This is partial C22 work, not live activation or latency acceptance.
The older recovery-unknown observation remains unresolved; no passing rerun
establishes its cause. Progress stays **68% (17/25; 8 remaining; +0 points)**.

### Read-only policy traversal and immutable membership — 0291

The managed journey now authenticates before the first policy query, then runs
each independent scope-bound bundle-use query followed by fresh caller validation
before service continuation. Installed policy callbacks must be metadata-only:
no source content reads, effects or publication belong in them. All original
action-time authorities, four-call admission, five-second dependency limits and
drain-before-disposal behavior remain. No permission/identity decision is cached.

Corpus selection/source revalidation uses one guarded policy-only sweep with
exact all-grants revision and caller barriers. Every policy still runs. Actual
source IO is bracketed by current caller/inventory checks and independent source
grants; no policy sweep contains a content read or effect. Native byte reads may
use that reader's exact frozen commit/tree inventory, but fetch and verify each
body again. Copies, foreign snapshots and mismatched paths/revisions deny;
unknown/wrapped ports keep the full original path.

[0291 evidence](../intent/0291/EVIDENCE.md) records the authenticated synthetic
journey and [raw measurements](../intent/0291/PERFORMANCE.json). Source review
drops from 2,634 to 317 requests; scope preparation from 9,598 to 1,250; first
confirmation from 45,716 to 14,829. These are not live UI or C22 acceptance.
The remaining 200-attempt/latency target is still unmet. Records adoption,
model spending and runtime GitHub authority retain their separate prerequisites.

### Bounded saved-operation recovery diagnosis — 0290

`node packages/data/test/postgres.integration.ts --candidate-recovery-repro 20`
runs only the existing lost-native-acknowledgement recovery case repeatedly in
disposable PostgreSQL/native Git fixtures. Add `--query-delay-ms 2` for the
separate delayed diagnostic. The selector accepts 1–20 repetitions and 0–5 ms
delay, stops on a failed assertion and never authorizes a resend. It is not the
full SQL suite, authenticated 34-source journey, real GitHub write or UI test.

The existing diagnostic shared with the joined recovery assertion now reports
clock observations, regressions and a capped backward delta, not absolute times.
Sequences belong to individual database leases; reset/release separate samples,
and late completions cannot pollute a later trace generation. Query results/errors
still reach the caller unchanged. No production clock or recovery rule changes.

See [0290 evidence](../intent/0290/EVIDENCE.md): final ordinary/delayed selections
each pass 20 repetitions with 460 clock observations and zero reversals/database
failures. Forty save checks also pass. The 0289 unknown outcome remains unexplained;
these narrower tests do not establish a root cause or fix. Keep diagnostics on
future joined runs while continuing performance work. **68% (17/25; +0 points)**.

### Separate drafting-preparation read windows — 0289

The owned journey now installs the same private evidence hook in assessed drafting
preparation. Each source/policy/source pair has its own read-only corpus session;
initial evidence collection stays full, and a fresh collection follows admission
and original persistence. The hook cannot enclose admission, original put/readback
or a scheduler/model/Git effect. Current assessment verification remains complete;
no original, human direction, permission or deadline is changed.

The hook is pinned per operation. The existing helper retains pending work,
rejects skipped/replayed/early/nonvoid completion and preserves exact owner
conflicts through session error sanitization. Full fallback and every independent
grant remain. Native tests verify fresh bodies after effects, pre-effect denial
and post-effect uncertainty without overwriting preserved originals.

See [0289 evidence](../intent/0289/EVIDENCE.md) and [raw measurements](../intent/0289/PERFORMANCE.json).
The native two-source path uses 52 instead of 70 requests. The actual 34-source
preparation now records 20,130 / 18,790 requests; 19,586 / 18,246 are identity
traffic and 544 in each are repository traffic. No managed preparation baseline
was previously recorded, so no managed reduction or latency acceptance is claimed.
The final authenticated save/reopen rerun passes; one earlier already-sent
recovery returned unknown after verified receipt recovery. Its cause remains
unestablished, and bounded diagnostics now accompany that assertion. No production
reconciliation fix, live authority or performance acceptance is implied.
Overall stays **68% (17/25; 8 remaining; +0 points)**.

### Proven current-scope caller barriers — 0288

Drafting start constructs a private immutable read-only original authorizer that
checks its exact caller before and after the independent policy. Current-only
original verification forwards its construction identity only through the actual
callback, original receiver/arguments, owner guards and pending-work bounds.
The current scope window can then omit only its redundant outer caller pair.
Historical proofs are separate; unknown/copied/bound/different-caller callbacks
retain the full checks. Nothing is exposed through public package/tool exports.

Both full current scope reads, exact source/result equality, records/keys/profile/
expiry checks, final grants and separate per-scheduler-revalidation windows remain.
No proof crosses an effect. Intrinsic invocation ignores overridden `call`/`apply`
properties without dropping the receiver. Nonvoid authorization is still denial.
See [0288 evidence](../intent/0288/EVIDENCE.md): initial drafting start drops from
41,768 to 23,064 requests; receipt recovery/repeated starts from 47,350 to 25,974.
The full authenticated synthetic save/reopen journey passes, but these counts are
still over budget and actual UI/live-provider acceptance remains open. Overall
stays **68% (17/25; +0 points)**; no live configuration/authority is changed.

### Separate scope-preparation read windows — 0287

The actual corpus/preparer factory now installs a trusted private evidence hook.
Each source/policy/source validation pair opens its own read-only session; initial
full acquisition is unchanged. The session closes before scope admission or
encrypted-original persistence, and the next pair starts with a full fresh
collection. No source bytes or authority proof survive across effects/requests.
Every independent records, draft, preparation and consumed-source grant remains.

The owner pins the hook identity and tracks both the wrapper and actual work/reads.
Skipped/replayed callbacks, early/nonvoid completion, swallowed failures,
overlapping/unawaited reads and escaped late use cannot permit the next effect.
Source/draft conflict identity survives session error sanitization. The full
no-hook fallback remains available; caller DTOs cannot install this private hook.

See [0287 evidence](../intent/0287/EVIDENCE.md). Native boundary tests prove eight
rather than fourteen body reads in the two-source fixture, fresh reads after
effects and denial/unknown outcomes for late revocation/drift. The actual managed
34-source preparation falls from 11,365 to 9,598 requests; final synthetic
confirmation/save/reopen still passes. This remains far above the performance
target and changes no live profile or authority: **68% (17/25; +0 points)**.

### Private nested repository-read proof — 0286

The adapter now constructs an immutable, private read callback that invokes its
exact bound policy before and after each successful read. A WeakMap records
construction identity, not permissions or cached results. Catalog root/inventory
reads can omit only the identical outer pair; the bundle-facing catalog port
still genuinely runs its own check, so the bundle reader can omit its duplicate
pair without forwarding a claim across a skipped policy. A separate current caller
always retains the full bundle path. Unknown wrappers, replacements and other
authorizers cannot inherit this proof; intrinsic invocation preserves the captured
method and receiver even if another function has an overridden `call`/`apply`.

Independent source policies, initial/final corpus validation, all consumed-path
rechecks, exact immutable bytes, timeouts and read/admission limits remain.
Catalog policy callbacks must return void; truthy or false results are not grants.
See [0286 evidence](../intent/0286/EVIDENCE.md) for verification and request counts.
This is a partial C22 optimization, not permission caching, live activation or
actual signed-in acceptance. Progress remains **68% (17/25; +0 points)**.

### Executable performance prefix — 0285

An explicit test-only `--journey-performance` selection reuses the actual
authenticated composition with synthetic native Git/SQL fixtures. It adds 20 ms
delay per native Git-provider attempt, including authorization-file traffic, and
caps each call at 200 dispatches. Separate request-local counters work under
concurrency; abort/closed/unawaited cases cannot become successful samples.

Both directions run twenty warmed, three reconstructed and four concurrent
authenticated draft reads, preserving exact content. Those reads take about
0.8–0.9 seconds in the captured run. Source review then exceeds the limit and
returns 401 when current identity lookup cannot finish: 204 attempts, at most
200 dispatches. That is an explicit failed/incomplete benchmark, not a successful
workflow. No production authentication or error mapping has changed.

See [0285 evidence](../intent/0285/EVIDENCE.md) and [raw samples](../intent/0285/PERFORMANCE.json).
The full later-stage/negative/load protocol, origin partitions, issuer/JWKS
latency and human UI acceptance remain open. Integrity-test success must not be
presented as C22 acceptance. Progress stays **68% (17/25; +0 points)**; next reduce
repeated source-review identity/corpus traversal before extending the benchmark.

### Private historical caller-barrier proof — 0284

The data layer now records a private function-identity proof for a source-policy
callback constructed as current caller → policy → current caller. Only forwarding
that preserves the original callback, argument list, receiver and owner tracking
can carry that proof. A historical scope window may omit its duplicate identical
outer caller pair; unknown, copied, differently scoped or arbitrary wrappers keep
the full checks. No principal, permission, head or policy outcome is cached.

Both full scope reads, each independent source policy, fresh OIDC/Git lookups,
immutable original/SDK lineage, owner closure and pending-work limits remain.
The same default and continuation joined fixtures remove 5,696 identity head
reads per preview and 11,392 per confirmation (about 19% of total requests).
Repository traffic is unchanged. Confirmations still take about 36–41 seconds;
single-run timings do not establish a reliable latency improvement.

See [0284 evidence](../intent/0284/EVIDENCE.md) for exact counts and verification
timing, including the final callback-receiver compatibility correction after the
SQL selections were launched. The [performance benchmark](INTENT-CAPTURE-PERFORMANCE.md)
sets an engineering pass bar and repeatable measurement protocol; its harness and
passing results remain open. This is partial C22 work: **68% (17/25; +0 points)**,
not live activation, real model quality or signed-in human acceptance.

### Proposal-continuation save — 0283

The joined authenticated fixture now selects the canonical target Brief and an
explicit existing proposal ID. The current reviewed head remains separate from
the proposal's earlier original target. Canonical Exam and hidden context exist
before both snapshots; neither drafting prompt may contain the Exam. Independent
current continuation eligibility and historical/current source checks stay required.

The six-file plan must compare-and-swap only the selected proposal pointer, create
four new candidate files and a receipt, and preserve every canonical/hidden and
prior proposal blob. Assertions bind the prior pointer and manifest digests, exact
file set, unchanged original target and exact old/new reads after restart and a
later simulated branch edit. Missing proposal or eligibility cannot create a new
proposal as a fallback. This extends verification, not production authority.

The continuation joined check plus idempotent migrations and default three joined
checks plus their migration check pass. All 31 focused choice/selector/native-
destination tests, 1,373 broad tests, typechecks and build pass; see
[0283 evidence](../intent/0283/EVIDENCE.md). This completes C10: 68% (17/25; +4 points).
Next is C22: establish and meet practical request-load/latency bounds. No live model,
GitHub or signed-in UI result is claimed; governed activation remains pending.

### First-amendment save — 0282

The joined authenticated fixture now selects a canonical root Brief for an
existing proposal-only item. Independent lifecycle authority remains mandatory;
the source label does not grant amendment eligibility. The scenario's canonical
Exam and hidden context are seeded before identity/corpus snapshots, and the Exam
must not appear in either drafting prompt. A human Brief correction invalidates
the old scope assessment before exact first-proposal confirmation.

The save plan contains six create-only files: the three candidate documents,
manifest, new proposal pointer and exact operation receipt. No existing source,
root Brief/Spec/Exam or candidate pointer is written. Assertions compare every
prior blob/mode/OID and the exact set of new item files. Reopen must preserve the
reviewed original target even after a later simulated branch edit; this is not
approval to continue a proposal against a changed target.

The first-amendment joined check plus idempotent migrations and default three
joined checks plus their migration check pass, along with six focused tests,
1,372 broad tests, typechecks and build. See [0282 evidence](../intent/0282/EVIDENCE.md).
This completed C09 at 64% (16/25; +4 percentage points). 0283 above adds continuation
coverage; performance, governed activation and real-user acceptance remain open.
No live binding, permission, model call, gate or signed-in UI acceptance is added.

### Distinct linked-intent save — 0281

The authenticated joined fixture now supports an explicit new-linked choice
targeting the reviewed versioned candidate Brief. The governed synthetic profile
must include both the new destination and source target; finding a source is not
authority. A dedicated native-destination negative rejects an omitted target.
Both drafting roles receive the exact choice. A corrected Brief requires fresh
scope review; wrong target digests and current source denial withhold preview.

The new item uses create-only bundle/pointer/Brief and operation-receipt files,
without writing a canonical root Spec/Exam or any linked-item file. The entire
linked-item inventory stays identical after save. Exact older-commit reopen
preserves the relationship's reviewed source commit even after a later branch
edit. Lost confirmation/scheduler/provider replies, replay and runtime restart
retain one candidate-save commit, one original and six synthetic model reservations.

The linked joined selection and migration check pass, along with the default
three joined checks plus their migration check, all 15 focused selector/choice/
native-destination checks, 1,371 broad tests, typechecks and build. See
[0281 evidence](../intent/0281/EVIDENCE.md). This completes C08 in the fixed tracker:
60% (15/25; +4 percentage points), not a live-readiness or time estimate.
No production source, live grant, model call, runtime binding or signed-in UI
acceptance is supplied. 0282 and 0283 above add first-amendment and continuation
coverage; request volume, governed activation and real-user acceptance remain open.

### Existing pre-pull candidate revision — 0280

The full authenticated synthetic journey also accepts an explicit existing
versioned candidate Brief. Both drafting roles receive the reviewed choice.
After a human correction, the old scope assessment is rejected and a fresh exact
review precedes confirmation. Wrong target digests and lost source grants deny.
The fixed save preserves prior bundle files and unrelated sources, changes only
the pointer/Brief mirror plus its new versioned bundle, and reopens both old and
new packages through the actual authenticated reader. No canonical Spec/Exam is
created or overwritten. Six synthetic model reservations and one native commit
remain stable across lost acknowledgements, replay and runtime reconstruction.

The revision's focused joined check and idempotent migration check pass, as do
the default three joined checks plus their migration check, all 1,369 broad tests,
prototype/eight-package typechecks and production build. See [0280 evidence](../intent/0280/EVIDENCE.md).
This extends verification only, not production source or authority. 0281–0283 above
add linked, first-amendment and continuation save/reopen coverage. Request-volume
reduction, governed startup and actual live/user acceptance remain open.

### Request-owned corpus verification — 0279

The actual corpus-backed development source reviewer now installs a private
read-only session, never selected by HTTP input. The first read verifies the tree
and every consumed blob at the current commit. Supporting pointers, manifests and
Exam files are tracked and reauthorized even though only Brief/Spec are emitted
for scope assessment. Every reuse rechecks current caller, inventory permission
revision, both current heads, every observed lifecycle/product choice (including
excluded roots) and every consumed-source grant. Installed ports and repository
binding are pinned. Content is request-owned; permissions are not cached.

The session repeats those checks after the source review's final read-only work.
Both exact draft reads and review-provenance callbacks remain. Incomplete sources
are fully recollected and cannot silently become complete; verified source bytes
above a semantic batch limit keep their exact gaps for the existing batch planner.
Four bounded slots, close and the unchanged 30-second deadline suppress late work;
occupied slots are retained until abandoned callbacks drain. No session encloses
admission/original retention, scheduling, model dispatch, Git writes or publication.
Ordinary scope/assessed corpus collection remains full traversal.

See [0279 evidence](../intent/0279/EVIDENCE.md): three joined workflow checks, ten
historical SQL checks, 1,367 broad tests, types and build pass. In the same fixture,
source review removes 23.4% of requests; preview/confirmation remove about 11%.
Confirmation still makes about 60,000 attempts and takes 36 seconds locally, so
remote load and smooth human UX remain open. No runtime binding, D1 adoption,
live permission or signed-in UI acceptance is supplied here.

### Native traffic ownership — 0278

The joined fixture now meters the actual identity runtime's synthetic transport
separately from corpus/destination/save readers and reconciles each HTTP action's
counts. For the first confirmation, identity owns 65,669 head lookups versus 44
for the repository-content path, and 96.8% of all requests. Exact-commit document
reuse is working: the identity transport reads one commit/tree/blob per request.
The dominant cost is repeated fresh-head verification, not downloading that file.

No production behavior or request totals change in this diagnostic. All prior
workflow/recovery checks remain; see [0278 evidence](../intent/0278/EVIDENCE.md).
The [next-change investigation](../intent/0278/INVESTIGATION.md) proposed a private
corpus-read session to remove repeated immutable work and associated checks while
preserving current source/grant/head verification. The separate 0279 implementation
and verification are described above; neither checkpoint supplies a permission
lease, live binding or signed-in acceptance.

### Historical caller-barrier reduction — 0277

The history projection's known private scope port now relies on the window's own
before/after caller checks around every original/source callback, without wrapping
them in additional copies of the same checks. The port starts unavailable and has
no raw-reader fallback; pending-operation/lifetime tracking remains. Full initial/
final scope, exact lineage, original/key/records/lifecycle and independent role
verification are unchanged. No Git authorization decision or head is cached by
this change. See [0277 evidence](../intent/0277/EVIDENCE.md).

The same joined synthetic journey passes with 14.8% fewer preview requests and
about 14.7% fewer confirmation requests. Confirmation still takes 50–53 seconds;
65,713 of its first 67,820 requests are Git-head lookups. Category counts do not
identify which caller produced each head lookup. Further caller/transport mapping
and duplicate-barrier reduction remain necessary before live-load or UI acceptance.
This is not an adopted runtime policy, deadline extension or new live permission.

### Scope and drafting through fixed workflows — 0276

The authenticated joined case now starts both scope reviews and the two drafting
roles through the actual factory and existing Temporal schedulers/workers, instead
of directly invoking model steps. Each start uses exact admitted references and
separate synthetic start authority. Denied starts have no effects; lost scheduler
ACKs, repeated starts and history replay do not duplicate workflows or reservations.
The fixed workflows determine the two batch orders and Architect → Test Agent
order. The Test Agent receives exact predecessor Brief/Spec and all 34 permitted
sources without the Architect's message or generated Exam transcript.

An initial 30-second development-start failure exposed six repeated full scope
traversals in each read-only scheduler revalidation. A private current-scope
window now uses first/final full current reads around exact immutable reuse.
Every caller/source check and the existing original/key/lifecycle/execution/start
policy checks remain. Changed, expired, superseded and historical results deny.
The final full read completes before any scheduler RPC, and every scheduler
revalidation gets a fresh window. No deadline, source coverage or permission is
extended; this is not an authorization cache or cross-service atomic snapshot.

The repaired joined run reaches confirmation, one fixed native save and exact
reopen, with two scope workflows, one drafting workflow, one save workflow, six
synthetic model requests/reservations and one native Git commit. Owned workers
and managed API runtimes close. Verification and remaining performance evidence
are recorded in [0276 evidence](../intent/0276/EVIDENCE.md).

Only `new-distinct` is fully joined here. These owned disposable workers do not
install a live startup profile, adopt records/model/write authority, demonstrate
semantic quality or pass signed-in UI acceptance. Drafting starts still cost
13–15 seconds and tens of thousands of native-provider calls; confirmation costs
52–56 seconds in this run. Reduce that volume before live-provider/UX acceptance,
then complete governed bindings and the remaining dispositions.

### Confirmed save and exact reopen through identity — 0275

The same authenticated 34-source generation/correction/reassessment/confirmation
case now continues its exact original through the concrete factory's save-start,
status and exact-reader services. No principal or journey service is substituted.
Synthetic tool grants exist before the final reviewed Git head; distinct save
authority stays closed throughout confirmation. Denied start has no scheduling,
step, original, reservation or native mutation effect.

The joined test passes one fixed Temporal activity/native commit with lost
scheduler and provider acknowledgements. Workflow history is reference-only and
replay cannot resend. Reconstructing the actual identity/factory recovers an exact
HTTP receipt; read-only status cannot checkpoint, while separate reconciliation
can record completion. A later root edit does not redirect exact reopen: the
confirmed Brief/Spec/Exam and manifest bytes, including the human correction,
come from the older receipt commit. Current read-policy and Git-grant denial
withhold access. One encrypted original, two operations and six synthetic model
reservations remain unchanged; all four API runtimes and owned worker resources
close. See [0275 evidence](../intent/0275/EVIDENCE.md) for verification scope.

At 0275, only `new-distinct` was joined through this save root; scope/drafting
workers still executed directly. 0276 joins those fixed workflows as noted above.
This is not current authority adoption, a real
provider write, signed-in UI acceptance, publication retention or acceptable
live-provider performance. Confirmation still takes approximately 47–50 seconds;
further bounded read composition and governed model-worker scheduling remain next.

### Corrected-package confirmation — 0274

The joined identity/factory test now extends the human correction through stale
assessment rejection, two recorded reassessment batches and candidate preview.
Only the Brief is marked edited; older generation and separate Exam lineage remain
intact and their review/conformance states remain stale. Explicit confirmation,
discarded HTTP acknowledgement and exact original recovery after reconstruction
now pass the joined SQL case; see [0274 evidence](../intent/0274/EVIDENCE.md).

Composed historical-scope checks exposed a second amplification bottleneck: one
preview made 129,330 synthetic native-provider requests and confirmation timed out
at its unchanged 90-second limit. Generation history now brackets its private,
read-only projection with two full authoritative historical-scope reads. Identical
intermediate lineage checks reuse detached immutable evidence, still invoking
present caller/source authorization every time. A fresh final scope read must
revalidate keys, records/lifecycle, profiles, original and batch observations and
agree before any projection can return. Target, reader binding and methods are
pinned; changed evidence, current authority loss, cancellation and late results
deny. Each request gets a new window; this is not current-assessment clearance,
a permission cache or an atomic snapshot across services. Ordinary scope reads,
admission, generation, confirmation deadlines and outer role/source readbacks are
unchanged. See [the investigation](../intent/0274/INVESTIGATION.md).

The corrected preview uses 39,550 synthetic native requests; confirmation uses
about 79,500 and completes in 47–50 seconds. These are roughly 69% fewer requests,
but remain too many/too slow for remote-provider or smooth-UX acceptance. The
timeout repair is a bounded reliability checkpoint, not performance completion.

These are synthetic HTTP/SQL/SDK checks, not remote-provider performance or a
signed-in browser demonstration. 0275 subsequently joins fixed save/reopen through
this identity root; governed scope/drafting scheduling and live records/model/
provider/write authority remain open.

### Recorded generation through identity — 0273

The three-check focused SQL runner preserves both 0271/0272 cases and now adds
authenticated current native review and admission over 34 Brief/Spec sources.
Two scope batches and both existing recorded drafting SDK roles execute directly
under synthetic authority/transport. HTTP returns exact generated Brief/Spec/Exam,
recovers the same results after runtime reconstruction, saves a human correction
to the draft and verifies retained predecessor lineage with current execution
denied. Foreign products, records denial and native Git grant revocation deny.
Only four synthetic model calls/reservations occur; there is no Git save.

This integration exposed 4,048 native provider requests before source review's
30-second deadline. The Git authorization resolver now retains one verified
document at one exact commit within each explicit HTTP/MCP request, not a principal
or authorization decision. New requests re-fetch the artifact; unscoped resolver
use stays full read-through. Completion/failure clears the request snapshot and
late work from an ended request denies. Concurrent requests never share it. Every
lookup still reads current Git head. An exact-commit hit performs only synchronous
record selection/cloning afterward; a changed head re-fetches/validates the
artifact and rechecks head stability. Failed reads or source binding/method changes
clear retained bytes and deny. OIDC expiry, active membership, hats and tool grants
are still checked every time; no TTL, stale head or database fallback exists.
After admitted requests drain, identity/MCP shutdown closes the resolver, clears
all remaining snapshots and disables its async-context storage. New and late
authorization attempts then deny without touching the provider.

See [0273 evidence](../intent/0273/EVIDENCE.md). This resolves the observed local
immutable-read bottleneck, not remote provider load/latency acceptance. Direct
worker execution is not owned Temporal scheduling. The next composition covers
confirmation, fixed save and exact reopen through this identity/factory root.
Actual policy/clock/D1 adoption, provider/budget/write authority and UI acceptance
remain open; no real-user configuration is changed.

### Concrete constructor graph — 0272

The existing API composition root now exports `createOwnedIntentJourney`. The
authorized identity binding can call it from `createIntentJourney`; it does not
register itself or change the real runtime profile. Unlike a caller-built service
inventory, this factory constructs all 21 production implementations and internal
publication recording. Storage/SDK/configuration imports stay confined to the
existing composition root; no architecture exception is added.

Its fixed configuration includes scope/development/candidate execution bindings,
scope and recorded-role profiles, retrieval revision and publication binding.
Every records coordinate must match. Scope and drafting share one exact budget;
the scope-profile digest, candidate action/null budget, publication home and item
allowlist must agree. Preserved architect/Test Agent profiles derive from the same
SDK profiles used by current and historical verification. No budget is provisioned.

Owned SQL drafts feed current source review and save. Native corpus collection
feeds scope and assessed drafting preparation. Current scope verification feeds
assessed drafting and final edited-package review; historical scope verification
feeds retained role lineage. Package preview uses those actual history readers and
native new/existing destination resolvers. Confirmation, start, status and internal
records share publication configuration; exact bundle/proposal readers are owned.
Caller-supplied service, evidence, lineage and destination result overrides are
not factory inputs. This wiring cannot substitute for current policy evidence.

The operator supplies owned read transport, separate execution/draft pools and
fixed scheduler ports plus all required policies. With valid cleanup present,
their resource ownership transfers on factory entry, including failure. Services
close in reverse dependency order and the pinned resource cleanup is awaited once;
that owner must drain actual leases/I/O and own scheduler lifetimes. The identity
manager drains requests before invoking this cleanup. No worker starts at creation.

See [0272 evidence](../intent/0272/EVIDENCE.md). The concrete-factory SQL test adds
all four metadata discovery reads, native current Brief/Spec review and real pool
closure to authenticated lost-acknowledgement draft recovery. Unexercised policy
ports deny. This is not semantic model quality, the complete generation/save
journey, actual OIDC-provider acceptance or a signed-in UI result.

### Earlier inventory-boundary evidence — 0271

See [0271 evidence](../intent/0271/EVIDENCE.md). The focused integration joins
signed synthetic human JWTs, current native Git authorization commits and actual
encrypted PostgreSQL draft create/append/read through the production identity
runtime. Lost acknowledgement and runtime reconstruction preserve one exact
revision; current policy, tool-grant revocation, foreign products and holds deny.

Only the exercised draft capability uses real SQL in that test. Other inventory
entries deliberately fail if called. Separate tests exercise authenticated routing,
scope/authority failures and resource drainage. These results do not demonstrate
the complete constructor bundle, cookie-login UI, real provider/model behavior,
semantic quality, all destination save cases or signed-in I1–I6 acceptance.

0272 assembles the constructor graph, 0273 joins recorded generation/recovery and
0274–0275 join corrected confirmation/fixed save/exact reopen through identity.
0276 joins scope/drafting scheduling and owned worker shutdown in that same test.
Next complete bounded read performance, remaining dispositions and governed
startup/bindings. Actual clock provenance and late recovery, D1 adoption, model
spending, runtime GitHub write authority and real-user
acceptance remain separate prerequisites. No real profile, secrets or grants are
changed by this increment.
