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
