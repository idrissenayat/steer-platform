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
signed-in browser demonstration. Fixed save/reopen and owned scheduling through
this identity root remain next; live records/model/provider/write authority is
still closed.

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

0272 assembles the constructor graph and 0273 joins recorded generation/recovery
through identity. Next extend confirmation/save/reopen and owned worker scheduling
through that composition and complete its governed bindings. Actual clock provenance and late
recovery, D1 adoption, model spending, runtime GitHub write authority and real-user
acceptance remain separate prerequisites. No real profile, secrets or grants are
changed by this increment.
