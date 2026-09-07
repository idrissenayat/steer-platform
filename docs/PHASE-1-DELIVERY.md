# Phase 1 delivery plan

Execution baseline: `640bd29704a70dc8eabcca5b0e10e3de0fb0e5c5`.
This live delivery ledger implements the route in the Gate 1-bound
`intent/0001/PLAN.md`; it does not rewrite that signed snapshot.

The user's instruction to create an implementation plan and start building
authorizes development increments on the development branch. Gate 2 remains
open. Each increment is committed and pushed after its relevant checks, with
its limitations recorded. Merging, enabling governed writes, and releasing
remain subject to the existing gate requirements. The infrastructure ceiling
is not spending authorization.

## First usable milestone

A human signs in through Keycloak, creates an intent through a guided
conversation, confirms the proposed artifact, sees it committed through the
GitHub App and projected onto the board, and reviews a revision-bound decision
inside STEER. Every surface uses the same registry and tenant authorization.

## Delivery sequence

The current dependency-ordered first-journey work packages and separate approval
dependencies are in `docs/JOURNEY-REMAINING-WORK.md` (0174). Historical increment
"next" statements below are not the current remaining-work forecast.

Execution priority as of 2026-09-06: finish the first usable journey above.
The current code audit, bounded effort ranges, next demo and separate waiting
dependencies are in `docs/FIRST-USABLE-DELIVERY.md`. This orders safe development;
it does not defer signed requirements or waive any of the five R5 findings.
Stateless authoring can proceed while Gate 2 continues to block live writes.
This route began with 0121 Brief preview and 0122 guided authoring/correction UI.
0123 supplies closed confirmation/save orchestration; 0124 adds the uninstalled
GitHub storage primitive. 0125 connects canonical-path recognition to the curated
Brief library. Next is full trusted writer/authority composition, with broader
historical lookup still required. The unimplemented retirement-archive prerequisite remains
tracked in `intent/0120/PLAN.md`, not silently marked complete or renumbered.

| Milestone | Deliverable and acceptance evidence | Dependency / current state |
|---|---|---|
| M0 — Close the five Gate 2 findings | Fix R5-001 through R5-005 with regression tests; independent review; protected incorporation and revision-bound approvals. Preserve review history. | Open, gates live writes and release. No further broad remediation loop is assumed. |
| M1 — API and shared contracts | Hono service, Zod tool registry, generated OpenAPI, tenant-scoped read operation, uniform errors, local startup, transport/registry parity tests. | Item 0007 is the first increment. Existing workspace, Next.js shell, and domain extraction are complete development increments (0005/0006). |
| M2 — Identity and tenant data | Normalized Keycloak OIDC with issuer/audience/expiry checks; revocable agent identities; Postgres/Drizzle migrations with organization RLS from the first table; cross-tenant/pool-reuse tests. | After M1 contracts; configure providers through adapters. No trust in browser role headers. |
| M3 — Git-backed intent flow | GitHub App adapter, least-privilege tokens, authenticated webhooks, durable ingestion, revision-aware writes, deterministic projections, dropped-event repair and rebuild tests. | M2; live write enablement also requires M0. Gate-signing operations remain separately controlled. |
| M4 — Shared transports and workflows | MCP transport from the same registry; Temporal gate waits, timers, recovery and reconciliation; parity and restart tests. | M1–M3. Workflow state is derived, not business authority. |
| M5 — Production screens | Port backlog, inbox, Flight Board, intent detail and Learn to Next.js and real APIs; preserve pink/orange tokens; responsive, keyboard and browser tests; no production fixture imports. | M2–M4. Keep the reference prototype until parity is evidenced. |
| M6 — Conversation and operational services | Mastra/AI SDK conversation through scoped tools, LiteLLM model seam, one-confirmation onboarding, evidence storage, secrets, content-free analytics, tracing and cost limits. | M3–M5. Model/provider calls require their existing access and spending boundaries. |
| M7 — Release candidate | All 13 architecture integration cases, backup/restore, recovery, performance, privacy, dependency and accessibility evidence; Gate 3 at the exact revision. | M0–M6. Manual accessibility evidence is required; generated test rows are not a manual audit. |
| M8 — Pilot and outcome closure | One approved pod, at least 10 real items, production baselines, 90-day measurement window, learning decision. | Approved release and any separately approved hosting cost. The observation window cannot be replaced with fixtures. |

## Working agreement

- Deliver one bounded item at a time with its Brief, Spec, execution route,
  acceptance checklist, code, and evidence. Formal EXAM artifacts continue to
  use the authorized independent Test Agent path.
- Publish each verified increment to `codex/phase-1-foundation`; record the
  commit in the handoff. A candidate push is not a merge or gate approval.
- Run the relevant checks once after changes. Re-run for failures or new edits.
  One independent review produces a concrete correction list; no new broad
  review loop or deadline is silently added.
- Report implemented behavior and remaining dependencies, not generated-case
  counts as a percentage of platform completion.
- Update this ledger and the implementation overview in the same increment.
- The user's renewed continuous-loop instruction means proceed to the next safe
  item without asking for another continue. The existing task heartbeat retains
  this route across runs; stop for indispensable user-only input, not a completed
  increment. Keep gate/spending/provider restrictions unchanged.

## Completed development increment: 0007

Implemented and verified the shared tool boundary before adding stateful providers. The service
exposes liveness, an explicitly incomplete readiness response, generated
OpenAPI, and an authenticated organization-scoped context query. The default
server rejects authenticated operations until the real identity adapter is
configured. Tests supply verifier results only through the internal dependency
interface; there is no development-header or dummy-token bypass.

Verification: frozen install, root `pnpm check`, 15 new focused tests and
loopback HTTP smoke checks passed. Details and runtime limitations are in
`intent/0007/EVIDENCE.md`. No visible UI change is claimed for this backend slice.

## Completed development increment: 0008

Implemented the normalized Keycloak-compatible OIDC adapter and API composition
boundary. Eleven new tests cover actual JWT signatures, claims/time validation,
current grant resolution, immediate revocation, agent/human separation and
API tenant denial. Root checks passed; see `intent/0008/EVIDENCE.md`.
The default CLI remains deny-all: browser login, actual Keycloak configuration
and a trusted Git-backed grant projection are not yet connected.

The user has requested continuous implementation until user-only input is
needed. A task heartbeat resumes bounded work and candidate-branch pushes;
existing gate, spending and provider boundaries still apply. No repeated
unchanged blocker notifications or broad Critic loops are intended.

## Completed development increment: 0009

Implemented the first two Drizzle/PostgreSQL tables, forced organization RLS,
separate app/projector grants, transaction-local tenant handling and typed
projection reads. Five unit checks and eight real PostgreSQL 16.14 integration
checks passed, including contaminated-pool reuse, cross-tenant write denial,
rollback and concurrent callers. The run-owned synthetic database was removed.
See `intent/0009/EVIDENCE.md`; `pnpm test:data:integration` reruns that harness.
No production database or authoritative Git record was changed.

## Completed development increment: 0010

Implemented a read-only GitHub App adapter and current Git authorization
resolver. Reads restrict installation credentials to one numeric repository
ID and contents-read, pin artifacts to commits, validate Git blob/SHA-256
digests and reject changed heads. Thirteen new tests pass, with no real App
credentials accessed. Test Agent identity remains separate from runtime.

## Completed development increment: 0011

Implemented single-artifact ingestion/reconciliation. Deterministic source
keys, per-source transaction serialization, expected-revision CAS, exact
duplicate refusal and source-based projection repair pass four new unit tests
and three new real PostgreSQL checks (eleven database checks total).
`intent/0011/EVIDENCE.md` records the implementation and its limits.
Authorization remains read-through to current Git, not the projection cache.

Before live GitHub composition, user approval was requested for a separate
read-only runtime App on `idrissenayat/steer-platform`. Approval has since been
received and the App installed; see the provider checkpoint below. The Test
Agent App remains independent; its key has not been loaded or reused.

## Completed development increment: 0012

Fixed bundler-only domain imports and added AST package-boundary/native-import
tests. The full repository check passed under isolated Node 24.20.0, including
all package tests and builds. `.node-version` records the verified local patch.
All eleven PostgreSQL integration checks also passed under that Node version.
See `intent/0012/EVIDENCE.md`; host Node was not replaced.

Next integration: runtime GitHub App binding, local Keycloak/browser and
authorized operating-repository membership composition, followed by durable
ingestion and workflow transports. The separate runtime App is installed, but
its dedicated credential and a live read-only artifact check are now verified;
do not repurpose the independent Test Agent key or enable live reads under
that identity.
M2 remains partial until those identities and tenant data are wired end to end.
Live Git writes remain blocked on M0 and applicable provider authorization. Remaining
M1 work includes full stack lock and
local service composition; the shell alone does not complete P1-01.

## Provider checkpoint: runtime App installed and live read verified

On 2026-09-05 UTC the user approved and GitHub confirmed installation of
`steer-platform-runtime` (App `4836171`, installation `159172046`) on only
`idrissenayat/steer-platform`, with Contents/Metadata read-only. Webhooks and
user OAuth are disabled. The independent Test Agent App was untouched.

The original browser download failed, then the user completed a replacement
download. The replacement fingerprint was matched against GitHub and its PEM
moved outside Git with owner-only permissions. Signed App/installation reads,
a restricted-token commit-bound artifact read, and hash/head checks passed.
The user approved revocation of the unused original key; it was revoked and
the replacement authenticated successfully afterward.

The credential blocker is resolved. Resume safe bounded implementation without
repeating the App/key approval request. Exact provider evidence and remaining
integration limits are in `docs/GITHUB-RUNTIME-APP.md`. Local Keycloak/browser,
authoritative membership-source configuration and durable ingestion remain
unfinished; CLI startup is still deny-all. No gate or deployment is approved.

## Completed development increment: 0013

The selected Keycloak image is pinned by digest and exercised in a disposable,
non-root, loopback-HTTPS container. Six real-provider check groups pass under
Node 24.20.0: discovery and scoped TLS trust, agent claims/JWKS, audience/client
denial, current revocation, tenant/hat denial, and Hono tool authorization.
The root suite also passes; the harness cleaned up its own synthetic resources.
See `intent/0013/EVIDENCE.md` and `pnpm test:identity:integration`.

This resolves the service-account/provider-contract verification gap. Remaining
M2 work includes human browser authorization-code/PKCE login, safe server-side
session/refresh/logout handling and trusted Git membership configuration. Test
realm grants are not production authority. Continue from those concrete gaps,
preserving the current fail-closed API until complete composition is verified.

## Completed development increment: 0014

Added the server-side human code/PKCE broker with one-use browser-bound login
transactions, validated ID/access-token pairing, host-only secure cookies,
short-lived server sessions and current-grant/local-logout enforcement.
Eleven new tests pass; root checks pass on Node 24.20.0. No live browser route,
real human identity or persistent session store has been enabled.

Storage was subsequently implemented in 0015 below. Next: same-origin POST start/logout and GET
callback routes with secure cookie/error/CSRF handling. Verify against a local
Keycloak authorization-code client before exposing login in Next.js. Continue
trusted membership configuration separately; never promote test grants to real
authority. Refresh-token rotation and provider-wide logout are still open.

## Completed development increment: 0015

Implemented encrypted durable login/session storage behind the shared contract,
without reversing package dependencies. The dedicated auth role and namespace
have forced RLS and no business-table access. AES-256-GCM authenticates record
identity/timestamps; inserts enforce five-minute TTL and bounded capacity;
login consumption commits once across Node processes. Explicit retained keys
support reading prior ciphertext during rotation. No key is generated for real
runtime use and no HTTP route or production connection has been enabled.

The PostgreSQL harness now covers 18 check groups (the original 11 plus seven
session groups), including process restart/readback, atomic consumption,
namespace/role isolation, concurrent capacity, expiry, tampering and key rotation.
Only disposable synthetic container data is reclaimed. Root checks also pass
on Node 24.20.0. Evidence: `intent/0015/EVIDENCE.md`.

Route composition was subsequently implemented in 0016 below. Next: a real
local Keycloak human authorization-code flow. Keep startup deny-all until
trusted membership and approved server secrets/database configuration are wired.
Gate 2, spending, deployment and release remain separate and open.

## Completed development increment: 0016

Implemented the explicitly composed browser HTTP boundary: same-origin POST
login/logout, GET one-use callback, fixed redirects, separate secure cookies,
generic errors and no-store/no-referrer responses. Cookie-authenticated tool
requests get independent Origin/Fetch-Metadata checks and the same current-grant
registry boundary. Mixed cookie/bearer credentials deny. Composed OpenAPI now
describes the routes/cookies without duplicating tool schemas.

Nine new signed-token HTTP tests pass, including HEAD/no-side-effect behavior,
CSRF/logout denial, body/query/origin checks, replay, token non-disclosure,
revocation and documentation parity. Full root checks pass on Node 24.20.0.
Default CLI remains deny-all and does not expose auth routes; this is synthetic
HTTP evidence, not a real browser/provider-flow pass. See `intent/0016/EVIDENCE.md`.

The real local human-code HTTP flow was subsequently verified in 0017 below.
Next: combined encrypted storage/browser and authoritative membership work.
Public activation additionally requires ingress resource/rate limits and
approved database/key-provider settings. Refresh/provider logout, M0 findings,
all formal gates and deployment/spending authorization remain open.

## Completed development increment: 0017

Extended the digest-pinned disposable Keycloak harness with a separate synthetic
human/confidential client and actual password-form/code exchange through STEER's
HTTP routes. A real profile mismatch was found: empty default scopes omitted
the human access-token subject mapper. Added the explicit provider mapper;
required-subject, token-pair and grant checks were not weakened.

Twelve real-provider check groups now pass: six existing agent groups and six
human groups covering S256/disabled grants, wrong-password rejection, valid
code exchange, human context, replay/tenant/revocation, local logout and wrong
PKCE/client-secret denial. Root Node 24 checks pass. Only synthetic resources
were used and cleaned up. Evidence: `intent/0017/EVIDENCE.md`; reusable binding
requirements: `docs/KEYCLOAK-IDENTITY-PROFILE.md`.

The assembled provider/Postgres flow was subsequently verified in 0018 below.
Next: actual browser cookie, TLS/navigation behavior and trusted Git-backed
membership configuration. The
current form driver is not a browser-engine pass and its Map/grant fixtures
must not become runtime fallbacks. Public activation remains closed pending
those prerequisites, ingress limits and approved runtime settings. M0's five
R5 findings, independent reviews and all gate/release/spending boundaries remain.

## Completed development increment: 0018

Added an explicit combined authentication harness with real local Keycloak and
the production encrypted PostgreSQL store. The provider fixture's storage is
now selectable only by explicit test mode: provider-only Maps versus an isolated
database with real migrations and a separate auth runtime role. Durable mode
never falls back to Maps and no production dependencies/startup were changed.

Thirteen combined check groups pass. Two app/store instances race one actual
callback with exactly one provider exchange; persisted ciphertext excludes token,
subject and organization plaintext. Correct-key reconstructed instances recover
the session, wrong-key instances deny, and local logout invalidates both original
and reconstructed apps. The twelve provider-only groups and full root checks
also pass. Evidence: `intent/0018/EVIDENCE.md`; command: `pnpm test:auth:integration`.

Chromium cookie/navigation checks were subsequently implemented in 0019 below.
Next: trusted Git-derived membership/runtime composition and ingress resource
limits. App-object reconstruction in this test
is not a browser pass or an OS-process restart. Current grant records remain
synthetic, public startup remains closed, and M0/Gate 2, independent signatures,
deployment, release and spending authorization remain separate and unresolved.

## Completed development increment: 0019

Added real isolated Chromium navigation against Node HTTPS, the production Hono
browser routes, local Keycloak and encrypted PostgreSQL. The browser uses a
temporary profile and a key-scoped exception for only the generated test TLS
certificate; a different invalid certificate is rejected. No system trust or
normal browser settings change. Playwright 1.62.1 is pinned without a dependency
age-policy exemption.

Seven browser groups pass alongside six existing agent groups: native cross-site
login, secure host-only HttpOnly/Lax cookie behavior, no callback-query referrer,
cross-site logout cookie omission and server denial, app/store reconstruction,
current grant revocation, replay and native logout. A real browser-only fixture
CSP issue was corrected by allowing the exact configured IdP form destination.
Root and prior provider/assembled checks remain passing. Evidence: `intent/0019`.

Next bounded increment: compose trusted Git-derived membership with the verified
identity/session boundary and define fail-closed runtime/ingress limits. Keep
the actual production Next.js sign-in surface, public configuration and live
provider writes closed until prerequisites are evidenced. Chromium test forms
do not complete production UI, other-browser, accessibility, M0 or formal gate
acceptance. Gate 2's five findings and all approval/spending boundaries remain.

## Completed development increment: 0020

Added explicit fixed-source Git-backed browser/bearer identity composition.
The factory installs the read-through resolver internally, ignores any extra
resolver override and rejects malformed authorization paths at construction.
The actual Chromium/Keycloak/encrypted-Postgres harness now reads synthetic
memberships from immutable commits in an owned temporary local Git repository.

Nine browser groups plus six existing provider groups pass, including committed
revocation, absent/duplicate/cross-organization records, source outage, head
movement and digest mismatch. Existing sessions deny on the next request and
recover only after valid source restoration; no old grant is retained as a
fallback. Bearer composition has equivalent focused checks. Evidence and full
regression results: `intent/0020/EVIDENCE.md`.

Next bounded increment: fail-closed request/resource limits and trusted runtime
configuration. Then connect the actual production UI and remaining M2 services.
Do not mistake the synthetic local Git reader for a live membership deployment,
or the separately verified runtime App read for authorization to write grants.
Default public startup/readiness remains closed. M0/Gate 2's five findings,
independent reviews and deployment/release/spending boundaries are unchanged.

## Completed development increment: 0021

Added fixed-size per-process admission (concurrency and global token bucket),
URL/header bounds, actual-byte/chunk/body-read deadlines and explicit loopback
HTTP parser/receive/socket settings. No per-client map or forwarded-header
identity is introduced. Work keeps its concurrency lease until it actually
settles; rejection cannot hide ongoing provider/DB work behind a response timeout.

Focused tests cover overload/release, refill/bad clocks, malformed startup limits,
oversized requests, disconnect/stalled cancellation and endless empty chunks.
A spawned actual Node HTTP server verifies oversized raw headers and incomplete
headers are rejected while startup stays unready and unauthenticated. The real
Chromium identity/Git/session flow and root suite are rechecked. Exact evidence:
`intent/0021/EVIDENCE.md`; operational limits: `docs/API-RESOURCE-LIMITS.md`.

Next bounded increment: database/pool execution deadlines and trusted runtime
configuration, then production UI composition. Per-process limits are not fleet
ingress, capacity/load validation or cancellation of backend work. Preserve the
five R5 findings and all real-access, independent review, gate, deployment,
release and spending boundaries. No production activation has occurred.

## Completed development increment: 0022

Added a strict bounded runtime database pool: explicit role/transport, eight
connections, 32 pending acquisitions, two-second acquisition wait and server-side
statement/lock/idle transaction limits. Fixed startup options prevent ambient
PGOPTIONS from overriding the policy. Tenant and authentication helpers reapply
limits on entry without weakening RLS, role checks or confirmed-commit handling.
Pool drain is shared across repeated shutdown calls; closed admission is not
misreported as a completed drain.

Isolated PostgreSQL checks exercise exhausted capacity and recovery, real query
and lock cancellation, contaminated-client reset and idle-transaction termination.
The assembled identity harness now uses the production pool. Exact outcomes and
regressions: `intent/0022/EVIDENCE.md`; limits: `docs/DATABASE-RUNTIME-LIMITS.md`.

Next bounded increment: trusted service/runtime composition and explicit active
connection failure/shutdown handling. Server SQL limits are not total transaction
or active-network deadlines, and loopback testing is not production TLS evidence.
Continue safe local implementation without opening real membership/public access
or spending. Five R5 findings, protected review/signatures and all formal gates
remain distinct and unresolved.

## Completed development increment: 0023

Added bounded active-lease error accounting and explicit graceful/forced database
shutdown. New acquisition stops immediately; ordinary leases can finish, while
owned remaining leases are evicted after a five-second grace interval. Shared
drain promises and safe late cleanup prevent false completion/double release.

Business COMMIT acknowledgement loss now has an explicit unknown-outcome error.
The synthetic loopback relay test commits one row while hiding the server reply;
the caller does not report success or retry. An independent test observer sees
the row, and explicit shutdown releases the stalled connection. Exact backend
failure between queries and normal drain/recovery are also tested.
Evidence: `intent/0023/EVIDENCE.md`; guide: `docs/DATABASE-RUNTIME-LIMITS.md`.

Next bounded increment: trusted runtime/service composition and lifecycle wiring.
The pool shutdown grace is not a universal network deadline; production TLS,
total transaction budgets, real approved membership/key bindings and public
ingress remain separate prerequisites. Preserve the five R5 findings and all
independent-review, gate, deployment, release and spending boundaries.

## Completed development increment: 0024

Composed the verified Git-backed identity API with exact managed session-resource
binding and explicit running/draining/stopped/failed state. Shutdown closes new
admission immediately and waits for both actual request work and owned resource
cleanup. Failure stays closed and sanitized; repeated calls share completion.
No dependency boundary, public startup or readiness approval was changed.

The actual Chromium/Keycloak/Git/Postgres harness now uses the service factory,
including reconstructed instances and final resource shutdown. Unit tests cover
binding mismatch, delayed requests/resources and failure/idempotence. Evidence:
`intent/0024/EVIDENCE.md`; guide: `docs/IDENTITY-SERVICE-LIFECYCLE.md`.

Next bounded increment: validated runtime bootstrap/configuration and local
production UI wiring. Keep credentials, approved real membership/TLS/ingress,
supervision and total transaction/network budgets explicit. Buffered test flows
do not complete production UI/streaming/manual-accessibility evidence. The five
R5 findings and all independent-review, gate, deployment, release and spending
boundaries remain unchanged.

## Completed development increment: 0025

Added explicit actual identity runtime bootstrap from separate strict public
profile and secret objects. The API composition root assembles the real restricted
GitHub adapter, bounded auth pool, encrypted store and service lifecycle. Startup
is lazy/no-network and does not read secrets, open a listener or approve readiness.

The API declares data/Zod dependencies only for `src/runtime.ts`; exact-file
controls reject those imports from route/service/default startup files. This
implements the existing architecture split without editing signed snapshots,
upgrading dependency versions or adding age-policy exemptions. A bootstrap
integration creates and verifies a real encrypted synthetic login transaction
while rejecting provider network access. Evidence: `intent/0025/EVIDENCE.md`;
guide: `docs/IDENTITY-RUNTIME-BOOTSTRAP.md`.

Next bounded increment: local production UI sign-in wiring and trusted
listener/profile loading. Real credentials/membership, public TLS/ingress,
supervision and total transaction/network budgets remain explicit prerequisites.
The five R5 findings and independent-review, gate, deployment, release and
spending boundaries remain unchanged.

## Completed development increment: 0026

Added the requested pink/orange native sign-in interface in actual Next.js
production source. Public configuration is explicit and disabled by default.
Native fixed-path forms keep passwords/provider tokens out of the page and work
with page scripts disabled. Existing product prototype and source docs remain.

The browser harness builds/starts production Next.js, serves its root/static
assets through the owned HTTPS gateway and exercises real identity/storage/Git
behavior. Responsive, keyboard, disabled-state and automated accessibility checks
and credential-free screenshot review are included. A real browser Origin failure
was corrected by using same-origin referrer policy on the form document while
retaining no-referrer on the callback. Evidence: `intent/0026/EVIDENCE.md`;
guide: `docs/NATIVE-SIGN-IN-UI.md`.

Next bounded increment: trusted local listener/profile integration and
authenticated workspace/session UI. This native SSR proof does not cover client
hydration, other browsers, manual accessibility, real membership/public TLS or
full product parity. Preserve the five R5 findings and all independent-review,
gate, deployment, release and spending boundaries.

## Completed development increment: 0027

Promoted native UI/API routing from test-only code into a shared identity gateway
in API production source. Canonical HTTPS/public and fixed loopback renderer
origins, explicit path/method routing and credential-free renderer requests now
share bounded admission, one-MiB response limits and five-second renderer aborts.
Response headers are constructed, not copied from Next.js. Auth authority and
callback security policies remain exclusively in the identity service.

The real Next.js/Keycloak/Git/Postgres browser harness uses this gateway rather
than a duplicate page proxy. Focused tests include actual renderer sockets for
slow headers/body, redirects, client abort and credential isolation. Evidence:
`intent/0027/EVIDENCE.md`; guide: `docs/IDENTITY-GATEWAY.md`.

Next bounded increment: trusted local listener/profile/lifecycle composition,
then authenticated workspace/session UI. This gateway opens no listener, loads
no secrets and grants no real account access. Public ingress, hydration, full
product parity, remaining Phase 1 services, the five R5 findings and all gate,
deployment, release and spending boundaries remain open/separate.

## Completed development increment: 0028

Added explicit local HTTPS runtime composition from a strict public profile and
separate supplied secrets. The application origin derives from the validated
identity callback; actual lazy identity runtime, native gateway and bounded
loopback listener are connected without changing default startup or loading
real credentials. Startup failures clean owned resources, not unrelated ports.

TLS/header/request/socket limits and coordinated shutdown have actual socket
evidence. A five-second forced disconnect does not falsely report stopped while
application work remains outstanding. The full browser flow now uses the shared
production-source listener and observes refused connections after it closes.
Evidence: `intent/0028/EVIDENCE.md`; guide: `docs/LOCAL-IDENTITY-RUNTIME.md`.

Next bounded increment: authenticated workspace/session UI, followed by trusted
secret-provider loading and remaining Phase 1 stack composition. Real membership,
public ingress, process supervision, manual accessibility, full product parity,
the five R5 findings and all gate/deployment/release/spending boundaries remain
explicitly separate. No user-only input is currently needed for isolated UI work.

## Completed development increment: 0029

The actual Next.js interface now shows verified human-session context after
login: current account ID, organization, hats and expiry, plus native sign-out
and refresh. A same-origin empty-body display query invokes the canonical
session.context tool. The gateway constructs a strict private display header;
browser-supplied identity headers and credentials never reach the renderer.

Revocation and Git outage/moving-head/digest failures remove identity on reload;
no cached context is used. The page is explicitly a snapshot, not a signature or
live permission monitor. The three production operating surfaces are labeled
not connected, without fabricated records or working-navigation claims.
Evidence: `intent/0029/EVIDENCE.md`; guide: `docs/AUTHENTICATED-WORKSPACE.md`.

Next bounded increment: trusted secret-provider loading, then authenticated
business/data tools and remaining Phase 1 components/operating surfaces. Keep
real account binding, public ingress, process supervision, full product parity,
manual accessibility, the five R5 findings and all gate/deployment/release/spending
boundaries explicit. Isolated implementation remains unblocked.

## Completed development increment: 0030

Added a secret-provider interface, scoped wrapped-data-key interface and pinned
encrypted-file binding. Owner-only canonical roots/files, final no-follow reads,
digest/metadata checks, bounded admission and AES-GCM authentication protect the
selected bundle. The API's explicit secret-backed entry clears temporary input
buffers; required runtime key copies remain usable. It discovers no credentials
and does not load or change the existing runtime GitHub App key.

Actual isolated HTTPS/Postgres verification created and independently decrypted
a login transaction after input cleanup. Browser regression and filesystem/crypto
failure tests passed. Evidence: `intent/0030/EVIDENCE.md`; guide:
`docs/ENCRYPTED-SECRETS.md`. Live KMS/Vault binding and full memory-erasure/host-
sandbox claims are explicitly outside this evidence.

Next bounded increment: tenant-scoped authenticated read-model tools and
repository projection ingestion, then the remaining Phase 1 stack and operating
surfaces. Live secret/provider bindings, real account access, public ingress,
process supervision, full product parity, manual accessibility, the five R5
findings and all gate/deployment/release/spending boundaries remain separate.
Isolated implementation remains unblocked.

## Completed development increment: 0031

Added the canonical asynchronous projection.artifact.read query, explicit grant
and curated tenant/repository/path binding, with fresh authorization after I/O.
The read-only PostgreSQL adapter checks login role, RLS, exact revision and
bounded cached-byte integrity. Optional explicit runtime configuration owns a
separate read-model credential/pool and includes it in shutdown/status.

Actual synthetic Git single-path reconciliation into PostgreSQL is now read
through the authenticated browser API. All 23 browser and 27 database groups
pass; see `intent/0031/EVIDENCE.md` and `docs/ARTIFACT-PROJECTION-READS.md`.
No UI change, current-HEAD proof or production worker is claimed.

Next bounded increment: repository projection reconciliation/replay composition,
then shared workflow transports and real operating surfaces. Real bindings,
governed writes, public ingress/supervision, manual accessibility, the five R5
findings and gate/deployment/release/spending boundaries remain separate.
Isolated implementation remains unblocked.

## Completed development increment: 0032

Added explicit-manifest reconciliation for 1–100 paths, pinned to one Git revision
with bounded staging and source hash/binding checks before writes. Per-record
CAS and duplicate/repair behavior remain intact. Partial failures report only
acknowledged progress; superseded manifests never claim successful convergence.
An opt-in one-shot runtime composes the real reader/projector pool with a supplied
current agent authenticator, overlap refusal and truthful shutdown.

The isolated browser harness now replays two actual synthetic Git artifacts,
repairs a corrupt PostgreSQL projection without changing event count and verifies
both files byte-for-byte. Runtime lifecycle and source/failure checks pass.
Evidence: `intent/0032/EVIDENCE.md`; guide: `docs/REPOSITORY-RECONCILIATION.md`.
This is curated-manifest replay, not automatic whole-repository inventory,
deletion/rollback policy, atomic publication or durable scheduling.

Next bounded increment: revision-bound source inventory/manifest integration,
then shared workflow transports and remaining operating surfaces. Live runtime
authenticator/secret binding, production operations, the five R5 findings and
all gate/deployment/release/spending boundaries remain separate. Safe isolated
implementation remains unblocked.

## Completed development increment: 0033

Added exact-revision repository inventory through explicit directory/filename
selectors. Complete bounded recursive trees, canonical unique paths and selected
regular-file modes are required; truncated/oversized inventories fail instead of
silently skipping artifacts. Descriptor-bound reconciliation refuses revision
substitution. The opt-in projector runtime accepts exactly one of paths/selection.

Actual synthetic Git inventory selects two artifacts, excluding authorization
JSON, and feeds PostgreSQL replay/repair plus authenticated browser readback.
Provider-contract, race, empty-manifest and runtime configuration tests pass.
Evidence: `intent/0033/EVIDENCE.md`; guide: `docs/REPOSITORY-INVENTORY.md`.
No SQL deletion, live provider activation or atomic repository snapshot is claimed.

Next bounded increment: shared transport/workflow foundation, then durable
reconciliation orchestration and remaining operating surfaces. Large-inventory
partitioning, source-removal/rollback policy and actual runtime bindings remain
explicit gaps. The five R5 findings and all gate/deployment/release/spending
boundaries remain separate; safe isolated implementation remains unblocked.

## Completed development increment: 0034

Added official MCP TypeScript SDK v2 Streamable HTTP over the canonical registry,
with protocol 2026-07-28, bearer-only current Git-backed OIDC authority and strict
origin/method/body/admission limits. Schema/result parity, post-I/O revocation and
actual tool-drain behavior are verified. SDK imports remain outside the registry
and limited to the API transport adapter; package/protocol pins are recorded.

An official client crosses actual isolated HTTPS/Keycloak/Git, matches the HTTP
tool result and observes committed grant revocation/restoration. The browser suite
now passes 24 counted groups plus its inventory fixture checkpoint. Evidence:
`intent/0034/EVIDENCE.md`; guide: `docs/MCP-TRANSPORT.md`.

Next bounded increment: combined runtime MCP mounting/lifecycle, then Temporal
workflow foundation and durable reconciliation orchestration. OAuth onboarding,
real runtime bindings, large-inventory/removal/rollback policy, full operating
surfaces and the five R5 findings remain open. No default activation, spending,
deployment, release or gate approval. Safe isolated implementation continues.

## Completed development increment: 0035

Added opt-in MCP mounting through the combined identity runtime and gateway,
with an independent explicit client allowlist and the same fixed Git authority
and curated ToolServices. Combined shutdown closes admission, drains actual
requests/SDK cleanup and then closes shared pools. Browser-only lifecycle stays
compatible. Default startup remains closed and readiness remains incomplete.

An official agent client now reads a PostgreSQL-backed artifact through the same
actual HTTPS service used by the human browser. Pinned Git bytes, tenant denial,
cookie rejection and committed revocation/restoration are verified. The browser
suite passes 25 counted groups plus inventory; all 63 API and repository checks
pass. Evidence: `intent/0035/EVIDENCE.md`; guide: `docs/COMBINED-MCP-RUNTIME.md`.

Next bounded increment: Temporal workflow foundation and durable reconciliation
orchestration. OAuth onboarding, real runtime bindings, remaining agent/model
services, large-inventory/removal/rollback policy, full operating surfaces and
the five R5 findings remain open. No gate, deployment, release or spending
approval is inferred. Safe isolated implementation remains unblocked.

## Completed development increment: 0036

Added apps/worker with exact Temporal 1.23.0 SDK pins, deterministic scoped
workflow IDs, bounded durable reconciliation rounds, fixed activity-port binding
and content-free receipts. Client duplicate policies and actual workflow-ID
validation prevent accidental duplicate/bypass starts. SDK imports stay at the
worker edges; deterministic contracts import no runtime or vendor dependencies.

Actual checksum-verified CLI 1.8.3 / Server 1.31.2 tests preserve the same execution
across SDK worker recreation, resume its timer and replay history without repeating
completed activities. Five integration groups cover recovery/replay, tenant/ID
denial, non-retried sanitized failure and timer cancellation. Four native worker
groups cover contract, scope, receipt and overlap bounds. The activity port is
synthetic, not actual Git/PostgreSQL or process-crash recovery evidence.
Guide: `docs/TEMPORAL-WORKFLOWS.md`; evidence: `intent/0036/EVIDENCE.md`.

Next bounded increment: bind actual Git/Postgres reconciliation to the worker
with fresh authority and idempotent recovery, then process restart and source-
derived gate waits/cursors. Automatic retries remain disabled until that recovery
contract is verified. Cluster TLS/identity, task-queue authorization, OTel,
production retention, remaining services/surfaces and five R5 findings remain
open. No gate, provider, deployment, release or spending approval is inferred.

## Completed development increment: 0037

Added the worker's explicit fixed-scope Git/PostgreSQL projection runtime and
shared authorized job lifecycle with the API one-shot composition. Fresh agent
checks, same-subject storage authority, final reauthorization, overlap refusal
and actual resource drain are maintained in one adapter. Database imports remain
in composition roots, not workflow contracts or activity protocol code.

Eight actual Temporal integration groups now include Git/PostgreSQL ingestion,
worker/runtime recreation, exact-byte readback, unchanged event count on replay,
source-based repair and committed revocation. The service identity is synthetic;
Git grants and storage adapters are actual. This is not process-crash, real OIDC/
GitHub binding or lost SQL acknowledgement evidence. All repository checks pass.
Guide: `docs/WORKER-PROJECTION-RUNTIME.md`; evidence: `intent/0037/EVIDENCE.md`.

Next bounded increment: process-level durable-worker recovery and safe restart
composition, then authenticated scheduling/queue boundaries and source-derived
gate waits/cursors. Automatic retries remain disabled; fleet leasing, OTel,
production runtime/retention, full operating surfaces and five R5 findings stay
open. No gate, deployment, release or spending approval is inferred.

## Completed development increment: 0038

Added an explicit lazy worker-service lifecycle with ordered worker/runtime/
connection cleanup, truthful pending/failed states and stop-during-construction
handling. Actual owned child processes open their own connections, projection
pools and Git grant readers using only generated IPC configuration.

Ten Temporal integration groups now include SIGKILL during a durable timer and
different-PID resumption of the same workflow execution, exact Git/PostgreSQL
readback, unchanged event counts and fresh revocation committed while the old
process was dead. Healthy replacements close normally under one SIGTERM owner.
All repository checks and eleven worker native tests pass. Evidence:
`intent/0038/EVIDENCE.md`; guide: `docs/WORKER-PROCESS-RECOVERY.md`.

Next bounded increment: authenticated scheduling/queue boundaries and source-
derived gate waits/cursors. Active-activity crash/acknowledgement recovery, fleet
leases, server/database restore, OTel, production bindings/retention and full
operating surfaces remain separate requirements. Automatic retries stay disabled.
The five R5 findings and all formal gate/deployment/release/spending boundaries
remain open; safe isolated implementation continues.

## Completed development increment: 0039

Added canonical workflow.reconciliation.start and workflow.reconciliation.status
tools with fixed org/repository/item scope, runtime caps and fresh explicit grants.
The Temporal adapter snapshots namespace/queue configuration. Unknown starts
remain unknown; retained duplicate execution and typed missing-status outcomes
are distinct. No automatic replay, caller-selected routing or gate decision.

Five registry and two client groups plus expanded official MCP/HTTP parity cover
authorization, injection, uncertainty, output filtering and configuration bounds.
Eleven actual Temporal integration groups now include canonical tool dispatch,
missing/completed status and duplicate denial alongside existing Git/PostgreSQL
and separate-process recovery regression. Evidence: intent/0039/EVIDENCE.md;
guide: docs/AUTHORIZED-SCHEDULING.md.

Next bounded increment: explicit scheduler connection ownership in trusted
runtime composition, then source-derived gate waits/cursors and business tools.
Live cluster ACLs/authentication, active-activity/fleet/server recovery, full
operating screens and remaining services stay open. Default startup is unchanged.
No gate, live provider, deployment, release or spending approval is inferred.

## Completed development increment: 0040

The optional scheduler is now composed into the identity runtime with explicit
profile/factory pairing and exact organization/repository/item/limit checks.
A managed client admits at most eight actual operations and confirms their
completion before closing its owned connection. Both browser-only scheduling
and MCP composition drain requests before closing identity/scheduler resources.

Five new native groups cover admission, configuration, initialization/failure
cleanup and request drain. Twelve actual Temporal integration groups now include
a separate real scheduler connection whose closure is owned by the API runtime;
the server and independent environment client remain usable. Evidence:
intent/0040/EVIDENCE.md; guide: docs/MANAGED-SCHEDULER-RUNTIME.md.

Next bounded increment: source-derived gate waits/cursors, followed by business
tools and full operating screens under the same shared authorization contracts.
The live cluster connection/security profile, complete OIDC-to-Temporal flow,
remaining recovery/operational services and five R5 findings remain open.
No gate, provider access, deployment, release or spending approval is inferred.

## Completed development increment: 0041

Added a bounded gate-watch workflow with deterministic scope/gate/revision ID,
fixed observer binding, reference-only checkpoints, durable waits and explicit
superseded/decision-recorded/exhausted outcomes. No outcome signs or approves a
gate; downstream actions still require fresh canonical policy and authorization.

Three native groups and four new actual Temporal groups pass. The full Temporal
suite now has sixteen groups, including checkpoint/worker recreation/history
replay, stale-target supersession, exhaustion and non-retried source failure.
The observer is synthetic; a checkpoint is not a complete durable event cursor.
Evidence: intent/0041/EVIDENCE.md; guide: docs/GATE-WATCH-WORKFLOWS.md.

Next bounded increment: Git-backed revision observation, followed by canonical
signature-policy verification, complete event cursors and public watch composition.
Business tools/screens, remaining services and five R5 findings stay open.
Protected/signed records, live provider permissions and deployment/spending
boundaries remain unchanged. Continue safe implementation without another prompt.

## Completed development increment: 0042

The gate observer now reads actual pinned Git source, compares the governed
artifact set to the target revision and matches a bounded record envelope with
fresh same-subject agent authority before/after reads. Absent/stale records stay
distinct from source failure; changed artifacts supersede the old target.

Four native adapter groups and two new actual Git/Temporal groups pass. Eighteen
Temporal groups now include committing a synthetic send-back while stopped,
observing its exact digest after recreation and denying a later round after
Git-committed grant revocation. Full repository and frozen install checks pass.
Guide: docs/GIT-GATE-OBSERVATION.md; evidence: intent/0042/EVIDENCE.md.

Next: canonical signer/decision-policy verification, then complete durable event
cursors and public gate-watch composition. Structural record matching does not
close policy, provider proof or Gate 2. Business tools/screens and remaining
services stay open. Continue authorized implementation; no new provider access,
protected edits, gate signature, deployment, release or spending is authorized.

## Completed development increment: 0043

Added an internal strict policy evaluator for normalized target, signature,
prerequisite, Critic/build and independent domain-assurance facts. It checks
human hats, exact target scope, seat order, chronology, complete exception links,
specialist coverage and regulated separation. Commercial closed Gate 3 needs
sessions distinct from every Gate 2 session and authenticated after the Critic.

Eight new native groups pass; repository checks and frozen installation pass.
Every result explicitly requires source verification. This unmounted precheck
does not authenticate signers, verify provider records or approve any gate.
Evidence: intent/0043/EVIDENCE.md; guide: docs/GATE-POLICY-EVALUATION.md.

Next: authenticated source/proof normalization and verification, complete event
cursors and public watch composition. Business tools/screens and remaining
services still need implementation. Five R5 findings remain open; live authority,
signed/protected artifacts and deployment/spending restrictions are unchanged.

## Completed development increment: 0044

Added derived tenant/repository projection delivery streams and immutable change
references through an invoker-rights transactional trigger. Stream-row locks
serialize positions through commit; duplicates/no-op updates stay silent and
rollback leaves no committed gap. Fixed-scope internal reads use exact decimal
cursors and one SQL snapshot, rejecting foreign/stale/future/gapped positions.

Two native and four actual PostgreSQL groups cover the new behavior. The real
database suite now has 31 groups, including observed concurrent lock blocking.
Reference pages require initial snapshot composition and are not a Git or gate
authority. Evidence: intent/0044/EVIDENCE.md; guide: docs/PROJECTION-CHANGE-FEED.md.

This independent delivery prerequisite was implemented without assuming a live
approval-proof binding. Next: authenticated gate source/proof normalization and
public snapshot/stream composition, then governed business tools and full screens.
The five R5 findings, manual/qualified evidence, operational policies and formal
gates remain open. No live migration, provider access or spending was authorized.

## Completed development increment: 0045

The projection feed now has one shared registry/HTTP/MCP contract, fixed scope,
explicit grant, pre/post-I/O authorization and strict cursor/page/reset checks.
Opt-in identity runtime composition reuses its bounded read pool. Existing
artifact path grants do not imply repository-wide reference access.

Five new native registry groups and actual browser paging/reset/grant-revocation
checks pass, alongside MCP/HTTP parity. Evidence: intent/0045/EVIDENCE.md;
guide: docs/AUTHORIZED-PROJECTION-FEED.md. Initial pages explicitly still require
a coherent snapshot; no streaming UI or canonical approval authority is claimed.

Next: initial snapshot/checkpoint consistency for these consumers, authenticated
gate source/proof verification and business screens/tools. Keep the five R5
findings and all gate, provider, deployment and spending boundaries unchanged.

## Completed development increment: 0046

Added an authorized complete reference snapshot with an atomic change checkpoint.
One SQL statement sees projection state and stream cursor together. A bound of
1000 records is enforced without silent truncation. Empty/no-stream scopes keep
a null cursor; consumers must resnapshot when a generation first appears.

Three native registry groups, one native data group and actual PostgreSQL
snapshot/commit-order/capacity checks pass. The database suite now has 33 groups.
Browser/MCP snapshot/resume evidence is in intent/0046/EVIDENCE.md; guide:
docs/PROJECTION-SNAPSHOT.md. Both readers reuse the opt-in read pool with separate
explicit grants. No new live runtime profile or UI is claimed.

Next: consumer lifecycle and authenticated operating surfaces/business models,
alongside canonical gate source/proof verification and remaining services.
The five R5 findings and formal/manual/qualified evidence remain open. Continue
authorized implementation without inferring gate, provider or spending authority.

## Completed development increment: 0047

Added the portable reference-consumer lifecycle: complete replacement snapshots,
bounded ordered page application, exact cursors, explicit catching-up/no-stream
states and reset/failure clearing. Views are immutable; closure immediately clears
state and stops admission while awaiting actual work, including reentrant ports.

Eight native groups and actual MCP/Keycloak/Git/PostgreSQL consumer verification
pass. Committed agent revocation clears cached references and restored synthetic
access requires a new snapshot. Evidence: intent/0047/EVIDENCE.md; guide:
docs/PROJECTION-CONSUMER.md. No browser timer, persistence or UI was added.

Next: browser transport and safe production UI hydration/binding, then full
operating models/surfaces. Canonical gate source/proof verification, five R5
findings and remaining formal/manual/operational evidence stay open. Continue
authorized increments without new live provider, signature or spending authority.

## Completed development increment: 0048

The gateway now generates a fresh random page nonce and supplies its exact CSP
to the private dynamic Next.js renderer and browser response. Framework scripts
execute under that policy; forged parser-inserted scripts and inline handlers
are rejected. Browser-supplied nonces/policies and renderer response security
headers remain untrusted. Static/error responses retain script denial.

Native isolation/nonce tests and all 28 actual authentication/browser groups
pass. A read-only fixture honors Retry-After following its rapid hydrated reloads;
production rate limits and mutation retry behavior were not loosened. Evidence:
intent/0048/EVIDENCE.md; guide: docs/NONCE-SCRIPT-BOUNDARY.md.

Next: bounded browser transport and reference-consumer UI binding, then full
operating models/screens. Audit future dynamic script sinks and measure capacity;
no blanket XSS or production-readiness claim is made. Five R5 findings, canonical
gate proof and formal/manual/operational requirements remain open. Continue safe
implementation without implying new provider, signature or spending authority.

## Completed development increment: 0049

The authenticated Next.js workspace now has an explicit read-only repository
reference panel using the canonical consumer. A bounded same-origin transport
keeps credentials in the existing secure cookie flow, rejects malformed/denied
data and cancels closed work. Scope edits, lifecycle events and display expiry
discard cached references. Existing pink/orange design and native forms remain.

Native checks and all 30 paced functional browser groups pass, including
keyboard entry, populated responsive/automated accessibility and inspected
desktop/mobile views. Evidence is in intent/0049/EVIDENCE.md; guide:
docs/BROWSER-REFERENCES.md. This is reference
inspection, not full intent backlog/board/inbox parity or live provider enablement.

Next: typed operating artifact models/read tools and the production intent backlog,
detail, board and inbox. Canonical gate proof, five R5 findings, remaining services
and formal/manual/operational requirements remain open. Continue safe increments
without inferring signature, provider, spending, deployment or release authority.

## Completed development increment: 0050

Added a provider-free Brief document model preserving exact source bodies/offsets,
unknown and duplicate sections, with explicit structural issues. Actual kit,
canonical platform Brief and draft-author output are tested. No source instruction,
author claim, status, metric or domain tag becomes verified authority by parsing.

Seven native domain groups and the full repository check pass. Evidence:
intent/0050/EVIDENCE.md; guide: docs/BRIEF-DOCUMENT-MODEL.md. This is
preparation for authenticated reads, not completed intent backlog/detail parity.
The reference panel remains a development diagnostic, not a manual originator
workflow or replacement for agent-first authoring.

Next: exact-revision authenticated Brief read tools and the rendered backlog/detail
surface. Five R5 findings, canonical gate proof, remaining services and formal/
manual/operational requirements remain open. Continue safe increments without
new provider, signature, spending, deployment or release authority.

## Completed development increment: 0051

Added intent.brief.read with both Brief and curated-content grants, exact source
revision/fingerprint selection, independently recomputed content/blob digests and
post-parse authorization. It returns the same source-preserving structural model
through HTTP/MCP, with no inferred lifecycle or approval. Default runtime remains
unconfigured; no provider or database privilege has been widened.

Root/native checks and all 31 actual browser/identity groups pass. Evidence is in
intent/0051/EVIDENCE.md. Guide: docs/AUTHENTICATED-BRIEF-READS.md.

Next: bounded authenticated Brief discovery/catalog and rendered backlog/detail
binding. Five R5 findings, canonical proof, remaining services and formal/manual/
operational requirements stay open. Continue safe development without new
provider, signature, spending, deployment or release authority.

## Completed development increment: 0052

Added intent.brief.catalog using only the existing curated reader and restricted
app pool. A complete bounded metadata query returns Brief paths/revisions/digests,
with exact key/path checks, current explicit grants and forced RLS. No content,
status, uncurated inventory, new database role or migration is introduced.

Root/native checks, all 34 PostgreSQL groups and 32 actual browser/identity groups
pass, including agent catalog-to-Brief reading. Evidence: intent/0052/EVIDENCE.md;
guide: docs/BRIEF-CATALOG.md. Four identical ignored generated-type duplicates
were moved aside recoverably to resolve a local typecheck failure; no source
workaround or destructive cleanup was used.

Next: trusted workspace repository display binding and rendered Brief catalog/
detail integration, without manual path/fingerprint entry for originators.
Five R5 findings, canonical proof and remaining service/formal/manual/operational
requirements stay open. Continue safe development without new provider, signature,
spending, deployment or release authority.

## Completed development increment: 0053

Trusted runtime repository display binding now connects authenticated catalog
discovery to a rendered Brief side panel. Users select permitted references
without entering repository IDs, paths or fingerprints. The existing manual
reference inspector is explicitly a collapsed developer diagnostic.

Root checks, 34 PostgreSQL groups and 34 browser/identity groups pass. Desktop/
mobile screenshots were inspected after correcting focus containment and the
panel background. Verification/publication: intent/0053/EVIDENCE.md. Guide:
docs/AUTHENTICATED-BRIEF-LIBRARY.md. This read-only slice does not complete the
intent backlog or intent/0003: exact-reference deep links/navigation, judgment
ordering, trusted provenance/history, source exits/instrumentation and governed
lifecycle/actions remain. Next is deep-link/navigation support, then governed
business actions. Five R5 findings and formal/manual/operational requirements
remain open. No new provider, signature, spending, deployment or release authority.

## Completed development increment: 0054

Canonical org/repository/path/revision/fingerprint fragments enable authenticated
Brief Back/Forward/reload. Restored views require a current catalog match and
authorized exact read; no foreign/stale substitution. Paired navigation events
are deduplicated, and closing stays in STEER. Source content remains memory-only;
reference metadata can persist in the address bar/history or a user-copied link.

All 37 browser/identity groups and the full root check pass. The reload test
required reinstating the test-only axe engine before the subsequent audit, not
any production relaxation. Evidence: intent/0054/EVIDENCE.md.
Next: judgment-order rendering of known sections
without losing unknown/duplicate source content, then trusted business-state and
lifecycle prerequisites. Automatic post-provider-login return-to-link, governed
actions, qualified manual review and five R5 findings remain open. No provider,
signature, spending, production data, deployment or release authority is added.

## Completed development increment: 0055

Known Brief sections now follow the review sequence using whole parsed nodes;
source bytes, exact revision and every unknown section are retained. Ambiguous
headings, reference definitions and exceeded structural limits keep original
order. A reading note explains the presentation. Sizing and scoping follows
Constraints; missing content, semantic badges, routes and authority are not invented.

Actual browser checks confirm DOM order through synthetic Git/PostgreSQL and
Keycloak. Native renderer tests cover preservation and conservative fallback;
desktop/mobile layout is inspected. Final verification: intent/0055/EVIDENCE.md.
Next: trusted business-state and lifecycle prerequisites, including the five
targeted M0 findings; do not mistake additional read-only UI for their closure.
Automatic post-login link restoration, provenance/history, governed actions,
qualified manual review and operational/pilot evidence remain open. No provider,
signature, spending, production data, deployment or release authority is added.

## Completed development increment: 0056 — targeted M0 correction

R5-005 has a separate policy-bound Unicode-phone correction candidate, leaving
the frozen send-back package unchanged. Complete synthetic privacy graphs
reproduce the old acceptance and corrected rejection of the reported cases.
The portable detector covers all Unicode 17 decimal digits; inspection copies
do not replace signed source bytes. Verification: intent/0056/EVIDENCE.md.

All five findings remain formally open. This is Builder-authored development
evidence, not an independent Test Agent/Critic disposition or protected Exam.
Next: R5-004 exact multi-line cost reconciliation, then the shared human-authority,
lifecycle and migration corrections (R5-002/001/003). After the complete corrected
package, follow the existing independent review/protected incorporation and
revision-bound human ruling path. Do not restart a broad review cycle, request
another human ruling prematurely, or enable governed writes/release/spending.

## Completed development increment: 0057 — targeted M0 correction

R5-004 now has an explicit plural-evidence cost correction candidate. Every
ledger line must have one variance/successor pair, with unique IDs/digests and
exact usage/invoice/ledger bindings. Actual amounts and ordered timestamps are
checked before the unchanged full cost verification and final aggregate. The
original two-line omission is reproduced; reordered and hostile cases are tested.
Verification: intent/0057/EVIDENCE.md. No spending or production behavior enabled.

R5-004/005 have development candidates only; all five findings remain formally
open. Next: R5-002 complete human/provider authority, then R5-001 lifecycle and
R5-003 migration composition. Independent complete-package review, protected
incorporation and exact-revision rulings remain required. Frozen history and
protected Exams are unchanged; no signature, deployment or release is authorized.

## Completed development increment: 0058 — full human-authority candidate

The human portion of R5-002 now binds the complete authority and selected provider
anchor and verifies signatures at explicit record/evaluation times. A reusable
timed verifier has no fixed-time default. Tests reproduce both original R5 accepts
and successor denies, cover every authority field and retain all 17 prior cases.
Evidence: intent/0058/EVIDENCE.md. Frozen files/Exams and live routes are unchanged.

Next: lifecycle/migration corrections and adoption of the explicit-time rule by
every corrected public oracle. R5-002 remains partial until that integration is
verified. All five findings remain formally open, with complete-package independent
review/protected incorporation and revision-bound human rulings still required.

## Completed development increment: 0059 — lifecycle event/history candidate

The current event and every history entry now pass the same closed schema,
complete provider binding, independently anchored record/evaluation-time checks,
scope consistency and replay/order checks. The frozen ignored-history-proof
counterexample is reproduced and blocked. Evidence: intent/0059/EVIDENCE.md.
All 27 declared event types remain supported; no lifecycle effect is authorized.

Next is the shared lifecycle/migration action contract and full graph composition,
then remaining public-oracle timing integration. The per-finding correction
ledger is docs/GATE-2-CORRECTIONS.md. All five findings remain formally open;
independent complete-package review/protected incorporation and exact-revision
rulings are still required. No protected file, provider, signature, spending,
destructive real-data action, deployment or release authority changes.

## Completed development increment: 0060 — shared protected-action candidate

All six lifecycle/migration actions and the existing Exam-candidate commit now
have a single zero-effect successor permission verifier. A trusted context binds
exact target/implementation/policy/scope/resources, while ten closed independently
signed records prove actor/credential/delegation/assignment/authority, resources
and request-specific replay/CAS at explicit record/evaluation times. Source:
intent/0060/SPEC.md; verification: intent/0060/EVIDENCE.md.

Next: integrate the exact closed 0059 events and full 0058 human/raw authority
with all 0060 copy/tombstone actions in the lifecycle graph, then complete the
migration graph's plan/before-after truth/action composition. The shared verifier
does not itself validate external human evidence, install production grants,
consume credentials, reserve a live store or execute an operation. Do not infer
effect authority from a returned descriptor or caller-provided context.
Remaining public-oracle timing, independent complete-package review/protected
incorporation and exact-revision rulings follow. All five findings remain open;
no protected edit, provider access, destructive action, spend or release authorized.

## Completed development increment: 0061 — composed lifecycle candidate

The lifecycle graph now consumes the actual 0059 event/history, 0058 full human
and 0060 shared-action verifiers for every copy and the final tombstone. Current
independent inventory/state assertions, hold conflicts, exact receipts, complete
aggregation and unique authority/credential/CAS/transaction lineage are checked.
Raw erasure finishes by the 60-second deadline; later audit can validate on-time
receipts. Two-provider immediate/raw first-execution and replay cases pass with
zero effects. Evidence: intent/0061/EVIDENCE.md; boundaries: intent/0061/SPEC.md.

Next: migration plan/before-after truth/action composition. Remaining public-
oracle timing and full lifecycle retention/compound/reference/parent/registry
coverage follow before complete-package independent review and protected
incorporation. Frozen keys cannot prove future-expiry coverage, and candidate
validation is not a live deletion/migration worker. All five findings remain
formally open. No new human ruling, protected edit, credential access, destructive
data action, spending, deployment or release is authorized by this increment.

## Completed development increment: 0062 — composed migration candidate

Expand, backfill and contract now consume 0060 shared authorization in a closed
migration graph. Approved plan/starting-state pins, supplied before/after bytes,
backup/rehearsal/rollback proof and full contract cleanup authority precede exact
provider/journal/result checks. A bounded add/copy/drop-column model verifies
actual rows and byte-identical preservation of six governance sources. First,
replay, interruption and rollback cases pass without execution or journal writes.
Evidence: intent/0062/EVIDENCE.md; model/coverage boundaries: intent/0062/SPEC.md.

Next: remaining public-oracle timing, starting with privacy/cost candidates, then
complete lifecycle/migration normative coverage. Actual old/new/concurrent app
compatibility, multi-batch checkpoints, crash cuts, future retention registries
and live atomic dispatch are not established by this bounded model. Complete-
package independent review/protected incorporation and exact-revision rulings
remain required. All five findings remain formally open; no real migration,
protected edit, provider access, spending, deployment or release is authorized.

## Completed development increment: 0063 — privacy/reconciliation time composition

The 0056 privacy and 0057 plural reconciliation consumers now have an explicit
0058 timing path for every signature and nested spending-provider proof. A
closed independent observation binds the exact input and derived record inventory.
Trusted composition supplies evaluation time; requests cannot override clock or
registry. Legacy records with no issuance field are explicitly observed-as-of,
not assigned an invented issuance time. Original Unicode, privacy and all-line
cost checks remain mandatory; current source/use expiry is also checked.

Counterexamples, individual signature/time slots, observation drift, time
boundaries, all 32 line-array permutations and the full 64-line case are tested.
All results have zero execution effects. Evidence: intent/0063/EVIDENCE.md.

Next: non-reconciliation cost/spend and recovery/public-oracle timing, followed
by complete lifecycle/migration normative coverage and independent review. The
legacy observation-time interpretation itself remains subject to that review.
All five R5 findings remain formally open. No production corpus use, spending,
provider access, protected edit, signature, deployment or release is authorized.

## Completed development increment: 0064 — remaining money time composition

Forecast, invoice, aggregate and spending-decision evidence now consume 0058
explicit-time verification for every signature, including every authorization
chain provider proof and replay/head/reservation. Independent exact-byte
observation binds the full code-derived inventory. Spend/forecast needs current
authority; historical invoice/aggregate audit is distinct from new spending.
Replay cannot skip reservation timing/currentness. Accepted evidence reports
VERIFIED and executionAuthorized false, with zero effects.

The selected 20 spend and 28 non-reconciliation cost cases, old-accept/new-deny
counterexamples, all time/signature slots, permutations, full 64-item boundaries
and real signed overflow graphs are tested. See intent/0064/EVIDENCE.md.

Next: recovery and other-public-oracle timing inventory, then full lifecycle/
migration normative coverage and complete-package independent/protected review.
This does not prove stored replay-result bytes or live atomic spending, and the
legacy observed-as-of rule still needs review. All five R5 findings remain open.
No spending, provider access, protected edit, signature, deployment or release.

## Completed development increment: 0065 — recovery time composition

All six supplied recovery signatures now consume explicit 0058 timing, even
across the old pre-ack early-return cases. A separate pinned observation binds
exact original bytes, complete inventory and recovery interval. Native identity/
journal times and the actual journal anchor are checked. The one-hour RTO is
fixed, while historical journal age remains separate from recovery duration.
Canonical base64/fatal UTF-8 protects decoded evidence without normalizing binary
Git objects. Unknown outcomes stay unknown; no recovery or other effect executes.

Eight cuts, 25 corruptions, every signature per cut, coherent old-accept/new-deny
graphs, one-hour boundaries and four-row capacity are tested. Evidence:
intent/0065/EVIDENCE.md. No real restore or provider observation is claimed.

Next: direct authorization/accessibility and remaining public-oracle timing
inventory, followed by full lifecycle/migration normative coverage and complete-
package independent/protected review. All five R5 findings remain formally open.
No spending, provider access, protected edit, signature, deployment or release.

## Completed development increment: 0066 — original authorization time composition

The original public authorization contract now checks all ten source signatures
with explicit times and current credential/authority/store bounds. Independent
observation binds exact bundle and complete inventory. The immutable request
digest is derived before both first and replay paths; agreeing replay claims
cannot hide a fabricated request digest. Audit results use VERIFIED, zero effects
and executionAuthorized false instead of hypothetical provider/Git write counts.

All 32 original cases, ten signature slots on both paths, pre-key counterexamples,
coherent replay-digest substitution and currentness/input bounds are tested.
Evidence: intent/0066/EVIDENCE.md. No actual authorization or provider write occurs.

Next: accessibility and full public-oracle timing inventory, then complete
lifecycle/migration normative coverage and independent/protected review. The
separate shared-action contract remains in 0060. All five R5 findings stay open;
no spending, provider access, protected edit, signature, deployment or release.

## Completed development increment: 0067 — accessibility time and public inventory

The accessibility path checks six signatures with explicit native/as-of times,
provider-bound transitive evidence and a trusted evaluation clock. Every raw row
is bounded by identity, qualification, assignment and summary chronology before
original matrix verification. All 32,900 synthetic rows / 2,664,900 checkpoint
keys and 16 original cases are exercised; manualAuditComplete remains false.

The checked public-oracle inventory maps all ten signed source functions to
actual successor exports and tests, with unsigned helpers/retired factories and
historical primitives explicitly separate. This is not a proof of full normative
behavior or independent acceptance. Evidence: intent/0067/EVIDENCE.md.

Next: full lifecycle retention, compound/reference/parent and future-key coverage,
then migration compatibility/concurrency/checkpoints and the normative package.
Resolve archival/current-authority semantics explicitly; never extend frozen key
windows just to manufacture future positives. All five R5 findings remain open.
No real audit, provider access, protected edit, signature, deployment or release.

## Completed development increment: 0068 — source-faithful lifecycle retention

Corrected earliest supersession/rebuild selection and replaced the frozen
provenance item-closure surrogate with the exact accepted policy rule: later of
retirement and every derived-record deletion over a closed inventory. A current
provider-signed derived manifest is pinned by authority-signed state and included
in the protected-action input digest. Frozen records/table/keys remain unchanged;
the composed candidate policy digest changes explicitly.

Tests cover all 16 current class outcomes, compound selection, complete
parent-capped disposition/replay, matched hold histories and 0–128 derived-record
completions with omission/substitution/time/signature denial. This is not complete
future-expiry or live deletion evidence. See intent/0068/EVIDENCE.md for checks.

Next: future-key/archival and reference-revocation completion, full raw-key and
normative coverage, then migration compatibility/concurrency/checkpoints. Current
trust windows must not be extended to fabricate a future positive. Nanosecond
policy fidelity versus the current millisecond helper also remains to resolve.
All five R5 findings and independent/protected review remain open. No provider
mutation, protected edit, gate signature, deployment, release or spending.

## Completed development increment: 0069 — exact assurance time primitives

Added strict whole-second/nine-digit UTC parsing, BigInt nanosecond formatting
and calendar retention arithmetic with exact parent caps. The shared signature
verifier checks activation, expiry and revocation at individual nanoseconds;
the public lifecycle boundary helper uses the same exact arithmetic. All affected
candidate policies bind the new time contract. Frozen files/windows are unchanged.

Tests cover 2,001 deterministic round trips, pre-epoch and four-digit-year limits,
leap-day clamps, individual-nanosecond key windows, invalid encodings, overflow
and continued denial of expired historical keys. Legacy composed graphs still
reject fractional inputs through their existing schema/business guards; this is
a precision foundation, not complete fractional-time or archival enablement.

Next: explicit successor event/business time schemas, archival/future-retention
and reference-revocation completion, full raw-key/grant coverage, then migration
and normative evidence. All five R5 findings and independent/protected review
remain open; no real provider effects, gate signature, deployment or spending.

## Completed development increment: 0070 — exact lifecycle composition

Explicit in-memory human/event/raw successor schemas now bind their original and
transformed digests while preserving closed shapes. Exact instants flow through
human authority, event history, all seven shared actions and composed lifecycle
decisions. First/replay graphs work with fractional or nanosecond-separated
timestamps; one-nanosecond raw-deadline and parent-cap violations deny. Earliest
credential expiry is chosen by instant, not lexical timestamp order.

No frozen file or key window changed. This does not close other public/migration
precision paths, equal-time event ordinals, auxiliary event-time semantics,
archival/future-retention, reference revocation, raw three-key inventory or the
raw grant's pre-terminal authorization/composition requirements. Those are next
alongside the remaining migration/normative package, before independent review.
All five R5 findings remain open; no provider effects, gate, deployment or spending.

## Completed development increment: 0071 — policy-ranked event ordering

Added exact instant/rank/UUID ordering for the policy's ten ranked equal-time
event types, with no sorting or rewriting of signed history. Unranked ties stay
denied. UUID letter-case aliases no longer evade event replay identity. The
event policy digest binds the mapping and comparison contract.

All 200 ranked pairings, tied full sequences, signature/schema/provider failures,
UUID aliases, bounds and complete lifecycle hold behavior are tested. Full checks
pass with 121 root controls and 88 prototype tests; see intent/0071/EVIDENCE.md.

Next remains retention/rotation/reference and full raw-grant coverage, auxiliary
event-time semantics, other public precision paths and migration/normative
evidence. No frozen record or key window changed; independent/protected review
and all five R5 findings remain open. No provider effects, approval or spending.

## Completed development increment: 0072 — three-key raw lifecycle evidence

Expanded raw synthetic evidence to three distinct key tuples across two provider
bindings. Three copy actions plus separate tombstone traverse the actual composed
path in first/replay modes and all six copy orders. Every human/shared proof slot
is tested per copy, along with substitutions, missing/partial receipts, aggregate
omissions and a one-nanosecond deadline miss for each key. No verifier/runtime
cardinality rule changes and no real provider effect is claimed.

Next raw work is the explicit pre-terminal grant protocol in intent/0072/PLAN.md.
Current approval follows terminal/state and binds post-terminal graph bytes; an
earlier validFrom does not satisfy pre-terminal signing. The successor must bind
only facts available before terminal, then validate actual state and derive
per-copy one-use actions without new per-object human decisions. Keep batch
consumption/replay and separate tombstone evidence explicit. Retention/rotation/
reference, other precision paths and migration/normative evidence also remain.
All five R5 findings stay open; no protected edit, provider effects, gate or spending.

## Completed development increment: 0073 — pre-terminal raw grant eligibility

Added a closed offline verifier for independently signed preparation and complete
human enrollment before the named terminal. The same grant covers pass/fail/
cancelled outcomes and binds only facts available beforehand. Exact inventory,
provider, context, revision, safeguards and nanosecond time checks remain required.
Success is explicitly non-executable, zero-effect evidence; it neither consumes
the grant nor changes the existing 0061 raw execution composition.

Full repository checks pass with 129 root controls and 88 prototype tests.
See intent/0073/EVIDENCE.md for synthetic versus cached verification boundaries.

Next is authoritative batch reservation/replay and full raw lifecycle integration
under intent/0073/PLAN.md, preserving current holds/references/inventory, exact
per-copy actions and timely receipts, and separate tombstone authority. Further
retention/rotation/reference, precision and migration/normative coverage remains.
All five R5 findings stay open. No protected edit, provider effects, gate or spending.

## Completed development increment: 0074 — raw grant and batch lifecycle integration

The actual lifecycle candidate now requires raw-v2 with one complete pre-terminal
grant, exact current inventory/history/state, all per-copy shared action proofs
and timely receipts. Full original winning and current independent batch chains
bind the grant, current input and every exact request. Old raw-v1 and per-copy
human grant fields deny. Tombstone retains separate human/action authorization.

The 28-group focused lifecycle suite and full repository checks pass, including
137 root controls and 88 prototype tests. See intent/0074/EVIDENCE.md for limits.

All-first and exact all-copy replay work, including a separate first tombstone
after copy replay. Mixed partial-copy retries remain closed. The next bounded
work is durable checkpoint/current-state-refresh evidence under intent/0074/PLAN.md,
then remaining retention/rotation/reference, time and migration/normative coverage.
No atomic store, actual concurrency exclusion, live erasure, independent ruling
or completed Gate 2 is claimed. All five R5 findings remain formally open.

## Completed development increment: 0075 — single-checkpoint raw recovery

Raw-v3 now composes one exact checkpoint with fresh extending history, remaining
inventory and hold/reference state. Original grant, request plan and opening
proofs remain immutable. Completed receipts are preserved; only remaining tuples
can pass first-mode action checks under a winning continuation reservation.
Separate human tombstone approval also binds the checkpoint.

Full checks pass with 143 root controls and 88 prototype tests; the focused
lifecycle suite passes 34 groups. See intent/0075/EVIDENCE.md for the scope.

All eight completed subsets of the three-copy scenario are covered. A second
checkpoint remains closed: next is bounded monotonic checkpoint-chain/crash
evidence under intent/0075/PLAN.md. This is offline evidence, not a durable store,
live recovery or erasure worker. Remaining retention/rotation/reference, time,
migration/normative evidence and all five R5 formal findings remain open.

## Completed development increment: 0076 — bounded repeated-checkpoint chains

Raw-v4 verifies every full predecessor checkpoint and winning store chain,
monotonic completed receipts and extending history with fresh remaining inventory.
Original grant/requests/plan/opening remain unchanged. Erasure receipts inside
later-revealed hold intervals deny. Final human tombstone approval binds the chain.

Full repository checks pass with 150 root controls and 88 prototype tests;
the focused lifecycle suite passes 41 groups. See intent/0076/EVIDENCE.md.

All 27 two-checkpoint partitions and a 33-step nanosecond capacity scenario pass.
These are offline assertions, not real restarts, atomic storage or erasure.
Next is terminal consumption/acknowledgment-loss evidence under intent/0076/PLAN.md,
then remaining retention/rotation/reference, time and migration/normative coverage.
All five R5 findings and independent/protected review remain open; no gate,
provider mutation, deployment, release or spending is authorized.

## Completed development increment: 0077 — raw terminal consumption readback

The offline raw-v4 wrapper seals the exact original graph, grant, plan, chain,
aggregate and separately authorized tombstone. Full independent terminal/current
committed store proofs are required. Repeated acknowledgment-loss audits return
only zero-effect REPLAY_NOOP; a checkpoint, new winner, fork or different result
cannot stand in for completed consumption. Original signed bytes stay unchanged.
Current authority/expiry is rechecked using only temporary unsigned clock inputs;
old observations and fresh terminal records cannot rescue expired original proofs.

Full checks pass with 157 root controls and 88 prototype tests. Seven new terminal
groups cover all 24 outcome/partition combinations, exact retries, scope/result
substitutions, omitted/forged records, reused heads, expiry and malformed input.
See intent/0077/EVIDENCE.md for verification and cached-task boundaries.

Next is future-retention/key-rotation/reference evidence, then remaining auxiliary
time and migration compatibility/checkpoint/crash-cut coverage and the normative
inventory under intent/0077/PLAN.md. Real terminal storage and transport recovery
are not implemented by this offline verifier. All five formal R5 findings remain
open pending independent/protected review; no gate or deployment is claimed.

## Completed development increment: 0078 — historical facts with current witnesses

Historical lifecycle events can now be revalidated as facts after original-key
expiry through a separate offline contract. Original bytes, signatures and key
windows stay exact. Trusted current registry/archive selection and fresh independent
revalidation/retention proofs are mandatory; known current revocation denies.
Success supplies no current action authority and cannot authorize deletion.

Eight focused groups cover future one-/three-/seven-year dates, all 27 event
kinds, exact revocation/expiry, complete original proofs, current independence and
bounded input. Full checks pass with 165 root controls and 88 prototype tests;
see intent/0078/EVIDENCE.md for synthetic/cached boundaries.

Next is fresh current-registry human authority, then full historical/current
lifecycle and reference-revocation composition under intent/0078/PLAN.md. This is
not completed future retention or a live archive. All five R5 findings, actual
integration, normative coverage and independent/protected review remain open.

## Completed development increment: 0079 — fresh current human authority

The full human verifier now has explicit trusted current-registry selection and
a separate trusted evaluation clock. All nine signed records must be current;
expired historical approvals cannot substitute. Original policy/API output and
old key material/windows remain unchanged. Candidate ALLOW has zero effects and
does not create a human signature or authorize execution.

The 12-group human suite and full checks pass, including 171 root controls and
88 prototype tests. Future dates, per-record omissions/forgeries/wrong roles,
clock mismatch, expiry/revocation and exact bindings are covered. See
intent/0079/EVIDENCE.md for the corrected test-helper issue and evidence limits.

Next is full historical/current lifecycle composition under intent/0079/PLAN.md,
followed by exact reference-revocation/verification-bundle and remaining normative
coverage. No new trust is deployed, no live erasure is performed, and all five
formal R5 findings remain open pending independent/protected review.

## Completed development increment: 0080 — full future lifecycle composition

An explicit current-v1 graph now composes full historical evidence with fresh
current inventory/state, human authority, shared actions and exact selected-provider
resource/receipt keys. Four supported classes cover one-/three-/seven-year periods;
every copy, aggregate and separately authorized tombstone is checked. Old key
windows stay unchanged, archive proof precedes state, and current holds/expiry
remain enforced. Raw and referenced objects cannot enter this new path.

Seven new focused groups and full checks pass: 178 root controls, 88 prototype
tests and 55 lifecycle tests. See intent/0080/EVIDENCE.md for the corrected output
expectations, extra selector/chronology controls and synthetic/cached limitations.

Next is mixed-era event history under intent/0080/PLAN.md, then full reference
revocation/retained-verification and remaining record-class/normative coverage.
This is complete offline evidence for the admitted scenarios, not an actual
deletion, live trust rollout or archive integration. All five R5 findings remain
open pending independent/protected review; no gate or spending is authorized.

## Completed development increment: 0081 — mixed-era lifecycle history

Current-v2 verifies the exact archived prefix and every current-key suffix event,
with global ordering, event/provider identity uniqueness and combined hold/release
state processing. Current event verification preserves the original API/policy.
Mixed runtime keys cannot alias or relabel historical material; event/provider
signatures must use independent keys.

Full checks pass with 186 root controls and 88 prototype tests. Eight new groups
cover mixed first/replay histories, holds, suffix proofs, bounds, versions, key
independence and original compatibility. See intent/0081/EVIDENCE.md; these are
synthetic assertions, not a live feed, current trust publication or human approval.

Next is full qualified-owner binding for current hold/release events, then exact
reference inventory/revocation and retained verification bundles under
intent/0081/PLAN.md. A provider-bound hold event alone is not claimed as that
qualified-owner evidence. Other classes, normative coverage and all five formal
R5 findings remain open pending independent/protected review.

## Completed development increment: 0082 — non-erasure qualified authority

The shared human verifier now has an explicit qualified-event profile, with its
own closed schema and policy. It supports active-hold release without false
no-hold, erase-method or raw-deadline fields. All nine current owner proof records
remain mandatory, with exact one-record selector inventory, independent keys,
current clock, event/predecessor fields and bounded freshness.

The human suite passes 18 groups; full checks pass with 192 root controls and
88 prototype tests. See intent/0082/EVIDENCE.md for synthetic/cached boundaries.
Original signed schemas and disposition profile/policy outputs remain unchanged.

Next is binding those qualified records to actual current events and complete
history under intent/0082/PLAN.md. A verified owner record is not yet a verified
event mutation or permission to erase. Qualified archival proof, reference
revocation/retained-verification, other normative coverage and all five formal
R5 findings remain open. No signature, live effect or gate approval is claimed.

## Completed development increment: 0083 — qualified hold-event history

Current-v3 now verifies every current hold decision with the complete qualified
owner profile and binds exact actor/hat, event, selector, preceding hold and
approval-before-commit timing. Ordered proof mappings are closed and bounded;
human decision identities cannot be reused by later copy or tombstone approvals.
The qualified evidence is included in the full graph input digest.

Seven new focused groups and full checks pass: 199 root controls, 88 prototype
tests and 68 lifecycle tests. See intent/0083/EVIDENCE.md for synthetic/cached
evidence limits. Original profiles and protected artifacts remain unchanged.

Historical applications can restrict disposition and receive a new current
qualified release. Historical releases without qualified archival evidence remain
blocked. That archival proof is next under intent/0083/PLAN.md, followed by exact
reference revocation/retained verification and remaining normative coverage.
All five formal R5 findings remain open; no signature, live mutation, gate approval,
deployment or spending is authorized.

## Completed development increment: 0084 — archived qualified-owner evidence

Current-v4 composes the complete original owner bundle for every archived hold
decision with current independent revalidation/retention witnesses. Each decision
uses its own retained original observation, not a new or backdated approval.
Original signatures and current known revocations are checked; old keys are not
renewed. The same event/actor/selector/predecessor/chronology checks and unique
decision identities cover archived and current holds and later approvals.

Eight new groups and full checks pass: 207 root controls, 88 prototype tests and
76 lifecycle tests. See intent/0084/EVIDENCE.md for synthetic/cached limits.
Archive retention must be available before current state; current copy/tombstone
approval remains independently mandatory. Frozen artifacts remain unchanged.

Next is exact reference revocation/retained-verification evidence under
intent/0084/PLAN.md, followed by remaining source/class/normative and migration
coverage. This version covers the original pinned trust era, not every successor
era or a live archive integration. All five formal R5 findings remain open. No
actual human signature, provider mutation, gate approval, deployment or spending.

## Completed development increment: 0085 — qualified reference decision profile

The new qualified-reference profile represents reference revocation without
pretending it is a hold release or an erasure grant. It binds the event, exact
referenced record selector, reference inventory digest, verification bundle digest
and bounded tombstone identifier. All nine current owner proofs and short-lived
freshness checks remain required; existing profiles and frozen schemas stay exact.

Six new focused groups and final full checks pass: 24 human test groups, 213 root
controls and 88 prototype tests. See intent/0085/EVIDENCE.md for the final rerun
after ID hardening and synthetic/cached limits. Protected artifacts are unchanged.

Next is actual reference inventory/retained-verification content and full
event/history/lifecycle composition under intent/0085/PLAN.md. This profile alone
does not admit referenced objects to the current runtime, prove retention or
permit deletion. All five formal R5 findings remain open. No real signature,
provider mutation, gate approval, deployment or spending is authorized.

## Completed development increment: 0086 — retained reference content

The content verifier requires exact pinned version/reference manifests and actual
matching verification records, with independent current inventory, verification
and retention attestations. Complete ordered cardinality, physical uniqueness,
source/target/version hashes, current key validity and observation chronology are
checked. Bounds use UTF-8 bytes; the 128-reference limit has positive/negative tests.

Seven focused groups and full checks pass: 220 root controls and 88 prototype
tests. See intent/0086/EVIDENCE.md for synthetic/cached limits. Content integrity
does not claim actual discovery of a real repository or a live retained archive.

Next is the qualified reference event and separate exact-set removal evidence,
then full history/state/copy/tombstone composition under intent/0086/PLAN.md.
The current runtime still excludes referenced-evidence disposition. No real owner
signature, reference mutation, erasure, provider access, deployment or spending is
authorized. All five formal R5 findings remain open.

## Completed development increment: 0087 — qualified reference revocation evidence

The reference verifier now consumes complete retained content, all nine qualified
owner proofs and the actual typed event with independent provider binding. Exact
actor/hat, selector, content/tombstone identities and approval-before-commit timing
are enforced. Authorization is followed by exact per-reference removal receipts
and independent cleared-state completion; missing or partial removal denies.

Seven new groups and full checks pass: 14 reference test groups, 227 root controls
and 88 prototype tests. See intent/0087/EVIDENCE.md for synthetic/cached boundaries.
No reference was actually removed or owner signature created; all outputs remain
fact-only with zero effects and separate current action authority required.

Next is full referenced-evidence lifecycle admission under intent/0087/PLAN.md:
exact history/state/completion binding, retention and holds, complete copy/version
inventory, separately authorized tombstone and cross-decision replay guards.
All five R5 findings remain open; no protected edit, signature, provider mutation,
release, deployment or spending is authorized.

## Completed development increment: 0088 — exact reference-action resources

Integration identified a prerequisite: generic copy/tombstone selectors did not
explicitly carry the copy content hash or chosen tombstone record identity.
A separate reference-only profile now adds those fields and the retained bundle
digest through the same complete protected-action verifier, without changing the
original seven-action contract. Provider observations must match every new field.

Five new groups and full checks pass: 12 shared-action groups, 232 root controls
and 88 prototype tests. See intent/0088/EVIDENCE.md for synthetic/cached boundaries.
Only reference delete-copy and commit-tombstone are enumerated; wrong classes,
paths, key aliases, missing proofs and profile downgrades deny with zero effects.

Next is the full referenced-evidence lifecycle runtime under intent/0088/PLAN.md,
including exact copy/version hashes, history/state/revocation binding, retention,
holds, separately authorized named tombstone and cross-decision identity guards.
All five formal R5 findings remain open. No action, signature, protected edit,
provider mutation, release, deployment or spending is authorized.

## Completed development increment: 0089 — referenced-evidence lifecycle

The explicit reference-only current-v5 runtime now composes retained content,
qualified revocation, exact removal, complete current/archived history and hold
proofs, the three-year expiry and complete copy/version hashes. Every copy and
the named tombstone still require their own full human/shared-action/provider
receipt path. Reference approval cannot reuse later decision identities or claim
a hold release that had not happened when the owner decided.

Eight new groups and final full checks pass: 240 root controls, 88 prototype tests,
84 lifecycle groups and 14 reference groups. See intent/0089/EVIDENCE.md for exact
synthetic/cached limits. Frozen artifacts remain unchanged; no actual deletion,
owner signature, gate approval, deployment or spending is authorized.

Next is the remaining source/class/trust-era and migration coverage reconciliation
under intent/0089/PLAN.md. In particular, the migration graph still uses the
original whole-second outer clock while shared action/human records support exact
nanoseconds; that bounded precision gap precedes broader compatibility/checkpoint
coverage. Live store/source integration and independent/protected review remain.
All five formal R5 findings remain open.

## Completed development increment: 0090 — exact migration chronology

The separately selected v2 migration profile now carries exact nanosecond time
through the complete existing plan/backup/human/shared-action/rollback/journal/
result/replay evidence body. Original v1 policy, grammar and outputs stay exact.
The new profile explicitly denies execution in every result. No SQL or journal
write is performed by this offline candidate.

All 12 migration groups pass, including six new precision groups covering every
phase, first/replay, supported interruption/rollback labels, one-nanosecond
ordering, exact age/expiry, full proof omissions and profile isolation. Final full
checks pass; see intent/0090/EVIDENCE.md for synthetic and cached limits.
Frozen artifacts are unchanged. All five formal R5 findings remain open.

Next under intent/0090/PLAN.md is actual bounded old/new reader/writer behavior
and concurrent compatibility evidence, followed by multi-batch/checkpoint/crash
coverage and remaining normative/source/class/trust-era reconciliation. Current
supportedReaders/supportedWriters metadata is not that behavioral proof. The
protected EXAM A10.3 and section 9 migration requirements remain authoritative;
no live runner, destructive cleanup, signature, release, deployment or spending
is authorized. The existing implementation heartbeat remains active.

## Completed development increment: 0091 — executable migration compatibility

The full exact migration graph now composes with a source-pinned executable
dual-column shim model for both declared version pairs. Every row in both actual
supplied states runs 24 read/write permutations and both competing snapshot
winner orders, including stale rejection, replay/key drift and retry. The model
rejects stale mirrored values and contract data loss that the single-step signed
transformation could otherwise accept. No client behavior is inferred from a label.

All 19 migration groups pass, including seven new groups and 6,656 scenarios at
128 rows. Final full checks pass with 253 root controls and 88 prototype tests;
see intent/0091/EVIDENCE.md for synthetic/cached limits. This is not live app or
database concurrency, durable CAS, a migration runner or an independent review.
Frozen artifacts remain unchanged; all five formal R5 findings remain open.

Next under intent/0091/PLAN.md is ordered multi-step/batch/checkpoint composition:
exact predecessor after-truth to successor before-truth, approved closed inventory,
unique action identities, interrupted/resumed and replayed steps. Resolve schema
semantics explicitly: the current single-step profile requires different from/to
schema versions, which cannot represent same-schema backfill batches unchanged.
Use a distinct profile for that capability rather than weakening existing pins.
No signature, real cleanup, provider mutation, release, deployment or spending is
authorized. Remaining source/class/trust-era/normative and live coverage is open.

## Completed development increment: 0092 — ordered migration evidence chains

Separate staged profiles preserve schema during backfill and reuse complete
signed/executable compatibility verification. The ordered chain binds exact
predecessor before/after truth, immutable scope, approved coordinates, complete
disjoint row coverage and request-owned action identities through replay.
Interrupted/restored prefixes remain pending; a fresh fully verified retry can
complete. A repeated committed observation never advances twice.

All 26 migration groups pass, including seven new groups and explicit omission
of an unchanged null-valued row, individually passing transplanted/early state,
and cross-request replay-reservation counterexamples. Final full checks pass with
260 root controls and 88 prototype tests; see intent/0092/EVIDENCE.md for exact
synthetic/cached limits. Frozen artifacts remain unchanged. All five formal R5
findings remain open; no live migration, signature or gate approval occurred.

Next under intent/0092/PLAN.md is durable checkpoint/current-head/consumption
evidence, acknowledgment loss and restart readback around the verified chain.
Checkpoint-only observations must not create a duplicate backfill effect.
Remaining provider crash cuts, real app/database concurrency and full normative/
source/class/trust-era coverage stay separate. No provider mutation, real cleanup,
release, deployment or spending is authorized. The implementation loop remains active.

## Completed development increment: 0093 — checkpoint-slot readback evidence

One independently selected migration checkpoint slot now composes full original
and current chain verification with twelve signed opening, checkpoint/retention,
terminal, delivery and current readback records. Lost acknowledgment still needs
terminal commit and fresh readback. Current checks cannot revive expired plan or
human evidence; original signed bytes remain unchanged. Readback emits no new
migration/checkpoint effect and no resume authority.

Seven new groups and final full checks pass: 267 root controls, 88 prototype tests
and all 33 migration groups. See intent/0093/EVIDENCE.md for synthetic/cached limits.
Frozen artifacts remain unchanged; all five formal R5 findings remain open.
No real persistence, provider request, migration, signature or gate approval occurred.

Next under intent/0093/PLAN.md is successive checkpoint/head linkage and exact
chain-prefix extension, not another first-slot commit. Preserve retained contract
human audit-clock scalars in original bytes while supporting later current-time
verification; never rewrite native signed times or omit failed contract attempts.
Chain-wide latest-head resolution, real durable storage/restart, remaining crash
cuts and normative/source/class/trust-era coverage remain open. No resumed action,
provider mutation, cleanup, release, deployment or spending is authorized.

## Completed development increment: 0094 — current retained-prefix audit

Explicit read-only current observation now verifies retained staged graphs and
chains with different unsigned contract-human audit clocks, while preserving
original graph/prefix bytes and evidence seals. Every signed native/current proof
and executable model check still runs. The new chain mode also gives one-request
ownership to contract authority/provider/idempotency/reservation/head identities.
Original factories and input policies remain unchanged; a separate observation
policy identifies the current audit, which does not prove original-as-of observation.

Four new groups and final full checks pass: 271 root controls, 88 prototype tests
and all 37 migration groups. Retained failed contracts plus fresh retries pass;
expired proof, reused decision identity, forged/missing evidence and changed
original replay bytes fail. See intent/0094/EVIDENCE.md for synthetic/cached limits.
Frozen artifacts are unchanged. All five formal R5 findings remain open.

Next under intent/0094/PLAN.md is full successive checkpoint/head/prefix linkage,
explicitly binding the current observation policy in its source/checkpoint records.
Verify the full prior checkpoint/current head and strict immutable attempt-prefix
extension; no checkpoint-only observation may duplicate a migration effect or
authorize resumed work. Real storage/restart and remaining crash-cut, normative,
source/class/trust-era coverage remain open. No signature, provider mutation,
cleanup, release, deployment or spending is authorized. The loop remains active.

## Completed development increment: 0095 — successive checkpoint continuity

Trusted ordered checkpoint slots now reverify each predecessor and the complete
current migration chain. All signed sources bind the separate observation policy
and exact predecessor; successor opening state preserves the full prior current
head and reservation. Strict original attempt-prefix extension requires a new
post-readback request. Replay-only observations do not create another update.
Two/three-slot cases and retained failed contracts with later fresh retries pass.

Seven new groups and final full workspace checks pass: 278 root controls,
88 prototype tests and all 44 migration groups. See intent/0095/EVIDENCE.md for
the verification record and synthetic/cached limits. Frozen artifacts are
unchanged. All five formal R5 findings remain open.

Next under intent/0095/PLAN.md is authoritative latest-head resolution so an older
but internally valid supplied sequence cannot stand in for the latest retained
state. Real storage/restart, crash-cut and normative/source/class/trust-era
coverage remain open. No live provider mutation, migration, signature, release,
deployment or spending occurred. The authorized implementation loop remains active.

## Completed development increment: 0096 — latest checkpoint observation evidence

Full checkpoint sequences are now checked against fresh query-bound canonical
head, exact retained object, unchanged head confirmation and independent audit
records. An internally valid stale sequence fails when the signed source reports
its successor. Changed readback state, unknown/pre-commit outcomes, expired proof
and substituted challenges deny without another effect or resume authority.

Seven new groups and final full checks pass: 285 root controls, 88 prototype tests
and all 51 migration groups. See intent/0096/EVIDENCE.md for synthetic/cached
limits. No real store query, migration, gate signature or deployment occurred.
Frozen artifacts are unchanged; all five formal R5 findings remain open.

Next under intent/0096/PLAN.md is a finite reconciliation of the frozen findings'
remaining source/class/trust-era and migration/recovery crash-cut requirements.
Map implemented entry points and tests, explicitly mark unsupported cells, and
order remaining integration work before selecting further code changes. Do not
equate accumulated verifier/test counts with complete Phase 1 or Gate 2. No
provider mutation, cleanup, release, deployment or spending is authorized.

## Completed development increment: 0097 — finite R5 gap inventory

The remaining assurance work is now a finite source-pinned inventory, not another
standalone verifier. It preserves five current findings and fourteen historical
IDs, maps all sixteen lifecycle classes and fourteen actual function/test pointers,
and retains the exact 3,600 migration coordinates plus fourteen additional cases.
Corrected execution-ID coverage is explicitly unreconciled. All eight recovery
cuts and twenty-five corruptions are mapped; the two pre-ack unknown outcomes are
expected safe results rather than missing success paths.

Five new inventory tests and final full checks pass: 290 root controls and
88 prototype tests. See intent/0097/EVIDENCE.md for synthetic/cached limits.
Frozen artifacts are unchanged. No formal finding, gate, live integration or
production-readiness claim changes.

Next is GAP-01 in intent/0097/GAP-INVENTORY.json: derive stable required IDs and
map actual corrected executions, leaving unsupported cells explicit. GAP-02/03/04
then complete mapped migration, lifecycle and trust/time coverage; GAP-05 covers
isolated runtime/recovery integration; GAP-06 is the independent/protected path.
These packages do not replace the remaining M1–M8 platform milestones. No frozen
edit, provider mutation, cleanup, release, deployment or spending is authorized.

## Completed development increment: 0098 — corrected execution ledger foundation

The catalog independently retains all 4,027 frozen declaration IDs and nine R5
counterexamples, including singular major-finding records. Trusted hooks invoke
corrected code and seal actual input/output/assertion observations. The snapshot
has 63 passing mapped executions and 3,973 IDs not yet mapped into this runner;
that is not a count of missing features. Complete-coverage mode exits 2 as intended.

Six new tests and final full checks pass: 296 root controls and 88 prototype
tests. A fresh run exactly matches the saved report. See intent/0098/EVIDENCE.md
and EXECUTION-REPORT.json for synthetic/cached limits. No frozen files or formal
finding/gate state changed. GAP-01 remains open.

Next under intent/0098/PLAN.md is mapping existing corrected recovery and complete
human-authority fixtures to exact required IDs, retaining proper unknown recovery
outcomes and positive controls. Then connect the remaining domains without
crediting labels or arbitrary denials as semantic execution. The finite GAP-01–06
plan and M1–M8 platform milestones remain. No provider mutation, cleanup, release,
deployment, spending or signature is authorized.

## Completed development increment: 0099 — recovery and human execution mappings

The ledger now invokes corrected recovery and complete human-authority fixtures
for 52 additional exact IDs. All eight recovery cuts retain their expected
outcomes, including the two unknown pre-ack results; all 25 corruptions have a
verified positive control. All 17 human cases retain the exact frozen mutations
against a full-binding positive bundle. Both R5-002 counterexamples demonstrate
legacy acceptance and the named corrected binding/time error, without approving
an action. New hook/fixture source digests are recorded explicitly.

Five new groups and final full checks pass: 301 root controls and 88 prototype
tests. The new snapshot exactly matches a fresh run: 115 passed, zero failed and
3,921 unmapped IDs out of 4,036. The earlier 0098 snapshot is unchanged. See
intent/0099/EVIDENCE.md for synthetic/cached limits. No protected artifacts or
formal finding/gate state changed; GAP-01 remains open.

Next under intent/0099/PLAN.md are remaining shared-action/authorization,
privacy/time and cost mappings, followed by lifecycle and migration reconciliation.
The finite GAP-01–06 assurance plan and separate M1–M8 platform milestones remain.
No provider mutation, cleanup, release, deployment, spending or signature is authorized.

## Completed development increment: 0100 — authorization, money and privacy time

The ledger adds 86 exact IDs: 32 original authorization, 20 spending and 34 cost
cases. All use complete positive controls. Six reconciliation cases use plural
0057/0063 evidence with unchanged original signed variance/successor bytes;
overflow cases execute exact declared primitives and signed aggregate rejection.
The 19 existing privacy graph IDs now include full independent-time observations,
without duplicate credit. Original authorization does not certify the separate
0060 shared-action contract; one-line cost cases do not resolve R5-004.

Seven new groups and final full checks pass: 308 root controls and 88 prototype
tests. A fresh run matches the new snapshot: 201 passed, zero failed and 3,835
unmapped IDs of 4,036. Earlier snapshots are unchanged. See intent/0100/EVIDENCE.md
for synthetic/cached limits. Protected artifacts and formal finding/gate state
are unchanged; GAP-01 and all five formal R5 findings remain open.

Next under intent/0100/PLAN.md are the R5-004 multi-line counterexample and remaining
identifier/detector cases, followed by shared-action/lifecycle/migration and other
normative reconciliation. The finite assurance packages and platform milestones
remain separate. No provider mutation, cleanup, release, deployment, spending or
signature is authorized.

## Completed development increment: 0101 — detectors and multi-line reconciliation

The ledger adds 74 remaining identifier/detector IDs and the single R5-004 case.
Unchanged non-phone classification is explicitly scoped as a retained component,
not newly corrected behavior or full corpus acceptance. The complete two-line
reconciliation verifies all 14 records and aggregates before rounding. The legacy
single-pair acceptance is reproduced; either missing variance or successor,
including both missing, denies without totals. All 32 independent array orderings
retain exact record sets and totals. Forty observations count as one R5 ID.

Six new groups and final full checks pass: 314 root controls and 88 prototype
tests. A fresh run matches the new snapshot: 276 passed, zero failed and 3,760
unmapped IDs of 4,036. Earlier snapshots are unchanged. See intent/0101/EVIDENCE.md
for synthetic/cached limits. No protected artifact or formal finding/gate state
changed. GAP-01 and all five formal R5 findings remain open.

Next under intent/0101/PLAN.md are trust-domain, schema and complete accessibility
mappings, carefully distinguishing structural validity and synthetic matrices
from corrected semantic and qualified manual evidence. Then reconcile the four
remaining R5 IDs, 94 lifecycle graph cases and 3,614 migration cases. The finite
assurance packages and M1–M8 milestones remain separate. No provider mutation,
cleanup, release, deployment, spending or signature is authorized.

## Completed development increment: 0102 — public signing capability boundaries

The ledger adds all 17 exact private-domain signing requests. Every hook proves
ordinary-record signing works, then observes the actual private-domain rejection
without a signed record. Tests also prove an ordinary signature cannot impersonate
any declared independent domain. This is retained API behavior, not cryptanalysis,
live key custody or provider access.

Four new groups and final full checks pass: 318 root controls and 88 prototype
tests. A fresh run matches the snapshot: 293 passed, zero failed and 3,743 unmapped
IDs of 4,036. See intent/0102/EVIDENCE.md for synthetic/cached limits and the
separate actual 16.25-second positive accessibility benchmark. That benchmark
is neither a ledger mapping nor manual evidence. All 15 schema and 16 accessibility
IDs remain unmapped; protected artifacts and all five formal findings are unchanged.

Next under intent/0102/PLAN.md is explicit old-versus-corrected schema reconciliation,
then streamed accessibility execution evidence. Preserve exact consumed rows and
complete controls without treating metadata or cached reports as execution.
Remaining R5/lifecycle/migration mappings, GAP-01–06 and M1–M8 remain open. No
provider mutation, cleanup, release, deployment, spending or signature is authorized.

## Completed development increment: 0103 — schema source reconciliation

The source map retains all 15 exact schema files, hashes, IDs and declared version
constants. Three cases use the existing 0070 precision successors and eleven
exercise retained structural validators. Original positives/negatives, closed
objects and every declared precise timestamp field are checked. Fractional
detector-policy thresholds remain JSON numbers in the observation seal; signed
record canonicalization is unchanged. The obsolete migration schema stays unmapped.

Six new groups and final full checks pass: 324 root controls and 88 prototype
tests. A fresh run matches the snapshot: 307 passed, zero failed and 3,729 unmapped
IDs of 4,036. See intent/0103/EVIDENCE.md and SCHEMA-MAP.json. Structural evidence
does not validate copied signatures or full graphs; sample accessibility schemas
do not count as matrix execution. All 16 accessibility IDs and the migration
schema remain unmapped. Protected artifacts and all five formal findings are unchanged.

Next under intent/0103/PLAN.md is actual streamed accessibility execution evidence,
with complete controls and consumed-row seals rather than metadata-only credit.
Then reconcile remaining R5/lifecycle/migration cases and the obsolete migration
schema. GAP-01–06 and M1–M8 remain separate. No provider mutation, cleanup, release,
deployment, spending or signature is authorized.

## Completed development increment: 0104 — streamed accessibility execution

The full v2 ledger executes all 16 original synthetic accessibility cases. Its
positive actually consumes 32,900 raw rows and verifies 2,664,900 expanded matrix
cells. Each negative binds that passed positive execution from the same run.
Length-framed prefix hashes, legacy row digests, counts, exhaustion and closure
record what was actually consumed; early rejection does not read or claim the tail.
Passing a negative case means its rejection assertions passed, not a valid matrix.

Fixed profiles keep execution claims explicit: full records 323 passed and 3,713
uncovered; quick records 307 passed and 3,729 uncovered, leaving the 16 heavy cases
unexecuted. Strict completion fails early with an explicit deferred-full preflight
while unmapped full hooks remain; when none remain, it must execute full before
succeeding. No cached report supplies evidence or positive prerequisites.

Five new root groups and final full checks pass: 329 root controls and 88 prototype
tests. A separate three-group full integration process actually reran the matrix
and exactly matched the full snapshot. See intent/0104/EVIDENCE.md for timings and
synthetic/cached limits. This is not a qualified manual audit or independent Critic.
Protected artifacts and all five formal R5 findings are unchanged; GAP-01 stays open.

Next under intent/0104/PLAN.md is the four remaining R5 counterexample mappings,
then 94 lifecycle graph and 3,614 migration cases plus the obsolete migration
schema. Full profile leaves exactly those 3,713 IDs uncovered. GAP-01–06 and
M1–M8 remain separate. No provider mutation, cleanup, release, deployment, spending
or signature is authorized.

## Completed development increment: 0105 — omitted-action executions

The ledger maps the two omitted-action R5 reproductions through the complete
existing shared verifier. All six lifecycle/migration actions have complete
positive and replay controls, every signed-proof omission/corruption, re-signed
hostile semantics, exact resource substitutions and installed scope/target
transplants. The old manifest omission is reproduced separately. The 177 lifecycle
and 179 migration observations count as two exact IDs, not 356 cases.

Five new groups and final full checks pass: 334 root controls and 88 prototype
tests. Fresh quick execution matches 309 passed / 3,727 uncovered; full matches
325 passed / 3,711 uncovered, both with zero failures. A separate three-group
full integration process actually reran the matrix and matched the full snapshot.
See intent/0105/EVIDENCE.md for synthetic/cached limits. Shared-action proof is not
full graph execution or live authorization. All five formal findings stay open.

Next under intent/0105/PLAN.md are the full lifecycle surrogate-trigger and
migration target-free boolean-winner graph reproductions with complete controls,
followed by 94 lifecycle graph, 3,614 migration and one obsolete schema case.
GAP-01–06 and M1–M8 remain separate. No protected edit, provider mutation, cleanup,
release, deployment, spending or signature is authorized.

## Completed development increment: 0106 — complete migration counterexample

The exact target-free boolean-winner R5 reproduction now runs through the full
staged v3 migration graph. All three phases pass complete positive, replay,
interruption and rollback controls. Missing targets/actions and re-signed
source/row/journal corruption deny; contract requires complete scoped human proof.
Expected transformations are constructed separately; six governance source byte
strings and actual backup/restoration bytes are preserved. Its 135 observations
count as one R5 ID, not migration matrix execution or a real database operation.

Five new groups and final full checks pass: 339 root controls and 88 prototype
tests. Fresh quick execution matches 310 passed / 3,726 uncovered; full matches
326 passed / 3,710 uncovered, both with zero failures. A separate three-group full
integration process reran the matrix and matched the full snapshot. See
intent/0106/EVIDENCE.md for synthetic/cached limits. All formal findings stay open.

Next under intent/0106/PLAN.md is the final lifecycle surrogate-trigger graph
reproduction with a complete corrected control, then 94 lifecycle graph,
3,614 migration and one obsolete schema case. GAP-01–06 and M1–M8 remain separate.
No protected edit, provider mutation, cleanup, release, deployment, spending or
signature is authorized.

## Completed development increment: 0107 — complete lifecycle counterexample

The final R5 reproduction now runs through the complete same-class failed-run
lifecycle graph. The old graph/event disagreement is preserved; a schema-valid
terminal event and full history reach the simulated 90-day boundary with both
copy paths and a separate human/action/provider tombstone path. Event omissions,
current/prior proof corruption, policy/history drift, active hold and every action
proof omission deny. Its 64 observations count once, not as matrix coverage.

Five new groups and final full checks pass: 344 root controls and 88 prototype
tests. Fresh quick execution matches 311 passed / 3,725 uncovered; full matches
327 passed / 3,709 uncovered, both with zero failures. The separate three-group
full integration rerun again consumed the matrix and matched the full snapshot.
See intent/0107/EVIDENCE.md for synthetic/cached limits. The September-to-December
clock is simulated, not a real retention observation or deletion.

All nine R5 reproductions now have mapped development executions, but all five
formal findings remain open. Next under intent/0107/PLAN.md are 94 lifecycle graph
cases, 3,614 migration cases and one obsolete schema case. Do not credit unsupported
classes/dimensions through generic rejection or alias distinct migration interleavings.
GAP-01–06 and M1–M8 remain separate. No protected edit, provider mutation, cleanup,
release, deployment, spending or signature is authorized.

## Completed development increment: 0108 — ordinary lifecycle negatives

The source map reconciles all 30 frozen lifecycle negative IDs. Twenty-seven now
execute a complete failed-run positive and a distinct adapted negative. Valid
chronological active holds retain; conflicting evidence blocks. Signed semantic
failures, old-inventory races, cross-copy transplants and registry injection are
explicitly distinguished. Raw/reference cases remain uncovered pending complete
controls; an obsolete-field rejection does not supply their semantic evidence.

Six new groups and final full checks pass: 350 root controls and 88 prototype
tests. Fresh quick execution matches 338 passed / 3,698 uncovered; full matches
354 passed / 3,682 uncovered, both with zero failures. A separate three-group full
integration process reran the matrix and matched the full snapshot. See
intent/0108/EVIDENCE.md and SOURCE-MAP.json for source/synthetic/cached limits.
No formal finding is closed and no lifecycle/provider effect is executed.

Next under intent/0108/PLAN.md are the three raw/reference lifecycle negatives,
64 class/boundary rows, 3,614 migration cases and one obsolete schema case.
GAP-01–06 and M1–M8 remain separate. No protected edit, provider mutation, cleanup,
release, deployment, spending or signature is authorized.

## Completed development increment: 0109 — raw and reference lifecycle negatives

The three remaining lifecycle negative IDs now execute full positive, replay and
safe failure controls. Raw-v2 binds a preterminal grant, all three temporary copies,
the winning batch and separate tombstone. Current-v5 reference evidence retains
original historical bytes/keys and binds fresh synthetic qualified proofs, exact
removal receipts and the named tombstone. Missing references retain; missing or
malformed raw grants block. SOURCE-MAP.json explicitly promotes the frozen malformed
authority-array shape from its irrelevant failed-run field into the actual raw schema.

Five new groups and final full checks pass: 355 root controls and 88 prototype
tests. Fresh quick execution matches 341 passed / 3,695 uncovered; full matches
357 passed / 3,679 uncovered, both with zero failures. A separate three-group full
integration process reran the matrix and matched the full snapshot. See
intent/0109/EVIDENCE.md for synthetic/cached limits. All 30 lifecycle negatives are
mapped; none of the five formal findings is closed and no provider action occurred.

Next under intent/0109/PLAN.md are 64 class/boundary rows, 3,614 migration cases and
one obsolete schema case. Preserve real coordinate differences and implement
unsupported class/key-era combinations; generic rejection is not boundary evidence.
GAP-01–06 and M1–M8 remain separate. No protected edit, provider mutation, cleanup,
release, deployment, spending or signature is authorized.

## Completed development increment: 0110 — short-retention boundaries

Eight exact before/complete coordinates now map for failed runs, raw analytics,
derived text and exports. Source trigger dates, fifteen-day parent caps and exact
minus-one/plus-six-second observations are preserved. Fresh before-expiry state
yields scheduled without accepting premature disposition evidence. Each hook
separately runs full complete/replay controls, with both copies and the separate
tombstone. Ordered 100 ms proofs fit the complete observation without changing
original key windows. Missing state, complete receipt or required parent cap denies.

Six new groups and final full checks pass: 361 root controls and 88 prototype tests.
Fresh quick execution matches 349 passed / 3,687 uncovered; full matches 365 passed /
3,671 uncovered, both with zero failures. The separate three-group full integration
process reran the matrix and matched the full snapshot. See intent/0110/EVIDENCE.md
and SOURCE-MAP.json for exact scope and synthetic/cached limits. All five formal
findings remain open; no retention period elapsed and no provider effect occurred.

Next under intent/0110/PLAN.md are the existing supported long-retention and
reference profiles, with exact source times and current proofs. In total 56 lifecycle
boundaries, 3,614 migration cases and one obsolete schema case remain unmapped.
Pending-state coordinates require actual semantics, not generic rejection. GAP-01–06
and M1–M8 remain separate; no protected edit, provider mutation, cleanup, deployment,
release, spending or signature is authorized. The continuation loop remains active.

## Completed development increment: 0111 — long-retention boundaries

Ten exact before/complete coordinates now map for security audit, corpus baseline,
decision proof, legal signed log and referenced evidence. Existing current-v4/v5
profiles preserve original 2026 event bytes and all per-domain key windows while
fresh synthetic archive/state/human/action/provider proofs fit the exact source
minus-one/plus-six-second observations. References bind removal receipts and a named
tombstone. Missing history/state/complete receipts deny; absent complete reference
evidence retains. Before scheduling does not imply disposition evidence acceptance.

Six new groups and final full checks pass: 367 root controls and 88 prototype tests.
Fresh quick execution matches 359 passed / 3,677 uncovered; full matches 375 passed /
3,661 uncovered, both with zero failures. A separate three-group full integration
process reran the matrix and matched the full snapshot. See intent/0111/EVIDENCE.md
and SOURCE-MAP.json for exact scope and synthetic/cached limits. An incorrect test
assumption about universal 2027 key expiry was corrected to preserve the provider
anchors' actual 2040 windows; no verifier or key policy was relaxed.

Eighteen lifecycle boundaries are now mapped; forty-six remain. Next under
intent/0111/PLAN.md is a separate read-only waiting/eligible-pending result for the
nine supported classes at exact at/+1-second observations. It must validate fresh
head evidence, keep full disposition checks intact, and never claim quarantine,
deletion or execution authority. The seven other classes, 3,614 migration cases,
one obsolete schema case, GAP-01–06 and M1–M8 remain separate work. All five formal
findings stay open. No protected edit, provider mutation, cleanup, deployment,
release, spending or signature is authorized. The continuation loop remains active.

## Completed development increment: 0112 — read-only lifecycle readiness

A separate closed head-only surface now reports waiting-retention or age-eligible,
pending complete disposition evidence. It shares the verified event/history/
inventory/state/retention prefix and adds pinned target/policy and known provider
selectors. It always reports zero effects and false execution, disposition,
quarantine, deletion and reference-clearance flags. Held/reference-active state
conservatively retains. Full human/action/provider/aggregate/tombstone verification
remains a distinct unchanged completion path; the two formats cannot be interchanged.

Eighteen exact at/after coordinates now map for the nine already supported classes,
using available head evidence without future receipts. Tests verify genuinely signed
stale/future/unbound-provider snapshots fail, exact nanosecond boundaries hold, and
observation hashes bind the evaluation time. All 359 prior mapped quick observation
seals/counts/outcomes remain byte-for-byte unchanged despite implementation changes.

Eight new groups and final full checks pass: 375 root controls and 88 prototype tests.
Fresh quick execution matches 377 passed / 3,659 uncovered; full matches 393 passed /
3,643 uncovered, both with zero failures. A separate three-group full integration
process reran the matrix and matched the full snapshot. See intent/0112/EVIDENCE.md
and SOURCE-MAP.json for the pending/quarantine reconciliation and synthetic/cached
limits. No real quarantine or deletion is performed or proved by this candidate.

Next under intent/0112/PLAN.md are 28 lifecycle coordinates for seven other classes,
then remaining migration/schema and GAP-01–06/M1–M8 work. Raw deadlines, indefinite/
immediate timing and unsupported future profiles need distinct treatment. This
readiness surface is not a live API, approval or mutation capability. All five
formal findings stay open. No protected edit, provider operation, deletion,
deployment, release, spending or signature is authorized. The loop remains active.

## Completed development increment: 0113 — indefinite-retention safeguards

Four frozen authoritative-artifact labels explicitly alias one commit-time input,
not four expiry instants. The closed adapter supplies available signed event,
inventory and state evidence with empty effect slots. Indefinite retention returns
retained-immutable with a null expiry and zero effects. Held state and injected
disposition records cannot make it deletable; the latter are not accepted or
validated as legitimate actions. Missing evidence, genuinely signed semantic errors,
invented expiry and invalid nested provider proof deny. Complete verifiers and the
readiness class admission remain unchanged.

Twenty focused groups pass, including six new groups. Full repository checks pass
381 root controls, prototype checks and 95 kit artifacts; unchanged package tasks
are cached. Fresh reports match 381 passed / 3,655 uncovered (quick) and 397 passed /
3,639 uncovered (full), with zero failures. A separate three-group integration run
re-executes the full synthetic matrix and matches its snapshot. See
intent/0113/EVIDENCE.md and SOURCE-MAP.json for alias and synthetic-evidence limits.

Next are twenty-four lifecycle coordinates across six classes, then remaining
migration/schema and GAP-01–06/M1–M8 work as recorded in intent/0113/PLAN.md.
Raw deadlines, immediate triggers and future retention profiles need distinct
semantics; no real immutable-store guarantee follows from these development tests.
All five formal findings remain open. No protected edit, real provider operation,
deletion, gate approval, deployment, release or spending is authorized.

## Completed development increment: 0114 — raw-corpus maximum deadline

Four raw-corpus source observations now execute complete early/replay proof graphs
at exactly terminal +59/+60/+61/+66 seconds. The signed sixty-second receipt limit
is a maximum deadline, not a minimum wait. A separately paired completed audit
accepts a receipt at exactly +60 seconds and rejects genuine signed +1ns/+1s late
receipts. Aggregate/tombstone hashes are rebuilt and correctly ordered; earlier
observations cannot consume their future evidence. Missing/expired grants and
incomplete graphs deny; held/reference-active state conservatively retains.

Twelve focused groups pass, including six new groups. All 381 prior mapped
observation seals/counts/outcomes remain unchanged. Fresh quick execution matches
385 passed / 3,651 uncovered; full matches 401 passed / 3,635 uncovered, with zero
failures. Separate full integration passes three groups. An initial repository run
found six stale family-count assertions; after correcting those expectations, the
full rerun passes 387 root controls and 88 prototype tests, plus 95 kit artifacts,
scope audit, typechecks and builds. Unchanged package tasks are cached. See
intent/0114/EVIDENCE.md and SOURCE-MAP.json for exact timing and evidence limits.

Twenty lifecycle coordinates remain across five classes, alongside 3,614 migration
and one obsolete schema case. The next immediate-trigger design constraints are
recorded in intent/0114/PLAN.md: available pre-trigger history, separate read-only
pending states, earliest-event selection and unchanged complete proof checks.
Raw terminal/grant variants, live stores/races, GAP-01–06 and M1–M8 remain separate
work. No actual erasure, quarantine or publication is claimed. All five formal
findings remain open; no protected edit, provider operation, deletion, gate,
release, deployment or spending is authorized. The implementation loop stays active.

## Completed development increment: 0115 — immediate lifecycle readiness

A separately pinned original-era RC-REBUILDABLE head-only profile now reports
waiting-for-trigger with null expiry when available complete signed history has
no supersession/rebuild event. After an observed event, the earliest qualifying
trigger yields pending disposition. Both trigger orderings are verified. Future
events at +1ns, stale/future/incomplete heads, missing/corrupt proofs, unbound
providers, wrong pins and cross-format inputs deny. Held/reference-active state
never conveys mutation or clearance authority.

Full +6-second two-copy disposition and committed replay remain separate; missing
receipts still block completion. Complete factories cannot select the read-only
mode through extra arguments. Every prior mapped observation seal/count/outcome
remains unchanged despite the shared implementation extension. Twenty-two focused
groups pass, including eight new groups. Final repository checks pass 395 root
controls, prototype tests, kit/security/typecheck/build checks; unchanged package
tasks are cached. A separate full integration process passes all three groups.

Fresh quick execution matches 389 passed / 3,647 uncovered; full matches 405 passed /
3,631 uncovered, both zero failures. See intent/0115/EVIDENCE.md and SOURCE-MAP.json
for exact pre-trigger/source reconciliation and synthetic-evidence limits.

Sixteen lifecycle coordinates remain across four future-retention classes, plus
3,614 migration and one obsolete schema case. Next under intent/0115/PLAN.md are
explicit current-era profiles with actual environment-retirement, final-tombstone,
complete derived inventory and sanitized key/residual-copy erasure semantics.
This is not a live projection, deletion transaction or quarantine service. All five
formal findings, normative/live work, GAP-01–06, independent/protected review and
M1–M8 remain open. No protected edit, provider operation, deletion, signature,
release, deployment or spending is authorized. The loop remains active.

## Completed development increment: 0116 — release-record retention profile

A release-only current-v6 profile binds a non-null named environment and exact
retirement event, release-rails record, provider record, actor and time. Complete
archived event proof must establish a release-rails commit with traffic disabled
and credentials revoked. Authentic but semantically wrong retirement records deny;
other future classes remain inadmissible. Original history/key material/windows
and fresh qualified/current proof separation remain intact.

Four source observations now map: seven-year waiting before expiry, read-only
pending disposition at/after it, and full current two-copy +6s disposition/replay.
Readiness never supplies deletion or clearance authority. All 389 prior mapped
observation seals/counts/outcomes remain unchanged. Twenty-two focused groups pass,
including eight new groups; the separate three-group full integration run passes.
One historical source-layout assertion failed on the initial repository run; its
v1–v5 fallback check was updated while preserving the original inventory, and all
five targeted inventory groups pass. Final repository checks pass 403 root controls,
prototype tests, 95 kit artifacts, scope/typecheck/build checks. Unchanged package
tasks are cached; see intent/0116/EVIDENCE.md for the failed attempt and final result.

Fresh quick execution matches 393 passed / 3,643 uncovered; full matches 409 passed /
3,627 uncovered, with zero failures. SOURCE-MAP.json discloses the named synthetic
environment/retirement selectors absent from the legacy fixture and the exact
historical/current proof boundaries. No actual retirement or deletion is claimed.

Twelve lifecycle coordinates remain across deletion evidence, provenance and
sanitized corpus, plus 3,614 migration and one obsolete schema case. Next under
intent/0116/PLAN.md is provenance's compound manifest/completion rule; its existing
receipt-digest-only limitation must be resolved before claiming complete disposition.
All five formal findings, normative/live work, GAP-01–06, independent/protected
review and M1–M8 remain open. No protected edit, provider operation, deletion,
signature, release, deployment or spending is authorized. The loop remains active.

## Completed development increment: 0117 — retained derived-child evidence

A fact-only original-era component now verifies actual aggregate receipt bytes
and full child disposition graphs against their exact parent deletion events.
It checks each copy, human authority, protected action, provider receipt and final
tombstone, and requires tombstone completion before the named parent event.
Signed wrong parent/class/source/chronology denies. Missing/digest-only/partial/
borrowed evidence denies, as does sharing physical objects or one-use credentials
across otherwise independently valid child graphs.

Eight new groups and eight prior release-profile groups pass. Repository checks
pass 411 root controls, 88 prototype tests, 95 kit artifacts, security/typecheck/
build checks; unchanged package tasks are cached. The separate three-group full
integration run passes. All 393 quick and 409 full prior mapped observation seals,
counts and outcomes are unchanged. Fresh reports remain quick 393 passed / 3,643
uncovered and full 409 passed / 3,627 uncovered, both zero failures.

This component has no ledger hook and adds no case credit. See intent/0117/EVIDENCE.md
and PLAN.md. Next is complete parent manifest/history binding and fresh future
archive revalidation of these exact child evidence bytes before admitting a future
provenance profile. The component cannot turn original-era proof into future trust.
Twelve lifecycle, 3,614 migration and one schema coordinate remain unmapped. All
five formal R5 findings, normative/live integration and independent/protected
review remain open. No provider operation, actual deletion, gate signature,
release, deployment or spending is authorized. The implementation loop stays active.

## Completed development increment: 0118 — archived derived-child evidence

A separately pinned fact-only archive component now revalidates exact retained
0117 child proofs at their trusted original observation, then requires fresh
independent current revalidation and retention witnesses. Original key identities
and windows cannot change. The conservative first profile rejects every known
original-key revocation, including unused domains, at its exact instant; it does
not claim minimal revocation impact. Current witness keys must be distinct across
roles and eras and valid now. Neither historical facts nor archived approvals
become current parent disposition authority.

Synthetic one-, three- and seven-year audits and replay pass. Correct fresh
signatures cannot cover incomplete original child proof or wrong archive/result/
receipt semantics. All 18 original-domain revocations, a one-nanosecond boundary,
current-key revocation, original-key witness reuse, closure and byte limits are
tested. Twenty-five focused groups pass, including nine new groups. Repository
checks pass 420 root controls, 88 prototype tests, 95 kit artifacts and security/
typecheck/build checks; unchanged package tasks are cached. Separate full integration
passes three groups. See intent/0118/EVIDENCE.md for commands and precise limits.

No ledger hook or source mapping changes: fresh quick/full execution still matches
the existing intent/0117 snapshots exactly (393/409 passed, zero failures;
3,643/3,627 uncovered). This component receives no catalog credit. Next under
intent/0118/PLAN.md is full parent manifest/history binding, explicit complete-empty
handling and a dedicated future provenance profile with fresh retained evidence
before current state. Current-v7 is not yet implemented. Twelve lifecycle,
3,614 migration and one schema coordinate remain unmapped. All five formal R5
findings, normative/live integration and independent/protected review remain open.
No user-only blocker is present for the next local composition step; provider
operations, deletion, signatures, release, deployment and spending remain gated.
The implementation loop stays active.

## Completed development increment: 0119 — parent provenance manifest/history

A fact-only composition now joins complete qualified hold history, exact archived
child proofs and fresh authoritative manifest/head assertions. Each manifest child
must match one exact retained deletion event and receipt digest; missing, orphan,
duplicate, reordered and substituted children deny. An explicit complete-empty
configuration still requires complete signed manifest/history and cannot hide
deletions or absent evidence. Retained parent/owner/child archives precede manifest
and head. Both fresh records sign the exact context and profile policy digest.

Retirement-before-final-deletion and retirement-after-all-children controls select
the later event plus seven years; a later item closure cannot substitute. This is
only boundaryCandidateAt. Source review confirmed that corpus retirement requires
a qualified records-owner decision, while existing 0082/0084 owner profiles cover
hold decisions only. retirementAuthorityVerified remains false and retentionEligible
is absent. No current-v7 admission or catalog hook is added.

All 25 focused groups pass, including eight new groups. After signed-policy
hardening, final repository checks pass 428 root controls, 88 prototype tests,
95 kit artifacts and security/typecheck/build checks; unchanged package tasks are
cached. The final separate full integration run passes three groups. Fresh quick
and full execution match unchanged intent/0117 snapshots exactly (393/409 passed,
zero failures; 3,643/3,627 uncovered). No new case credit is claimed.

Next under intent/0119/PLAN.md is a complete non-erasure qualified retirement proof
and its original/current archive binding. Only then admit future parent readiness/
full disposition with copies/actions/aggregate/tombstone and qualified holds intact.
The plan records the existing 0119-to-0080 dependency path so integration does not
introduce a static cycle or drop required verification. This local prerequisite is
unblocked and does not request a human signature. Twelve lifecycle, 3,614 migration
and one schema coordinate, all five formal R5 findings, normative/live integrations
and independent/protected review remain open. Provider operations, actual deletion,
gate signatures, release, deployment and spending stay gated. The loop stays active.

## Completed development increment: 0120 — qualified retirement decision evidence

A distinct non-erasure retirement authority schema/profile now uses all nine human
supporting records and exact corpus/event/parent/predecessor/history-head binding.
The head and human conditions bind the profile policy. History/CAS/replay snapshots
must precede decision, and the winning reservation must precede retirement commit.
Wrong semantic bindings deny even when the full human proof and event signatures
individually pass. Identity, qualification, assignment, replay or CAS failure denies.
Existing hold/reference/disposition profiles and mapped observations stay unchanged.

Original and fresh-current decisions, empty prefix and truthful active/released
hold metadata pass with zero effects. retirementAuthorityVerified describes that
explicit observation only: futureArchiveVerified and qualifiedPriorHistoryVerified
remain false. This does not authorize retirement, erase held data, qualify prior
hold decisions, validate a later archive or admit current-v7 lifecycle completion.

All 41 focused groups pass, including nine new groups. The first repository attempt
had one CLI subprocess timeout during overlapping heavy checks (436/437 passed).
The unchanged CLI test then passed in isolation; the final repository rerun without
extra verification overlap passes all 437 root controls, 88 prototype tests, 95 kit
artifacts and security/typecheck/build checks. No timeout or assertion was relaxed.
Unchanged package tasks are cached. Separate full integration passes three groups.
See intent/0120/EVIDENCE.md for the failed attempt, commands and final outcomes.

Fresh 0120 reports preserve all 393 quick/409 full prior observation hashes, counts
and outcomes: zero failures; 3,643/3,627 uncovered. Shared human/schema source
fingerprints change but no catalog hook or case credit is added. Next under
intent/0120/PLAN.md is exact retained retirement-decision revalidation with fresh
independent current witnesses, then qualified parent/lifecycle composition. The
local archive prerequisite is unblocked. Twelve lifecycle, 3,614 migration and one
schema coordinate, all five formal R5 findings and normative/live/independent/
protected review remain open. Provider operations, actual retirement/deletion,
signatures, release, deployment and spending remain gated. The loop stays active.

## Completed development increment: 0121 — first-journey Brief preview

At the safe boundary after 0120, the first usable journey became the explicit
development priority. `docs/FIRST-USABLE-DELIVERY.md` now separates audited code,
remaining work, engineering ranges and independent/gate/provider waiting time.
Its 68–132 focused-hour envelope is for the bounded journey only, not complete
Phase 1, all R5 remediation, release readiness or elapsed calendar delivery.

The shared registry now exposes `intent.brief.preview`: a bounded, explicitly
granted human-only query using the existing template, exact content SHA-256 and
missing-field output. Current identity and grants are checked before and after
computation. All responses remain unsaved, unconfirmed and non-authorizing.
HTTP/MCP parity is verified; no model or provider is used and no UI is claimed.

Verification: 54 registry groups, five MCP groups and full `pnpm check` pass,
including 437 root controls and 88 prototype tests. See `intent/0121/EVIDENCE.md`
for commands, cache boundaries and limitations. Protected artifacts are unchanged.
No R5 catalog credit is added. Five formal findings remain open.

Next is the production authoring/correction UI with browser/keyboard verification,
estimated 4–8 focused engineering hours within the authoring work package. The demo
must show missing facts and unsaved draft correction, not fabricated Git success.
Retirement archival work remains in 0120/PLAN; prioritization is not signed scope
deferral. The active loop follows this journey order without another generic
continue. Live writes, provider access changes, gate signatures and release remain
separately gated; no new human-only blocker exists for local UI development.

## Completed development increment: 0122 — guided authoring/correction UI

The production authenticated workspace now exposes one question at a time, prior
answer correction and an inert rendered Brief through the 0121 tool. It preserves
pink/orange design tokens, checks exact response identity/content fingerprints and
clears stale or private unsaved state on edits, denial, navigation and expiry.
No model, save, confirmation or signature is enabled. This follows the signed
interview direction but does not complete model-backed/scoped-agent authoring.

All 39 isolated browser integration checks pass with actual Next.js, Chromium,
Keycloak, encrypted PostgreSQL sessions and local Git grants. The run covers new
keyboard/correction, revocation and expiry behavior, mobile overflow and automated
accessibility checks. Visual evidence is retained under `intent/0122/browser`.
Two failed attempts exposed a duplicate DOM ID; a later failure exposed test-only
axe state lost on reload. Both are corrected without relaxed assertions. See the
full history and boundaries in `intent/0122/EVIDENCE.md`.

Final `pnpm check` passes all 437 root controls, 88 prototype tests, package tests,
typechecks and builds. No protected source or R5 mapping changed. All five formal
findings remain open. The first local guided-preview demo is now development-
verified; real membership, the model conversation and the five-step journey are not.

Next: exact-content confirmation and disabled save/idempotency/CAS orchestration,
then the Git write adapter with action-time authorization. The existing loop stays
active. No new user-only input is needed for that local contract work. Live writes,
new provider permissions, gate signatures, deployment and spending stay gated.
Outstanding archival/provenance work remains in 0120/PLAN; no signed requirement
or acceptance finding has been deferred or waived by this execution priority.

## Completed development increment: 0123 — exact confirmation/save boundary

The shared registry now separates human exact-content acceptance, one create-only
dispatch and operation readback. Save requires preview/save/status grants, canonical
`items/NNNN-slug/BRIEF.md`, exact expected head, regenerated template/content digest,
actor/key binding and current trusted-adapter write/Gate 2 authority. No existing
artifact or operation marker may be overwritten. Unknown and post-dispatch failures
require original-key readback, never a blind retry/new key or a false rollback claim.

This is a coordinator and explicit port contract, not an actual GitHub writer or
full source-verification adapter. Both remain absent from runtime; HTTP/MCP reject
save/readback as unavailable without them. Synthetic CAS/marker tests are not live
atomicity, durability, current provider approval or independent Gate 2 evidence.
The profile requires co-located Git authority at the expected head; other sources
need explicit future composition. Canonical-path library support is also missing.

Verification passes 67 registry groups, six MCP groups and full `pnpm check`,
including all 437 root controls and 88 prototype tests. An initial native TypeScript
parameter-property failure was corrected without transpiler/runtime changes. See
`intent/0123/EVIDENCE.md` for checks and limits. No protected files, runtime access,
UI or R5 mapping changed, and all five formal findings remain open.

Next under 0123/PLAN: real writer adapter with isolated provider/Git tests, full
verified write-authority composition, canonical-path discovery, then confirmation/
readback UI and board projection. Agent conversation/context remains unfinished.
The active loop can continue local adapter development without user-only input.
Real write scope, Gate 2 approval, deployment, release and spending remain separately
gated. Remaining signed scope and 0120 archival obligations are not waived.

## Completed development increment: 0124 — GitHub create/readback storage

Implements the provider storage primitive for the 0123 contract. It uses a scoped
installation token, exact-head GraphQL mutation and two atomic additions: Brief
plus durable operation marker. Native Git-backed synthetic provider tests cover
restart, duplicates, races, lost acknowledgements, scope/authority denial, path
history, exact readback, unexpected changes and resource limits. It does not use
the real App key, invoke live writes or alter repository permissions/protection.

Fifteen focused groups, adapter typecheck and full `pnpm check` pass, including all
437 root controls and 88 prototype tests; see `intent/0124/EVIDENCE.md`. The adapter is not wired
into production and cannot replace full source-verified membership/Gate 2 evidence.
The first history profile is limited to 100 linear commits and fails closed for
older/nonlinear histories; broader lookup and append-only protection proof remain
required. No test count is a live-provider or gate-completion claim.

Next: full trusted writer/authority composition, canonical-path discovery, exact
confirmation/status UI, board ingestion and revision-bound review. Agent conversation
and trusted systems context remain open. The existing loop continues safe local
development; all five R5 findings, signed scope and 0120 archival work remain due.

## Completed development increment: 0125 — canonical Brief discovery

Canonical `items/NNNN-slug/BRIEF.md` paths now share a single portable definition
across creation and curated reading. Existing root/numbered Briefs remain readable,
but are not writable through the create-only contract. Data catalog key selection,
HTTP/MCP and browser links inherit canonical recognition without wider curation,
grants or authority. The synthetic browser fixture uses the actual new path layout.

All 39 isolated browser checks pass against the canonical local Git fixture,
including actual projection replay/repair, library access and exact-revision links.
Thirty-three focused checks pass. Full verification and the corrected test-harness
assumptions are recorded in 0125/EVIDENCE; screenshots retain desktop/mobile proof.
The final full repository check also passes all 437 root controls, 88 prototype
tests and package/typecheck/build tasks after the fixture correction.
No real save, production migration, membership or provider access changes. Next:
full trusted writer/source-authority composition, historical lookup, confirmation/
status UI and board ingestion. All five R5 findings and signed obligations remain.

## Completed development increment: 0126 — exact-head human membership

Adds the source-verified membership prerequisite for the pending trusted writer.
Current authenticated issuer/session/grants must match the exact Git authorization
document at the proposed head. Scope, both source hashes, expiry and head stability
are checked. Nine focused groups pass, including real timeout/backpressure behavior.
Final `pnpm check` passes all 437 root controls, 85 adapter tests, 88 prototype
tests and package/typecheck/build tasks. Two prior full runs hit the unchanged
report CLI deadline; capping control-file concurrency at four resolves contention
without changing the deadline, assertions or coverage. The complete history is
recorded in `intent/0126/EVIDENCE.md`.

The new observation explicitly is not Gate 2 or write authority. The existing gate
observer and normalized policy evaluator are also insufficient: full provider-backed
gate proof and session/bearer composition remain unfinished. Neither runtime nor
real App access is changed. Continue that local composition route, then save/status
UI and board integration, retaining all five R5 findings and signed obligations.

## Completed development increment: 0127 — verified authentication context

The actual OIDC verifier and browser broker now retain internal issuer, credential
issuance/session creation and exact binding metadata. Principal-only methods keep
the public shape unchanged. Membership compares exact binding as well as time,
and tests compose signed-token/broker verification with the Git membership path.
Thirty-four focused adapter and eleven browser API checks pass. Full repository
verification passes, including 437 root controls and 89 adapter tests, followed by
39 isolated browser integration checks. See 0127/EVIDENCE for exact scope and limits.

No public metadata, token, cookie, persistence change or write activation is added.
Token issuance and local session creation are not qualified human gate approval or
second-look proof. Next remains full gate/provider/source verification and the
request-bound writer, then save/status UI and board integration. All five R5 findings,
signed Phase 1 obligations and 0124/0120 prerequisites remain open.

## Completed development increment: 0128 — exact gate-source collection

The read-only gate observer now retains immutable original record and artifact
snapshots for the pending full verifier, requiring the expected source head and
decision digest. Shared source validation, agent authorization and shutdown are
preserved; legacy observations still return their three prior fields. Collection
rejects absent/stale/changed sources, malformed UTF-8, corrupted digests and expiry
during final head read. The focused ten-case suite includes actual GitHub-reader
composition through synthetic read-only HTTP responses. Full repository verification
passes, including 437 root controls, 95 adapter tests and 72 API tests. Exact scope
and limitations are recorded in `intent/0128/EVIDENCE.md`.

Matching send-back records remain collectible, explicitly with no gate or write
authority. Provider identity/qualified hats, policy/prerequisite/Critic/domain
proof and request-bound writer composition are still required. No canonical
provider binding, human signature, protected document or runtime activation changes.
All five R5 findings, signed obligations and 0124/0120 prerequisites remain open.

## Completed development increment: 0129 — exact gate chronology

Three reproduced regression groups exposed millisecond rounding in the production
normalized gate-policy evaluator: false acceptance of future signature/authentication
and false rejection of an ordered nanosecond second look. A portable exact UTC
parser now validates all timestamp fields and integer comparisons preserve the
existing ordering/session rules. Invalid calendars and excess precision deny.
The focused set passes 16 groups, including five new policy and three domain
groups. Full repository verification passes, including 437 root controls and all
package test/typecheck/build tasks; see `intent/0129/EVIDENCE.md`.

This is a development correction required before authority composition, not an
independent R5 closure, human second-look proof or approval. Full source/provider
verification, writer/UI/board integration and all prior signed/gate/provider
boundaries remain unchanged. The five R5 findings and 0124/0120 work remain open.

## Completed development increment: 0130 — provider-attested gate evidence

Adds a read-only Ed25519 verifier for exact source-bound provider claims under a
selected trust snapshot. It rejects tampering, cross-scope/session/revision replay,
agent/qualification injection, ambiguous serialization and expired/revoked keys.
Chronology retains nanoseconds. Returned immutable evidence requires current source
and qualification verification and grants no gate/write authority. Tests use actual
ephemeral signatures and synthetic Git-source composition. The 19-case focused
set and full repository checks pass, including 437 root controls and 104 adapter
tests. See `intent/0130/EVIDENCE.md` for exact scope and limits.

No production key, proof retrieval adapter, provider selection, signature, protected
record or runtime writer is installed. The existing openai-codex Gate 1 remains
unchanged and is not upgraded into this signed-envelope format. Full trusted-source,
human/qualified-hat, policy/Critic/domain and request-bound writer composition still
precede live saving. All five R5 findings, 0124/0120 and signed obligations remain.

## Completed development increment: 0131 — read-through provider proof sources

The signature verifier now has an authenticated read-through Git composition for
configured trust/proof files. Exact source head, allowlisted paths, SHA-256/blob
hashes, UTF-8/canonical/size bounds and fresh agent checks precede the immutable
observation. No cached source can survive a changed trust pin or revoked key.
Single-flight, a real 15-second timeout and draining shutdown bound owned work.
The 17-case focused set and final full repository checks pass, including 112
adapter tests. Verification and synthetic-source limits are recorded in
`intent/0131/EVIDENCE.md`.

Git key existence is not authorized trust-root selection. The current production
provider-recorded Gate 1 is not converted or replaced. Actual applicable provider
evidence, full human/qualification/policy/Critic/domain proof and the writer remain
unfinished. No runtime binding, gate, write scope or production evidence is enabled.
All five R5 findings, 0124/0120 and signed Phase 1 obligations remain open.

## Completed development increment: 0132 — request-bound GitHub Brief writer

Connects the shared writer contract to the actual GitHub store under repeated
current-human, exact-session and grant checks. Full authority must be supplied by
a trusted verifier and is evaluated again after write-token issuance. Status-only
access, exact-head creation, duplicate recovery, deadlines and post-dispatch
uncertainty preserve the storage contract. The focused set passes 29 groups,
including the actual registry preview/confirmation/save/status path into disposable
native Git. Full repository verification passes, including 437 root controls,
126 adapter tests and all package typechecks/tests/builds. See
`intent/0132/EVIDENCE.md` for synthetic-dependency and runtime limits.

The full current/historical human, qualification, provider and gate verifier is
still missing; a valid-looking callback result is not production evidence. No
runtime writer, live GitHub scope or UI save control is enabled. Next are full
authority and request-service binding, save/status UI, board, decision review and
the combined journey. All five R5 findings, 0124/0120 and signed obligations remain.

## Completed development increment: 0133 — bounded current-authority observations

Two reproduced regressions returned observations after a partial clock rollback.
Membership and gate-source collection now enforce last-observation monotonic time.
Gate collection additionally bounds the caller at fifteen seconds, retains owned
work after timeout, denies overlap/late continuation and preserves draining
shutdown. The focused set passes 24 groups, including the original 19 and five
new clock/lifecycle groups; both original failing cases now pass. Full checks pass,
including 437 root controls, 131 adapter tests and all package typecheck/test/build
tasks. See `intent/0133/EVIDENCE.md` for before/after evidence and remaining limits.

No full source/human/qualification/provider/gate authority or live save is enabled.
Continue that composition, trusted runtime binding and the save/board/decision
journey. All five R5 findings, independent review, protected artifacts, existing
provider approvals, 0124/0120 and signed Phase 1 obligations remain unchanged.

## Completed development increment: 0134 — per-request writer service lifecycle

Adds lazy writer factories after shared human/input authorization, with independent
invocation ownership and awaited cleanup. HTTP/MCP bind them to each request;
browser and Git-backed transports supply fresh verified context. Writer-enabled
service shutdown drains requests before shared resources. Focused suites pass
17 common save groups and 30 API/session/transport groups, including eight new
groups with signed test tokens and native-Git grant revocation. Full repository
checks pass (437 root controls, 76 API, 81 registry and 131 adapter tests, all
typechecks/builds); all 39 existing isolated browser checks pass. Factory tests and
default-runtime browser regression are distinct; see `intent/0134/EVIDENCE.md`.

This prepares closed integration while the full authority verifier remains missing.
No runtime profile, provider scope, save UI or gate record is enabled or changed.
Next are complete authority and actual runtime binding, then save/status UI,
authenticated board and revision-bound review. All five R5 findings, 0124/0120,
independent review, human decisions and signed Phase 1 requirements remain due.

## Completed development increment: 0135 — Git-membership-backed writer factory

The actual membership verifier and GitHub reader now surround full gate verification
inside a managed per-request writer factory. Source/head/session continuity and
gate/member validity caps are enforced independently of a plausible callback result.
Focused factory tests pass 9 groups; three HTTP/MCP cases exercise real confirmed
storage into disposable Git and exact status/retry recovery, including lost ack.
Full repository verification passes, including 437 root controls, 140 adapter and
79 API tests, plus all package typechecks/builds. See `intent/0135/EVIDENCE.md`.

Full source/historical human/qualification/provider/policy gate verification remains
an unfinished mandatory dependency. No production factory, runtime profile, GitHub
write scope or gate decision is enabled. Complete that verifier and approved runtime
binding, then the save/status UI, board and revision-bound review. Preserve all five
R5 findings, 0124/0120, independent protected review and signed Phase 1 obligations.

## Completed development increment: 0136 — Historical and current gate-signer hats

The signed provider-source reader now has an explicit signer mode which verifies
historical grant bytes against the provider-attested digest, exact authentication/
signing windows, and current human-hat validity at the expected Git head. The
original provider-only mode stays distinct. Both share authenticated read scope,
source integrity checks, bounded single-flight ownership and draining shutdown.
Seventeen focused tests pass, including nine new groups and actual disposable Git
history/current-revocation coverage. Full repository verification passes: 437 root
controls, 149 adapter tests and all package checks/builds. Exact evidence and
fixture boundaries are recorded in `intent/0136/EVIDENCE.md`.

This does not establish identity/session evidence, specialist qualification,
uninterrupted authorization history or full gate policy. Existing commercial
provider compatibility remains due; no approval is converted or crypto-migrated.
Complete these authority dependencies, approved runtime binding, destination/head
discovery and save/status UI, then the board and revision-bound review. All five
R5 findings, 0124/0120, independent review and signed Phase 1 duties remain due.

## Completed development increment: 0137 — Source-backed signer identity assertions

A dedicated Git reader mode now verifies identity-service signatures bound by the
gate-provider proof's exact identity digest, issuer, human, session and timestamps.
It retains both actual hat-source checks and final head/agent/key/grant validity.
Focused suites pass 32 groups, including two real ephemeral signatures and native
Git history/revocation. Full repository verification passes: 437 root controls,
164 adapter tests and all package checks/builds. Exact evidence and limits are
recorded in `intent/0137/EVIDENCE.md`.

This is development-profile verification, not approved live identity attestation,
receipt issuance, specialist qualification or full gate authority. Existing
commercial signatures are not converted. Complete those bindings and qualified
policy/source prerequisites, then approved writer configuration, destination/head
discovery and save/status UI, board and decision review. All five R5 findings,
0124/0120, independent protected review and signed Phase 1 obligations remain due.

## Completed development increment: 0138 — Source-backed specialist qualification

Specialist-mode source verification joins scoped qualification assertions with
provider/identity proofs and historical/current human-role grants. It derives a
normalized specialist signature with only verified required domains. The actual
policy evaluator accepts this among sufficient synthetic remaining facts and rejects
missing qualification; source verification remains required. Native Git covers all
three proofs and later revocation. Focused suites pass 38 groups. Full repository
verification passes, including 177 adapter tests, root controls and all package
checks/builds. Exact evidence and limits are recorded in `intent/0138/EVIDENCE.md`.

No actual qualification authority, receipt issuer, existing commercial approval or
gate decision is enabled or converted. Complete whole-gate governed source/policy
composition and real approved bindings, then writer configuration, destination/head
discovery, save/status UI, board and decision review. All five R5 findings, 0124/0120,
independent protected review and signed Phase 1 obligations remain due.

## Completed development increment: 0139 — Canonical gate and complete signer set

The actual gate source collector now composes with every actual signer verifier,
matching the complete ordered canonical roster and collecting unchanged gate/artifact
sources again afterward. One actor/expiry/deadline envelope guards all reads and
drains pending work. Nine focused groups pass, including native Git, forged second
proofs and a real stalled read. A reproduced early ownership-release bug after
child timeout is corrected by closing/draining failed collections. Full checks
pass: 437 root controls, 186 adapter tests and all package checks/builds. Exact
verification timing and boundaries are recorded in `intent/0139/EVIDENCE.md`.

Full gate policy/prerequisite/Critic/domain sources, approved trust/fact selection,
simultaneous current signer validity and real attestor/commercial compatibility
remain unfinished. No gate or live writer is enabled. Complete those dependencies,
then approved runtime and destination/head/save UI, board and decision review.
All five R5 findings, 0124/0120 and signed Phase 1 requirements remain due.

## Completed development increment: 0140 — Common completion-time signer validity

A reproduced expiry gap is corrected: an earlier signer cannot expire during later
verification or final source recollection and still produce a successful set.
Actual key, current-role and qualification validity bounds are compared at one
completion instant with exact UTC arithmetic. Historical login expiry remains a
historical constraint, not a current-login requirement. Focused checks pass 44
groups and adapter typecheck; full checks pass 437 root controls, 189 adapter tests
and all package checks/builds. See `intent/0140/EVIDENCE.md` for the before/after
evidence and exact verification boundaries.

These bounds are not current-source leases or gate authority. Fresh source checks,
whole-gate policy/prerequisite/Critic/domain/build verification, governed pin
selection, real attestor bindings and commercial approval compatibility remain.
Then finish runtime/destination/head discovery, save/status UI, board and review.
All five R5 findings and the signed Phase 1 obligations remain due; no live writes,
release, deployment or spending is enabled.

## Completed development increment: 0141 — Source-backed gate policy chain

An internal collector joins actual signer verification with fixed exact-head policy,
Critic, build and domain/exception source reads across Gate 1 through the target.
The existing policy evaluator consumes source-derived digests and normalized facts.
A satisfied target cannot hide a failed prerequisite, and adverse or incomplete
evidence stays blocked. One actor/deadline/current-validity envelope covers all
children and owned work. Focused checks pass 21 groups. Full repository verification
passes 437 root controls, 198 adapter tests and all package checks/builds. Native Git
exercises an actual three-gate chain. Exact scope and limits are recorded in
`intent/0141/EVIDENCE.md`.

The new source profiles are development inputs, not automatic conversions or
replacements of current Critic/domain/human records. Governed selection and review
authenticity, real approved bindings and the full action-time authority verifier
remain required. No gate or writer is enabled. Continue those dependencies, then
runtime/destination/head discovery, save/status UI, board and decision review.
All five R5 findings and the signed Phase 1 requirements remain due.

## Completed development increment: 0142 — Native domain-review source fidelity

The policy collector now accepts explicitly selected native Gate 2 domain records
without rewriting original JSON. Normalization preserves findings, escalations and
confidence; every evidence link, including finding-only references, must match a
fixed allowlist and actual original-revision Git bytes. Tests exercise all 21
untouched repository records and an isolated native-Git policy chain. Focused suites
pass 20 groups; full repository checks pass, including 209 adapter tests and all
package checks/builds. Exact scope and limits are in `intent/0142/EVIDENCE.md`.

Reading these records does not authenticate their reviewers or approve their claims.
Native Critic/exception semantics, reviewer provenance, governed source selection,
real provider bindings and full action-time authority remain due before runtime
writer enablement. Continue those dependencies, then destination/head/save UI,
board and review. All five R5 findings and signed Phase 1 obligations remain open.

## Completed development increment: 0143 — Native exception-brief consolidation

Native exception sources now reconstruct every summary, finding and escalation from
the complete pinned domain record set, then feed source-derived links to gate policy.
Original source bytes remain unchanged. Tests include all three original bundles,
an isolated native-Git chain, inconsistent consolidations and pending/medium-confidence
semantics. Full repository verification passes, including 219 adapter tests and
all package checks/builds. An initially disallowed import was removed without
weakening the architecture check; details are in `intent/0143/EVIDENCE.md`.

Ready-for-Critic does not sign a gate. Native Critic semantics, verified reviewer
provenance, governed pin/Builder selection and actual authority bindings remain.
Then finish action-time verification, runtime/destination/head discovery, save/status
UI, board and decision review. All five R5 findings and signed Phase 1 obligations
remain due; no provider access, live write, release, deployment or spending is enabled.

## Completed development increment: 0144 — Native Critic HOLD source compatibility

The two retained native canonical Critic layouts now have closed, source-faithful
handling: complete findings/statuses are preserved, unresolved counts reconstructed
and actual HOLD verdicts fed into policy from exact current-head Git bytes. Historical
test success and fresh-context declarations are not upgraded to live verification.
Unknown passing formats and local remediation preflight remain separate. Focused
checks pass 32 groups; full repository verification passes, including 437 root
controls, 227 adapter tests and all package checks/builds. See `intent/0144/EVIDENCE.md`.

This closes compatibility for historical HOLD sources, not a passing Critic contract
or current review. Independent reviewer provenance, prior-finding history, governed
source/Builder selection, actual provider bindings and full action-time authority
remain before writer enablement. Continue those dependencies and then destination,
head, save/status UI, board and review. All five R5 findings and signed obligations
remain open; no live write, deployment or spending is authorized.

## Completed development increment: 0145 — Domain-review runner evidence

The native domain collector can now verify an explicitly selected runner signature
against exact review bytes, target, reviewer/configuration, Builder and separate
execution IDs. Actual Git trust/proof reads retain source hashes; configured missing
or invalid proof cannot fall back to review self-declarations. Every runner key is
rechecked at common policy evaluation and final completion. Focused checks pass
37 groups; full repository verification passes, including 437 root controls,
237 adapter tests and all package checks/builds. See `intent/0145/EVIDENCE.md`.

This is an internal development receipt contract, not actual provider integration
or proof of truthful isolated execution. Governed runner/source/Builder selection,
isolation evidence, native Critic provenance/passing contract and real human/provider
bindings remain. Then complete full action-time authority, runtime writer and
destination/head/save/status UI, board and review. All five R5 findings and signed
obligations stay open; no live access, write, approval, release or spending is added.

## Completed development increment: 0146 — Native Critic finding continuity

Complete selected native Critic history now rejects findings that disappear between
reports even when each report's own counters are consistent. All inherited IDs,
including previously resolved and newly introduced findings, remain accounted for.
The actual Git collector retains exact current/prior bytes and fails closed when
configured history is unavailable or inconsistent. Focused checks pass 40 groups;
full verification passes, including 437 root controls, 246 adapter tests and all
package checks/builds. Details and limits are in `intent/0146/EVIDENCE.md`.

Selected-link consistency is not authoritative history, truthful resolution,
reviewer provenance, target ancestry or gate approval. Those remain before full
action-time authority and live runtime writes. A read-only frontend audit confirmed
that existing snapshots contain artifact references, not lifecycle states; do not
relabel them as a flight board. Continue the authority and actual lifecycle/read
composition, then destination/head/save/status UI, board and review. All five R5
findings and signed obligations stay open. No protected sources or live authority
were changed.

## Completed development increment: 0147 — Native Critic runner evidence

Current native Critic reports now support explicit source-pinned runner receipts,
separate from domain reviewers and human approvals. Real signature verification
binds report bytes, provider/task/configuration, Builder and independent execution
IDs. Actual current-head Git collection retains receipt/history bytes, rejects
contradictory native context claims and includes Critic keys in final common
validity checks. Focused checks pass 44 groups; full repository checks pass,
including 437 root controls, 256 adapter tests and all package checks/builds.
Details and limits are in `intent/0147/EVIDENCE.md`.

The retained Critic HOLD still blocks policy. Real approved runner/provider
bindings, truthful isolation/closure evidence, governed source/Builder/history
selection, ancestry and a passing native contract remain. Then finish full
action-time authority, runtime/destination/head/save/status, lifecycle projections,
board and review. All five R5 findings and signed obligations remain open; no
real provider, live write, approval, release, deployment or spending is enabled.

## Completed development increment: 0148 — Authenticated Brief destination observation

The shared registry now exposes the explicitly configured canonical Brief targets
and actual Git branch head through authenticated read-only HTTP/MCP. The identity
runtime supports opt-in composition with its existing GitHub binding and read-only
reader; it provisions no grants or writer. Exact tenant/grant checks, pre/post-read
identity refresh, strict output and bounded observation age suppress invalid or
revoked reads. A changing native Git repository exercises the actual code-host
adapter through both transports with no writes. All 33 focused groups and the full
repository check passed, including 437 root controls, 87 registry tests, 81 API
tests, 256 adapter tests and all package checks/builds. See `intent/0148/EVIDENCE.md`
for validation and remaining coverage boundaries.

Next: authoring UI consumption, full action-time authority and approved bindings,
then gated save/status and verified lifecycle projections/board/review. A destination
observation does not check path availability or grant write authority. All five R5
findings, protected review and human gates stay open. No real runtime configuration,
source access, provider, signature, deployment, release or spending changed.

## Completed development increment: 0149 — Destination check in Brief authoring

The authenticated authoring screen now has a user-initiated destination check
using the shared read-only query. It shows candidate paths, branch, repository ID,
observed revision and timestamp, with no path selection or save action. Failed or
stale checks clear metadata; request/timer ownership suppresses late responses on
refresh, expiry, hiding and departure. Existing draft editing and pink/orange design
remain. Nine new tests plus six architecture checks passed, followed by the full
repository check: 437 root controls, 38 web tests and all package checks/builds.
See `intent/0149/EVIDENCE.md` for focused/full validation and remaining limitations.

Next: full action-time authority/approved bindings and gated save/status, plus the
combined authenticated browser journey. Continue lifecycle projections, board and
review. All five R5 findings, qualified/protected review, human gates and signed
Phase 1 obligations stay open. No real runtime, grant, writer, gate signature,
deployment, release, spending or provider access was enabled by this UI increment.

## Completed development increment: 0150 — Destination identity composition and shutdown

Isolated integration now links actual cookie login/RS256 verification, current
native Git authorization, GitHub read adapter, registry and destination display
controller. It reproduced a shutdown bug: a browser-only destination read lost
its session store before post-read authorization. The capability now selects the
existing drain-first lifecycle. Success, revocation and source errors retain their
separate results while owned resources close once. All 32 focused groups and the
full repository check passed, including 437 root controls, 87 API tests and all
package checks/builds. See `intent/0150/EVIDENCE.md`.

The fixtures do not replace real Keycloak, database or browser evidence. Continue
durable runtime-profile/browser integration and full action-time authority with
approved bindings, then gated save/status, lifecycle projections, board and review.
All five R5 findings, protected/qualified review, human gates and remaining signed
Phase 1 obligations stay open. No live provider, writer, configuration, deployment,
release, spending or gate approval was enabled.

## Completed development increment: 0151 — Durable destination runtime reconstruction

The actual identity runtime now has explicit isolated reconstruction coverage with
encrypted PostgreSQL 16 sessions and native Git destination reads. Login state
survives one runtime replacement, the session survives another, current source/grant
changes are observed, and logout remains revoked after a final replacement. Tests
verify the runtime's generated GitHub App assertions and read-only token scope.
No in-memory session substitute or database projection supplies these observations.
The explicit Docker integration and full repository check passed, including 437 root
controls, 87 API tests and all package checks/builds. See `intent/0151/EVIDENCE.md`
for validation and the exact local test-image handling.

Actual Keycloak/browser and approved live provider evidence remain separate, along
with full action-time gate authority and write installation scope. Continue gated
save/status, verified lifecycle projections, board and review. The five R5 findings,
protected/qualified review, human gates and remaining signed Phase 1 obligations
remain open. No live database, account configuration, provider, gate, deployment,
release, spending or live writer was enabled.

## Completed development increment: 0152 — Browser destination runtime journey

The actual Keycloak-authenticated browser session now has combined coverage with
the encrypted PostgreSQL destination runtime and production GitHub reader over
native test Git. The rendered panel observes current repository/branch/head/path
information, reuses its cookie after runtime reconstruction, clears grant-denied
and expired metadata, and preserves the unsaved draft. The synthetic provider
verifies generated App assertions and allows read-only requests only. All 40
explicit browser checks and full repository validation passed, including 437 root
controls and all package checks/builds. Owned test resources were cleaned up.
See `intent/0152/EVIDENCE.md` for the service-composition and provider limits.

Continue full action-time authority and approved source/runner/provider bindings
before gated save/status, then verified lifecycle projections, board and review.
All five R5 findings, protected/qualified review, human gates and signed Phase 1
obligations remain open. No live account, provider, writer, signature, deployment,
release or spending was enabled.

## Completed development increment: 0153 — Bounded Critic target ancestry

The read-only GitHub adapter can now provide exact scoped commit parents. Selected
native Critic histories may opt into a shared bounded graph traversal linking each
review target and the current source head, including merge parents and repeated
targets. Invalid graphs, unrelated histories, exhausted budgets, source moves and
lost observer grants fail closed. The collector retains immutable selected paths
without clearing the original HOLD or granting gate/write authority. Focused checks
passed 53 tests; full repository validation passed, including 437 root controls,
265 adapter tests and all package checks/builds. See `intent/0153/EVIDENCE.md`.

Unconfigured ancestry remains unverified. Observed parent edges do not independently
hash raw commits, establish authoritative/complete history selection or verify
finding closure. Continue governed source/Builder/history selection, approved
runner/provider bindings, truthful isolation and a reviewed passing native Critic
contract before full action-time authority and live writer composition. Gated
save/status, lifecycle projections, board/review and all five R5 findings, protected
and qualified review, human gates and signed Phase 1 obligations remain open. No
live source, permissions, deployment, release or spending changed.
## Approved overnight execution focus — September 6–7, 2026

The user approved the 22:00–08:00 Eastern target in
`docs/overnight/2026-09-06-PLAN.md`: prioritize integrated closed-by-default
authorization, exact-content confirmation/save-status UI, and verified delivery;
board integration is stretch work. The active implementation loop incorporates
these priorities and will report at the first safe checkpoint at or after 08:00.
This is an execution focus, not a completed increment, gate waiver or promise that
the first usable journey or all of Phase 1 will be complete overnight.

## Completed development increment: 0154 — Integrated held Brief writer

The real shared preview/save/status path now has an isolated integration with
actual Git membership and complete signed policy-source collection. A dedicated
held factory reports immutable internal missing-evidence diagnostics but always
denies write authority and direct dispatch. Tests cover policy-satisfied fixtures,
native HOLDs, malformed pins, source changes, revocation and draining closure.
Five focused tests and full repository checks passed, including 437 root controls,
270 adapter tests and all package checks/builds. See `intent/0154/EVIDENCE.md`.

The factory is not installed in the live runtime. Governed selection, review
provenance and complete action-time authority remain indispensable; these tests
do not manufacture them. All five R5 findings and human/protected review remain
open. Per the overnight focus, next implement exact-content confirmation and
read-only save-status feedback in the existing authoring screen with disposable
test data. Keep live saving disabled; no signature, deployment or spending.

## Completed development increment: 0155 — Exact review and save-status UI

The authenticated authoring/destination screen now supports explicit canonical-path
choice and exact-content local review. Changes, fresh destination observations,
expiry and hiding clear acceptance. The save button remains disabled with missing
authority explained. A separate previous-operation panel accepts an original UUID
and performs manual scoped status reads, distinguishing all five outcomes without
automatic retry or treating old receipts as the current draft's save/signature.
The pink/orange design and existing stack are preserved.

Full repository checks passed, including 437 root controls, 270 adapter tests,
46 web tests and all package builds. The final actual Keycloak/Chromium run passed
40 checks, with keyboard/mobile/automated accessibility checks and inspected
screenshots. The real writer-less runtime returned 503; successful status displays
used explicitly intercepted browser-only fixtures, not actual saved records.
Owned test services were cleaned up. See `intent/0155/EVIDENCE.md` for exact limits.

Next connect browser status readback to the actual shared Git marker reader in an
isolated composed runtime, preserving live-write denial. Do not count browser
fixtures as that integration or start unrelated provenance micro-increments.
Governed source/runner/review selection, full action-time authority, all five R5
findings, independent/qualified protected review and human gates remain unfinished.
No live provider permission, writer, deployment, release or spending changed.

## Completed development increment: 0156 — Native Git status browser integration

The browser now has a tested path from its Keycloak/encrypted PostgreSQL session
through request-owned writers and the shared status query to actual native Git
marker/Brief bytes and history. The seeded receipt survives later branch commits
and composed-service reconstruction. Current status-grant denial returns 403
without provider reads; every request writer closes. This new integration uses no
intercepted browser replies. Seeded history is still test data, not a platform save
or provider approval, and no production runtime writer profile was installed.

All 41 actual browser integration checks and full repository validation passed,
including 437 root controls, 270 adapter/87 API tests and all package builds.
Owned test services/data were cleaned up. See `intent/0156/EVIDENCE.md` for exact
composition and fixture limits. The current draft remains separate from prior
receipts, and live saving remains disabled.

Next connect a validated receipt to the existing exact-revision Brief reader through
canonical reference navigation and current catalog/access checks. Reject absent or
stale references without substituting latest content. Use disposable curated
projections; receipt possession grants no access. This precedes board stretch work.
Full governed action-time authority, all five R5 findings, protected/qualified review,
human gates and signed Phase 1 obligations remain open. No deployment or spending.

## Completed development increment: 0157 — Read the recorded Brief

A validated committed receipt now links to the existing exact-revision Brief
library. It carries only recorded reference metadata; current catalog/access checks
still decide availability. Actual browser integration opens matching native Git
bytes from a curated PostgreSQL projection, checks keyboard focus, rejects current
grant denial and refuses a newer projection in place of the recorded revision.
The current unsaved draft remains separate. The existing pink/orange theme is retained.

Full repository validation passed, including 437 root controls, 270 adapter/87 API/
47 web tests and all package builds. The final complete browser run passed 41 checks
after correcting an older test's event-count assumption to explicitly include the
two new fixture ingests. Feed history was preserved, not reset. Owned test resources
were cleaned up; see `intent/0157/EVIDENCE.md` for full evidence and fixture limits.

The prior-receipt inspection path is now connected in disposable integration, not a
live authorized save journey. Next assess the remaining overnight journey priorities
against the signed Phase 1 plan before board/work-list stretch work. Do not infer
lifecycle status or approvals from Brief content, receipts or projection presence.
Full governed action-time authority, five R5 findings, qualified/independent protected
review and human gates remain open. No live writer, deployment, release or spending.

## Completed development increment: 0158 — Recorded Brief projection seam

Receipt-based ingestion now has a reusable production adapter, replacing the
test-only initial projection logic. It validates the configured destination and
captured reader binding, reads exact recorded source bytes, recomputes both hashes
and passes the original selected revision to the sink's CAS. A different selected
revision is preserved without source reads or writes; cancellation never implies
rollback. Receipt parsing is not independent provenance or access authority.

Six focused tests and full repository verification passed, including 437 root
controls, 276 adapter/87 API/47 web tests and all package builds. The final actual
Keycloak/Chromium browser run passed 41 checks with native disposable Git and
PostgreSQL, including duplicate replay and preservation after a newer projection.
The derived six-event feed assertion passed unchanged. Only owned test resources
were cleaned up. See `intent/0158/EVIDENCE.md` for evidence and fixture limits.

The first-journey audit is refreshed in `docs/FIRST-USABLE-DELIVERY.md`; the original
68–132-hour baseline is explicitly historical, not current remaining effort.
Next connect this seam to an explicitly owned, authorized projection-job lifecycle,
reusing existing single-flight/draining patterns and current projector identity/CAS.
Use disposable integration; no live scheduler or writer is installed. Board remains
stretch, and Brief projection presence must not imply verified lifecycle status.
Complete governed action-time write authority, actual runtime membership, model
conversation, lifecycle/decision projection, five R5 findings, qualified/independent
protected review and human gates remain open. No deployment, release or spending.

## Completed development increment: 0159 — Owned receipt projection job

The recorded-source adapter now runs under the shared single-flight and draining
projection lifecycle. The job captures configured scope, authenticates a separate
projector agent, obtains a receipt through a trusted prebound readback callback and
rechecks current identity around storage and completion. Subject substitution,
revocation and shutdown deny further work. Post-ingest failure is not rollback.

The disposable browser composition now obtains those receipts from the actual
status endpoint with the human's existing Keycloak browser session and native Git
history. The projector uses its own synthetic identity for real PostgreSQL ingestion.
Initial/duplicate projection and replay after advancement pass without extra feed
events or revision rewind. Human status-grant denial blocks callback readback before
provider reads. This is seeded operation history, not a successful platform save.

Fifteen focused tests, full repository validation (437 root controls, 282 adapter,
87 API and 47 web tests plus all package builds), and the final 41-check browser run
passed. The first browser bridge failure was corrected with actual browser-native
same-origin fetch; security checks were not weakened. Owned resources were cleaned
up. See `intent/0159/EVIDENCE.md` for exact evidence and limits.

Next compose the job into an explicit owned runtime using existing source/database
adapters and trusted receipt readback, then verify the combined held journey. No live
trigger, writer or scheduler is installed. Revision-linked work-list remains stretch.
Complete governed write authority, approved real configuration, model conversation,
lifecycle/decision projection, five R5 findings, independent/qualified protected
review and human gates remain open. No deployment, release or spending changed.

## Completed development increment: 0160 — Recorded projection runtime

The owned receipt job now has explicit production composition with a lazy bounded
`steer_projector` PostgreSQL pool and the existing RLS/CAS ingestion path. A strict
versioned profile, separate password and prebound source/readback dependencies
replace the handwritten fixture sink. Construction performs no I/O or dispatch;
run errors are sanitized and shutdown drains work before closing only its own pool.

Four focused runtime tests, all package typechecks and full repository validation
passed, including 437 root controls, 282 adapter/91 API tests and all package builds.
The actual 41-check Keycloak/Chromium integration verifies real runtime ingestion,
duplicate replay, human status denial, later-revision preservation and closed-pool
admission. Owned synthetic services/data were cleaned up. See `intent/0160/EVIDENCE.md`.

The closed readback-to-projection path is integrated in disposable runtime. This
does not prove an authorized platform save: operation history is seeded and no live
writer, trigger or scheduler is installed. Next take the overnight revision-linked
work-list stretch using current authenticated curated catalog/snapshot contracts.
Expose projected artifacts and exact references, not inferred lifecycle stages or
approval status; retain the pink/orange design and existing reader. Audit the current
Brief library first to avoid adding a redundant list or unrelated wrapper increment.
Full governed write authority/configuration, model conversation, lifecycle/decision
data, all five R5 findings, qualified/independent protected review and human gates
remain open. No deployment, release, provider permission or spending changed.

## Completed development increment: 0161 — Revision-linked Brief work list

The existing authenticated Brief library now shows responsive work rows with full
source paths, selected revisions, expandable fingerprints and returned-count/page
ranges. Native revision links use the existing exact-reference/current-access
reader and restore keyboard focus after catalog replacement. This extends one
library rather than adding a redundant board; no lifecycle status is inferred.

Full repository checks passed, including 437 root controls, 282 adapter/91 API/
47 web tests and all builds. The final actual browser run passed 41 checks with
native Git/PostgreSQL/Keycloak, including metadata equality, link/focus behavior,
mobile and enlarged-text wrapping and automated accessibility. An initial enlarged-
text overflow was corrected without weakening assertions. Desktop/mobile images
were inspected; only owned synthetic services/data were cleaned up. The existing
pink/orange design is retained. See `intent/0161/EVIDENCE.md` for exact limits.

Overnight stretch now includes revision-level projected-work inspection, not the
signed P1-06 lifecycle Flight Board or decision Inbox. Next audit the remaining
signed first-journey requirements against the actual runtime and choose one
demonstrable missing capability; do not keep adding wrapper or duplicate-list
increments. P1-06 still requires production lifecycle surfaces and design-system
coverage; P1-07 still requires model-backed conversation and one-confirmation
onboarding. Full live-write authority/configuration, all five R5 findings, qualified/
independent protected review and human gates remain unfinished. No live save,
deployment, release, provider permission or spending was enabled.

## Completed development increment: 0162 — Actual isolated creation journey

The first-journey audit identified a remaining evidence gap: browser projection
began from seeded history, while actual creation was tested separately. The new
opt-in `pnpm test:brief:integration` connects HTTP preview/exact-confirmation save
to the production request-bound writer/store, creates exactly the Brief and marker
in native disposable Git, recovers the operation through a reconstructed API and
projects the actual-created receipt through the owned PostgreSQL runtime.

All three explicit integration groups passed, including no-second-mutation duplicate
requests, lost acknowledgment/status recovery, wrong confirmation, agent/grant denial
and unavailable authority. Every request-owned writer closes. Identity context and
full Gate 2 authority are explicitly simulated test callbacks; this does not enable
the held production factory or prove live membership/governance. No provider network
access or real credentials were used, and only owned disposable resources were cleaned.

Full repository checks passed (437 root controls, 282 adapter/91 API tests and all
package builds). The separate actual Keycloak/Chromium regression suite passed 41
checks and retains its labeled seeded-history limitation. Protected artifacts remain
unchanged. See `intent/0162/EVIDENCE.md`; there is still no authorized live save.

Next advance the missing review step with a read-only, revision-bound decision
record view through the existing curated source/API path, verifying the backend
contract and exact Brief/evidence linkage together. Recorded decision/signer text
must remain explicitly unverified until full governed verification exists. Do not
enable signatures, infer lifecycle stages, expose unconfigured records or add
another policy-only wrapper. Real configuration/write authority, model conversation,
all five R5 findings, qualified/independent review and human gates remain unfinished.
No deployment, release, provider permission or spending changed.

## Completed development increment: 0163 — Decision records beside the exact Brief

The production Brief dialog now reads configured decision records through the
shared `intent.brief.decisions` tool. It verifies the exact selected Brief first,
then bounded sibling source records at their selected revisions and fingerprints.
The UI shows recorded signers and referenced artifacts, distinguishing an exact
Brief reference from a mismatch. Both retain a prominent unverified-approval label;
no source text becomes a signature, lifecycle stage or write grant.

The actual browser regression passed 42 checks across native Git, PostgreSQL and
Keycloak, including unconfigured-row exclusion, exact source/linkage, inert source
text, mobile/200% wrapping, automated accessibility, committed grant denial and
close/reopen clearing. Desktop/mobile screenshots were inspected. A pre-existing
expiry-test clock leak was corrected by isolating its BrowserContext, without
relaxing the application's expiry guard or test assertions.

Full repository checks passed: 438 root controls, 93 registry, 24 data, 50 web,
282 adapter and 91 API tests, remaining workspaces and all builds. The separate
three-group actual Brief-creation/PostgreSQL regression passed again. Only owned
synthetic resources were cleaned up. See `intent/0163/EVIDENCE.md` for limits.

Next connect permitted referenced review evidence to exact source inspection in
this same view. Keep evidence paths and revisions bound to the selected decision,
respect existing curated content permissions, and never treat inspected evidence
as independently verified approval. Do not turn this into an unsigned decision
action or claim the full Inbox/Flight Board is complete. Live writer configuration,
model conversation, all five R5 findings, qualified/independent protected review
and human gates remain unfinished. No deployment, release, provider grants or
spending changed; the standing implementation loop remains active.

## Completed development increment: 0164 — Inspect decision-referenced evidence

The exact Brief's decision view now opens permitted referenced evidence through
`intent.brief.decision.evidence`. Each request rechecks the Brief, selected decision
path/revision/digest, recorded artifact path/revision and all current grants. Source
curation is independently mandatory; neither record text nor a reference grants
access. Exact projected bytes/fingerprints are shown as inert text, with no fallback
to a newer revision and no upgrade to verified review, signature or gate authority.

One source is visible at a time, with manual inspection, close/cancel, focus return,
and clearing on selection, access failure and parent lifecycle changes. The final
actual Keycloak/Chromium run passed 42 checks, including native Git/PostgreSQL reads,
unconfigured and stale-reference denial, source/decision switching, grant revocation,
recovery, cancellation, mobile/200% wrapping and automated accessibility. Final
desktop/mobile screenshots were inspected; only owned synthetic resources were cleaned.

Full checks passed with 438 root controls, 99 registry, 24 data, 53 web, 282 adapter
and 91 API tests, remaining workspaces and all builds. The three-group actual Brief
creation/PostgreSQL regression passed again. See `intent/0164/EVIDENCE.md` for limits.

Next connect the existing recorded-Brief projection job to the durable worker
workflow, using content-free references and a trusted current receipt-read callback
outside workflow history. The worker already owns repository-snapshot reconciliation
and gate-source watching, but lacks a receipt-specific projection activity. Keep
current projector authorization, exact-source CAS, bounded execution and owned
shutdown; integrate and test the real worker/runtime path together, not just a new
wrapper. Do not enable a live scheduler, save button, provider access or gate action.
Full governed write authority, model conversation, all five R5 findings, independent/
qualified protected review and human signatures remain unfinished. No deployment,
release, grants or spending changed; the standing implementation loop remains active.

## Completed development increment: 0165 — Durable recorded-Brief projection

The existing exact receipt-projection job now has a dedicated Temporal worker path.
Trusted configuration binds one canonical Brief and receipt subject to an exact
UUID save operation. Current readback stays outside workflow history and must match
all six reference fields. The separately authorized projector retains exact source
verification, CAS, duplicate behavior and different-revision no-rewind protection.
One bounded activity attempt is permitted; retained workflow IDs reject duplicates.
Errors are sanitized and owned shutdown drains actual work before closing its pool.

The actual local Temporal/native-Git/PostgreSQL integration passed 22 checks,
including four new groups for queued recreation, exact bytes, history replay,
wrong target/receipt, current committed revocation and no rewind. The three-group
actual creation regression passed again. Full checks passed: 438 root controls,
99 registry, 24 data, 53 web, 283 adapter, 91 API and 23 worker tests, remaining
workspaces and all builds. Owned test resources were cleaned. See
`intent/0165/EVIDENCE.md` for callback provenance and recovery-test limits.

Next connect actual disposable HTTP Brief creation and authenticated store status
to this worker, then verify the curated work list opens the exact projected receipt
revision. These currently pass in separate integrations, not a single end-to-end
browser journey. Keep all test-only identity/authority explicit and do not enable
a live save button, scheduler or provider grant for the demonstration.

Full governed write authority, model conversation, all five R5 findings, independent/
qualified protected review and human signatures remain unfinished. No deployment,
release, live writer/scheduler, grants or spending changed. The standing implementation
loop remains active; candidate remote equality is verified after commit.

## Completed development increment: 0166 — Created Brief to worker and work-list reads

One isolated test now joins actual HTTP preview/confirmation save, native Git
Brief/operation creation, lost-acknowledgement recovery through a reconstructed
current-status API, the durable recorded-Brief worker and curated catalog/exact
Brief reads. The saved pair is not seeded. An unrelated later HEAD does not replace
the recorded revision. Queued runtime reconstruction, replay and duplicate operations
preserve one Git mutation and one ingestion event. Human status access and projector
access remain separate current checks; source curation and exact revision/digest
are still mandatory for work-list reads.

The actual Temporal/native-Git/PostgreSQL suite passed 25 checks, including three
new integrated groups; the original three creation regressions also passed. Full
checks passed with 438 root controls, 99 registry, 24 data, 53 web, 283 adapters,
91 API and 23 worker tests, remaining workspaces and all builds. The existing browser
suite passed all 42 checks using actual Keycloak/Chromium. Only owned synthetic
resources were cleaned. See `intent/0166/EVIDENCE.md` for exact provenance and limits.

This closes a mechanical API-to-worker-to-read-model integration gap, not interactive
browser saving. Current browser status history is still seeded, and `BriefReview`
has an unconditionally disabled save button with no submit handler. Next implement
and exercise the closed-by-default browser confirmation/submission and current status
path against disposable creation/projection. Keep test-only identity/authority
explicit, never derive permission from a local checkbox or inspected decision, and
leave real saving and live scheduling disabled.

No production/frontend source, dependency, schema or live configuration changed in
0166. Full governed authority, model conversation, all five R5 findings, independent/
qualified protected review and human signatures remain unfinished. No deployment,
release, provider grants, real-record deletion or spending changed. The standing
implementation loop remains active; remote equality is checked after candidate push.

## Completed development increment: 0167 — Guarded browser Brief submission

The browser now has a closed-by-default exact-review submit handler, independent
operation feedback and manual recovery. One immutable attempt binds current subject,
original facts/path/head and content/request/blob fingerprints. Duplicate clicks,
draft edits and uncertain outcomes never produce a second request. Destination expiry
does not erase an active operation; hiding/leaving/session expiry clears details and
retains the attempted latch. The user must retain the original ID for later recovery;
there is no browser persistence or automatic retry.

The actual browser suite passed 43 checks. The new journey uses real local Keycloak
sessions/current native Git membership, one actual Git creation with lost response,
service reconstruction, current status revocation/recovery and the exact created
PostgreSQL-projected Brief. Screenshots and automated accessibility/mobile checks
passed. The code-host transport and full gate-authority callback remain explicit test
doubles. The browser projection job is not Temporal: 0166 separately verifies the
durable path, whose 25-check regression passed again, as did the original three
Brief-creation integration groups. Full checks passed with 438 repository controls,
99 registry, 24 data, 61 web, 283 adapter, 91 API and 23 worker tests, remaining
workspaces and all builds. See `intent/0167/EVIDENCE.md` for exact results and limits.

Next join browser-confirmed disposable creation to the existing durable worker and
exact read model, keeping trusted current receipt resolution outside workflow history.
Do not install a live scheduler or enable real saves. The new server-owned display
switch is only enabled in the owned test process and is never backend authority.

Full governed authority, authenticated lifecycle/decision projections, model
conversation, all five R5 findings, independent/qualified protected review and human
signatures remain unfinished. No live configuration, provider grants, spending,
deployment, release, real-record deletion, dependency or schema change occurred.
The existing stack and pink design tokens are preserved. The standing implementation
loop remains active; exact candidate remote equality is checked after commit/push.

## Completed development increment: 0168 — Browser creation through the durable worker

The actual browser-confirmed native Git creation now reaches the production Temporal
recorded-Brief worker and exact PostgreSQL read model in one isolated journey. A lost
save response is recovered with current Keycloak/browser status. Its exact operation
is queued without a running worker, then a reconstructed runtime executes one receipt
read and one projection event. History replay repeats neither read nor effect; a
duplicate start is rejected. After API reconstruction, the browser opens the exact
curated created Brief. Source admission remains explicit and test-owned.

The browser suite passed all 43 checks, the Temporal suite all 25 checks and the
actual creation regression all three groups. The shared pinned Temporal bootstrap
preserves the existing child-process ownership guard; an initial prefix mismatch
was corrected without relaxing it. Full checks passed with 438 repository controls,
99 registry, 24 data, 61 web, 283 adapter, 91 API and 23 worker tests, remaining
workspaces and all builds. See `intent/0168/EVIDENCE.md`. No frontend or production
code changed.

Next connect the existing held governed source/policy assessment to runtime diagnostics,
preserving separate current observer identity and request-bound human identity. Keep
missing governed selection, independent review provenance and action-time authority
explicit; a policy observation is not a grant or signature. Do not enable real saving.

All five R5 findings, full governed authority, model conversation, lifecycle/decision
projections, independent/qualified protected review and human signatures remain open.
No live writer/scheduler, provider grants, real-record deletion, spending, deployment,
release, dependency or schema changes occurred. The standing implementation loop
remains active; exact remote equality is checked after the candidate push.

## Completed development increment: 0169 — Held governance in the identity runtime

The optional strict held profile now connects the existing source-policy collector
and denied-write factory to request-bound human context in the identity runtime.
Separate current agent-observer identity is required. Internal diagnostics retain
only the last immutable assessment under explicitly false gate/write flags; they
are historical, not a current readiness query or authority lease. New source work
clears them and shutdown clears/suppresses late results while admitted requests drain.

Four focused runtime tests passed using actual OIDC/App JWT signatures, native Git
current membership and signer crypto. Both satisfied and blocked policy deny saving
without a write token or Git mutation. Startup, status, revoked observer/source and
pending-shutdown cases pass. The actual creation regression passed three groups;
the Temporal integration passed all 25 checks. Full checks passed with 438 repository
controls, 99 registry, 24 data, 61 web, 283 adapter, 95 API and 23 worker tests, remaining
workspaces and all builds. The final actual Keycloak/Chromium suite passed 43 checks,
including browser creation through the durable worker. See `intent/0169/EVIDENCE.md`.
No frontend or live configuration changed.

Next resolve governed evidence selection and review provenance against explicit trusted
roots/current source evidence. Keep every missing trust-root, qualification or human
decision explicit; source observations cannot stand in for those approvals. The held
profile itself is not live activation and cannot bypass these requirements.

All five R5 findings, full action-time authority, model conversation, authenticated
lifecycle/decision projections, independent/qualified protected review and human
signatures remain open. No provider grant, spending, deployment, release, real-record
deletion, schema or new dependency was introduced. The standing implementation loop
remains active, with exact remote equality verified after the candidate push.

## Completed development increment: 0170 — Exact policy-selection source binding

The optional held policy profile now pins one complete selection manifest to exact
current Git bytes and scope. Every configured signer, trust/proof, policy, Critic,
review set and optional runner/history selection must match; the manifest cannot
replace startup configuration or fall back to older source. Integrity, bounded size,
source-role separation, current observer/head and draining shutdown checks apply.
Held diagnostics retain fingerprints only and all authority paths remain denied.

Eleven focused adapter/runtime tests passed, including native Git, repinned hostile
selection, malformed bytes, changed identity/head, timeout and startup collisions.
Full checks passed with 438 repository controls, 99 registry, 24 data, 61 web, 289
adapter, 96 API, 23 worker and remaining workspace/prototype tests and all builds.
Actual creation regression passed three groups, Temporal integration 25 checks and
the final Keycloak/Chromium browser integration all 43 checks. Disposable resources
were cleaned. See `intent/0170/EVIDENCE.md` and `docs/GATE-POLICY-SELECTION.md`.

This closes exact declared-selection source binding, not governed selection approval.
No authority owner, trusted live configuration or independent review conclusion is
established by matching a manifest. The next integration target is the held profile
through the actual isolated browser/Keycloak session boundary, while retaining the
explicit missing approvals and zero mutations. Do not invent trust roots to make
the positive policy fixture a live authorization proof.

All five R5 findings, full action-time authority, model conversation, authenticated
lifecycle/decision projections, independent/qualified protected review and human
signatures remain open. No live profile, manifest, provider grant, frontend, schema,
dependency, spending, deployment, release or real-record deletion changed. The
standing implementation loop remains active; exact remote equality is verified
after the candidate push.

## Completed development increment: 0171 — Held saving through actual browser sessions

The production authoring UI now has an isolated integration through actual Keycloak,
encrypted PostgreSQL browser sessions, HTTPS gateway and the configured held identity
runtime. Exact review reaches native Git whole-selection assessment without a
successful synthetic authority callback. Matching policy still denies the save and
requests no write permission: no Brief/marker or Git HEAD change is produced.

The browser checks runtime reconstruction and manual not-found status, a submission
lock that survives refreshed review, current observer loss and Git-committed human
revocation. The historical signers, trust roots, qualifications, normalized review
facts and observer remain synthetic. This proves session-path integration, not
independent gate evidence or authorized real saving. The separate test-authorized
creation/Temporal replay/readback journey continues to pass.

The final actual Keycloak/Chromium browser suite passed all 44 checks. Focused runtime
checks, 438 repository controls, workspace/prototype regressions, typechecks and
creation integration passed; final build results are recorded in
`intent/0171/EVIDENCE.md`. Early harness failures were corrected without relaxing
production controls: request pacing matches ingress limits; expired display controls
are distinguished from enabled retries; discarded HTTP error bodies are not reread
through the browser debugger. Owned failed and successful test resources were cleaned.

Next connect the separate observer boundary to the existing normalized OIDC verifier
and current Git authorization resolver in the isolated integration, instead of a
direct synthetic-principal callback. Reuse those components; do not invent new
trust-root approvals or promote fixture reviews into qualified evidence.

Production code, live settings, provider grants, schema, dependencies, protected
artifacts and pink/orange design are unchanged. All five R5 findings, governed live
selection, review provenance, full action-time authority, model conversation,
authenticated lifecycle/decision projections and human signatures remain open.
No deployment, release, spending or real-record deletion is authorized. The standing
implementation loop remains active; exact remote equality is verified after push.

## Completed development increment: 0172 — Verified current observer in the held journey

The held browser integration now verifies both current actors through actual local
Keycloak. The service observer obtains a fresh disposable client-credentials token,
uses the existing OIDC verifier and resolves its separate current Git grant through
the read-only App adapter. The successful collection makes zero calls to the former
direct-principal callback or synthetic identity JWKS port. No gate validity window
or production deadline is extended.

Committed observer revocation, removed gate.observe and an invalid token each deny
with no retained assessment or mutation. A freshly verified hat-free agent is restored
before independently checking human revocation. Exact browser review, denied saving,
runtime reconstruction, not-found status and persistent attempt lock still pass.
Historical signers, qualifications, reviews, trust roots and selection approval remain
synthetic/unverified real evidence, not qualified gate approval.

All 44 actual Keycloak/Chromium browser checks passed, including the separate
test-authorized creation/Temporal replay/readback journey. All 438 repository controls,
88 prototype tests and workspace tests (99 registry, 24 data, 61 web, 289 adapter,
96 API, 23 worker, 13 domain), typechecks and builds passed. Owned test resources
were cleaned. See `intent/0172/EVIDENCE.md` for the phased verification and limits.

The integrated held path now exercises both current identity boundaries. Remaining
work must distinguish governed historical trust/selection and review-provenance
requirements from current authentication. Continue the approved independent journey
work when real evidence/approval is unavailable; do not manufacture trust roots,
reinterpret fixture signatures or start repeated broad Critic loops to clear a hold.

No production code, live grant/profile, provider access, protected artifact, schema,
dependency or pink/orange design changed. All five R5 findings, full governed
action-time authority, model conversation, authenticated lifecycle/decision
projections and independent/qualified review/human signatures remain open. No live
save, spending, deployment, release or real-record deletion is authorized. The
standing implementation loop remains active; exact remote equality is verified
after the candidate push.

## Completed development increment: 0173 — Exact source previews in the work list

Each projected Brief now offers an explicit Preview alongside the full Read action.
It reuses the current-authorized exact path/revision/digest read and shows one source
title with literal Problem and Proposed outcome excerpts. Missing, empty and ambiguous
structure remains explicit; long excerpts are visibly bounded without splitting
Unicode pairs. No status, measurable-today badge, provenance, mission fit, domain
routing or approval is invented from source text.

One summary stays in memory only and clears on another read, explicit clearing,
refresh, pagination, lifecycle/scope/session changes and denial. Clearing returns
keyboard focus to Preview. Existing exact revision links and full-source dialogs
retain their permission checks. This advances the approved candidate-inspection
stretch target; it is not completion of the authenticated lifecycle board or backlog
actions. No new endpoint, grant, storage, polling, model call or write was added.

Four new source/rendering tests passed; the web suite now has 65 tests. The 438
repository controls, remaining workspace/prototype regressions and typechecks passed.
The actual browser exercises exact previews, keyboard use, narrow/enlarged layout,
automated accessibility and clearing/navigation/current-grant denial. Final browser
and build results are recorded in `intent/0173/EVIDENCE.md`. Desktop/mobile captures
were visually inspected and retain the existing pink/orange work-list design.

The Sites skill guided existing-project reuse and local-only background delivery;
no hosted Site or user-facing browser session was created. All five R5 findings,
full governed write authority, authenticated lifecycle/decision projections,
model conversation and independent/qualified review/human signatures remain open.
No live configuration, provider grant, protected artifact, dependency, schema,
deployment, release, spending or real-record deletion changed. The implementation
loop remains active, with exact remote equality checked after the candidate push.

## Completed development increment: 0174 — Owned recorded-Brief dispatch recovery

The existing deterministic recorded-Brief starter now has an internal owned client
with a fixed namespace/queue/operation, one explicit start, manual status and draining
connection closure. Unknown acknowledgments and not-found results never reset its
attempt latch. Metadata validation, current namespace checks and typed error handling
keep provider failures private. Reconstruction retains the same deterministic ID;
Temporal duplicate protection lasts only as long as its retained record.

The actual local Temporal/Git/PostgreSQL test loses an acknowledgment after real
dispatch, observes the queued run, recreates the client connection and rejects a
duplicate. A completed different-revision workflow leaves the newer projection
unchanged. This does not claim receipt provenance, successful ingestion, dispatcher
authority or automatic admission of new paths. All 26 integration checks and 29
worker unit checks passed; final repository checks are recorded in `intent/0174/EVIDENCE.md`.

The code-grounded remaining route is `docs/JOURNEY-REMAINING-WORK.md`: governed
save authority, trusted dispatch/admission, authenticated operating projections,
actionable revision-bound review, agent conversation and approved-pod demonstration.
This replaces stale sequencing, not signed requirements or the full Phase 1 ledger.
Next connect the fixed client to an explicitly owned current-authorized dispatch
boundary; missing governance contracts require a narrow proposal, not new live grants.

No frontend/design, protected artifact, dependency, schema, provider grant, live
configuration/save/scheduler, spending, deployment, release or real deletion changed.
All five R5 findings, independent/qualified review and human signatures remain open.
The standing implementation loop remains active; verify remote equality after push.

## Completed development increment: 0175 — Current-authorized recorded dispatch

Shared start/status tools now wrap the fixed recorded-Brief scheduler through a
structural port. They require separate explicit current grants and exact configured
organization/repository/item/operation/derived workflow ID. Start is hat-free agent
only; status accepts explicitly granted humans or hat-free agents. No other grant
or human hat becomes dispatch permission. No live grant or identity-runtime option
was installed.

Pre-I/O identity and configuration checks deny changed scope, grants, identity,
expiry and regressing invocation clocks. Status revalidates after I/O before releasing
metadata. Start failures remain unknown without retries; accepted dispatch is not
reported as rolled back after later revocation. COMPLETED remains only workflow
metadata, not a saved/applied Brief or approval.

Five focused registry tests (104 total), official MCP/HTTP parity and all 27 actual
local Temporal/Git/PostgreSQL integration checks pass. The latter exercises grant
loss before dispatch, one attempt, revoked status and a completed different-revision
outcome with unchanged ingestion. Dispatcher and receipt provenance remain synthetic.
Final regression/build evidence is in `intent/0175/EVIDENCE.md`.

Next compose the owned client and current-authorized service into an explicit runtime
lifecycle; do not infer automatic receipt/path admission or live grant approval.
All five R5 findings, full governed authority, independent/qualified review and human
signatures remain open. No frontend, protected artifact, dependency, schema migration,
live save/scheduler, provider grant, spending, deployment, release or real deletion
changed. The loop remains active; verify exact remote equality after candidate push.

## Completed development increment: 0176 — Owned recorded scheduler runtime

An explicit optional profile/factory pair now composes recorded dispatch into the
identity runtime. It binds the exact item/operation to the runtime's Git organization/
repository, validates workflow ID and methods, and assumes ownership only of the
factory's returned managed connection. No live factory, profile or grant is installed.

The existing OIDC/current-Git tool route authorizes calls. Request draining includes
the recorded scheduler even without MCP, preserving final status authorization before
session/scheduler closure. Startup and cleanup failures remain generic; other owned
resources are still closed and stopped services refuse new calls.

Four focused runtime tests and all 28 actual local Temporal integration checks pass,
including signed-token/native-Git authorization through HTTP and the actual owned
runtime/client. The new activity result and provider/JWKS responses are synthetic;
the scenario does not perform a real SQL projection or establish real gate authority.
Final regression/build results are in `intent/0176/EVIDENCE.md`.

Next connect the configured runtime, actual current dispatcher and exact receipt/
worker binding in isolated integration. Keep live identity/cluster approvals and
governed source admission separate. No new frontend, protected artifact, dependency,
schema migration, live save/scheduler, provider grant, spending, deployment, release
or real deletion. All five R5 findings and independent/qualified review/human gates
remain open; the standing implementation loop stays active.

## Completed development increment: 0177 — Authenticated actual receipt projection

The signed/current-authorized dispatcher now runs in the same isolated scenario as
actual HTTP Brief creation, native Git operation readback, recreated Temporal worker,
PostgreSQL ingestion and exact curated Brief reads. A lost save acknowledgment and
later unrelated commits do not change the saved revision or create a second event.
Projection-only dispatch grants and revoked current dispatcher status are denied.

This is test integration of the existing production stack, not a synthetic activity
success callback. Provider responses and human/gate/projector authority are still
synthetic, so an actual Keycloak dispatcher and approved real configuration remain
separate work. No live save, grant, automatic source admission, protected artifact,
frontend, dependency, migration, deployment, spending or real deletion changes.
Final exact-code results are recorded in `intent/0177/EVIDENCE.md`. All five R5
findings and complete authority/independent review/human gates remain open.

## Completed development increment: 0178 — Actual service-account recorded dispatch

The actual Keycloak/Chromium browser-created Brief journey now invokes recorded
dispatch through the owned identity runtime, not a direct SDK starter. Fresh actual
service-account tokens, separate current Git grants and fixed operation binding
precede the queued/recreated worker and human receipt readback. Tests require
projection-only dispatch denial, one attempted start, revocation denial, exact
recorded-source projection/read/replay and owned resource cleanup.

See `intent/0178/EVIDENCE.md` for final execution results. Gate and projector authority
remain synthetic; this adds no live configuration, write permission, automatic path
admission, frontend change, protected incorporation, spending, deployment or real
deletion. All five R5 findings and full authority/independent review/human signatures
remain open. The next local slice is the current projector identity boundary.

## Completed development increment: 0179 — Current distinct projector identity

The durable browser-created Brief journey now uses a distinct actual disposable
Keycloak projector client and current native Git grants through production identity
adapters. Dispatch-only grants, revoked membership, invalid tokens and the actual
dispatcher's token must deny before receipt readback or a worker database connection.
Restored authority permits one exact recorded projection; later revocation denies
re-observation without another receipt read. Human/dispatcher/projector permissions
remain separate and private subjects are excluded from Temporal history.

Actual execution results are recorded in `intent/0179/EVIDENCE.md`. Gate authority
and live-provider transport remain synthetic; no approved real membership, live
configuration, source admission, write permission, protected artifact, frontend,
deployment, spending or real deletion changed. All five R5 findings and required
independent/qualified review/human signatures remain open. The morning handoff is
already complete and is not repeated. Next verify revocation across receipt I/O and
truthful terminal-failure/recovery behavior without another save or automatic retry.

## Completed development increment: 0180 — Receipt-time revocation and terminal failure

The actual-Keycloak browser journey now revokes the projector after a successful
human receipt read but before returning that receipt to the worker. The worker must
deny before SQL access. Explicit restoration and the first authenticated dispatch
then preserve exact one-time projection and source opening. The denied direct call
is not a failed Temporal run, and two receipt reads are expected across the scenario.

A separate actual Temporal scenario verifies FAILED status, revoked observation and
retained duplicate rejection through owned runtime/connection reconstruction after
one injected activity failure. No automatic retry, new save or private error output
is allowed. These distinct execution results are in `intent/0180/EVIDENCE.md`.
Controlled retry/reset remains unimplemented; next resolve its exact current-authority,
operation/failed-run and concurrency contract. All five R5 findings, governed live
saving and independent/qualified review/human gates remain open. No production
configuration, protected artifact, frontend, deployment, spending or real deletion.

## Completed development increment: 0181 — Internal controlled projection recovery

A separate reference-linked recovery workflow now binds the original save target and
exact failed original run. It never resets, reuses or changes the original workflow
or save operation. A current original-execution guard rejects changed/missing/nonfailed
parents; the worker rechecks the guard around current projector identity and reuses
the existing exact receipt/source/SQL reconciliation. One retained recovery ID and
one bounded activity attempt reject competing/repeated recovery and recursion.

Local tests cover failure before SQL and after a commit whose acknowledgment was
lost: recovery must apply or recognize a duplicate with one exact event and unchanged
original failure. Five focused checks cover strict binding, drift, denial, overlap and
lazy current guard ordering. Exact verification: `intent/0181/EVIDENCE.md`.
The primitive is internal only; public grant/tool, owned recovery start/status client
and live configuration remain absent. No new save, workflow reset/cancellation,
protected artifact, frontend, dependency, schema, spending or deployment. All five
R5 findings and independent/qualified review/human gates remain open.

## Completed development increment: 0182 — Separately authorized owned recovery dispatch

Recovery now has separate shared command/status definitions and a fixed-plan owned
client. Current hat-free agents need `workflow.recorded-brief.recover`; recovery
observation requires its separate current read grant. Exact original-target/failed-run
binding, pre-I/O revalidation and post-read authorization keep ordinary start/save/
projection authority distinct. Without an explicitly configured service it stays
unavailable through HTTP/MCP; no runtime profile or live grant was installed.

The managed client latches one attempt before parent inspection/start, admits one
active operation, sanitizes uncertain results and drains its owned connection on
shutdown. Status never unlocks retries or proves projection success. Tests cover
closed input, grant/binding drift, lost acknowledgments, reconstruction and transport
parity; actual results are in `intent/0182/EVIDENCE.md`.

Next is the explicit optional identity-runtime recovery profile/factory and actual
disposable recovery identity integration. The original workflow/save, signed artifacts,
five R5 findings and independent/qualified review/human gates remain unchanged. No
frontend, dependency, schema, provider permission, deployment, release or spending.

## Completed development increment: 0183 — Owned authenticated recovery runtime

An exact optional `recordedRecovery` profile now pairs with an explicitly owned
`createRecoveryScheduler` factory. Organization/repository derive from the Git binding;
the full closed plan, every failed-run coordinate and derived workflow ID must match
before registration. No default recovery grant/profile or routing inference was added.

Recovery-only requests drain before scheduler/session-pool cleanup, including without
MCP. Independent resources still close if one fails, and initialization/shutdown
errors stay sanitized. The actual local integration now joins signed synthetic
recovery identity/current native Git grants through the owned API runtime to
Temporal/Git/PostgreSQL recovery, exact one-event projection and reconstruction.
Recovery and projector subjects/grant records remain separate. Full verification
and the initial nullable test-assertion correction are in `intent/0183/EVIDENCE.md`.

Next is actual disposable Keycloak recovery identity in this fixed-failed-run journey.
Synthetic issuer/receipt evidence does not establish that acceptance or live authority.
No protected artifact, frontend, dependency, schema, live profile/grant, provider access,
deployment, release, spending or real-data deletion changed. All five R5 findings and
independent/qualified review/human gates remain open.

## Completed development increment: 0184 — Actual disposable Keycloak recovery

The opt-in recovery suite now obtains actual tokens from separate disposable Keycloak
recovery/projector service accounts and validates them through production OIDC and
current native Git grants. It reuses the existing owned-runtime/Temporal/Git/SQL
recovery scenario, including wrong/swapped tokens, human-hat/substitute-grant denial,
post-receipt projector revocation before SQL, runtime reconstruction and one exact
event. All generated resources and credentials remain separately owned and disposable.

No production runtime logic changed. The new scenario still uses synthetic GitHub
responses and receipt provenance; it is not the browser-created receipt integration.
Next join recovery to that actual recorded receipt in the disposable authoring journey.
Exact verification and the fixture-only array-typing correction are in
`intent/0184/EVIDENCE.md`. No live profile/grant, protected artifact, frontend,
dependency version, schema, provider access, deployment, release, spending or real
data deletion changed. All five R5 findings and independent/qualified human gates stay open.

## Completed development increment: 0185 — Browser-created receipt recovery

A separate opt-in browser recovery mode now carries the actual browser save/status
receipt into the existing fixed-failed-run recovery path. Normal successful browser
projection remains a separate regression. Human, dispatcher, recovery and projector
use distinct disposable Keycloak actors and current native Git grants.

The original activity fails after actual receipt readback through projector
revocation before SQL. The recovery scenario checks exact failed-run binding,
swapped-token/grant denial, owned client/worker reconstruction, duplicate rejection,
one SQL event, unchanged original failure and browser readback of the saved revision
with only one Git creation. Both browser modes passed 45 checks each, standalone
Keycloak recovery passed 14, and full checks/builds passed. The initial CLI omission
and earlier decision-evidence test failure are retained in `intent/0185/EVIDENCE.md`;
no assertion was weakened. Next return to J1's governed-selection/review-provenance
and action-time-authority composition, as specified in `docs/JOURNEY-REMAINING-WORK.md`.

No production code, frontend, dependency version, schema or protected artifact changes.
GitHub responses and full gate authority remain synthetic. All five R5 findings,
approved live configuration, full governed authority and independent/qualified
review/human gates remain open. No live profile/grant, provider access, spending,
deployment, release or real-data deletion is authorized by these tests.

## Completed development increment: 0186 — Signed policy-selection evidence

J1 now has an optional selected-key signature contract and current native Git
collection for the exact policy manifest/configuration, platform revision and
decision. Independent trust/proof pins, actor/event binding, strict bounded bytes,
finite validity, current observer/head checks and role separation fail closed.
Collection rechecks proof expiry after all later policy sources. Existing profiles
without this evidence remain supported and return no selection attestation.

The held writer still denies even a valid selected-key proof with policy-satisfied
facts. Trust bootstrap, actual selector authorization, review authenticity and
complete action-time authority remain unresolved. This is an optional development
evidence profile, not a new governance requirement or approval-format migration.
Thirteen new tests and full checks/builds pass; exact verification is recorded in
`intent/0186/EVIDENCE.md`. All five R5 findings, qualified
independent protected review and human gates stay open. No live profile/key/grant,
frontend, provider access, spending, deployment or release was enabled.

## Completed development increment: 0187 — Historical/current selector grant binding

J1's optional signed selection now binds issuer/type and exact historical grant
path/revision/digest. The collector independently verifies that historical record
and the current same-path record, requiring the distinct `gate.policy.select`
capability. Exact scope, source bytes, observer/head checks, current revocation and
grant expiry after later policy reads deny instead of adopting stale permission.

Legacy subject-only proof remains readable but cannot satisfy this stronger mode.
No registered tool or live grant was added. Grant evidence stays internal; the held
writer denies even matching grants and policy-satisfied facts. Actual selector
identity, approved bootstrap, native review provenance and complete action-time
authority remain separate. All 28 focused selection tests, the held-writer regression,
adapter typecheck and full repository checks/builds passed. Verification and cache
limits are tracked in `intent/0187/EVIDENCE.md`.
All five R5 findings and independent/qualified protected review/human gates stay open.
No live profile/key/grant, protected artifact, frontend, provider access, spending,
deployment, release or real-data deletion changed.

## Completed development increment: 0188 — Selector session evidence in held saving

Optional exact historical identity proofs now bind the selector's issuer, actor kind,
session, authentication time and independent trust/proof pins to the signed selection
and both grant eras. Current native Git collection and final key expiry/revocation
checks deny substituted or stale evidence. The distinct selector domain supports
explicit agents without weakening human gate-signing identity rules.

The joined held HTTP runtime reaches policy-satisfied facts but still denies saving,
creates no Git artifact/operation, clears stale assessments after current grant
revocation and denies reconstructed runtime trust revocation. Identity claims stay
internal. All 46 focused tests, held-writer and HTTP regressions, typechecks and full
repository checks/builds passed. Evidence and cache limits are tracked in
`intent/0188/EVIDENCE.md`.
Actual service ownership/issuance, approved bootstrap, native review provenance and
complete action-time authority remain separate. All five R5 findings and qualified
independent protected review/human gates stay open. No live profile/key/grant,
protected artifact, frontend, provider access, spending, deployment, release or
real-data deletion changed.

## Completed development increment: 0189 — Direct review-record workspace

The production workspace now has a direct read-only review entry point. Explicit
discovery lists permitted exact Brief revisions in bounded pages; a selected source
opens its existing decision/evidence inspection without first opening the full Brief
dialog. Exact-source links remain available. Recorded claims never become assigned
work, urgency, lifecycle state, verified approval or a write action.

Current readers, curation and authentication are reused. Failure, expiry, hiding,
navigation and clear remove retained sources; late reads cannot restore them.
Unique decision-section IDs support concurrent library/review rendering. Pink/orange
tokens and responsive list styling are preserved. All 45 enhanced browser checks,
71 web tests, 438 repository controls and full checks/builds passed. Desktop/mobile
screenshots were inspected. The two earlier dialog-timing test failures and corrected
ordering are retained in the evidence. Usage: `docs/REVIEW-WORKSPACE.md`. Verification is recorded in
`intent/0189/EVIDENCE.md`. No live grant/provider, protected artifact, spending,
deployment, release or real-data deletion changed. All five R5 findings and qualified
independent protected review/human gates remain open.

## Completed development increment: 0190 — Exact-revision lifecycle source coverage

A separately granted read-only query now checks the selected Brief and its fixed
Spec, Exam and Plan siblings at one exact commit. It reuses current identity,
curation and byte-verified projection reads, with at most four reads and only
fingerprints in the returned inventory. Unconfigured paths are never read;
unavailable exact-revision projections are not misreported as missing Git files.
Corruption, substituted scope/revisions and revoked access deny the whole response.

Shared HTTP/MCP discovery and dispatch expose the same bounded contract. Actual
disposable PostgreSQL checks verify RLS, read-only role, newer-revision rejection
and current grant denial. The guide is `docs/LIFECYCLE-SOURCE-COVERAGE.md`;
verification details and initial test corrections are in `intent/0190/EVIDENCE.md`.
All 11 focused cases, 35 PostgreSQL integration checks, HTTP/MCP parity and the full
repository checks/builds passed, including 121 registry and 109 API tests.

This is J3 backend source inventory, not its authoritative lifecycle/decision-input
contract or a connected board. Stage stays unknown and gate/write flags stay false,
even when all artifacts are projected. No UI, live grants/curation, protected
artifact, provider access, spending, deployment, release or real-data deletion
changed. All five R5 findings and qualified independent protected review/human
gates remain open.

## Completed development increment: 0191 — Supporting documents in review

The actual Next Brief dialog and direct review workspace now offer an explicit
Supporting documents check. Three responsive cards distinguish projected Spec,
Exam and Plan sources, unavailable exact-revision projections and unconfigured
paths. Available fingerprints can be expanded without fetching or rendering body
content. No stage, readiness, assignment or gate approval is inferred.

The schema-only contract has a dedicated browser export and narrow import-boundary
coverage. The display owner pins the exact Brief, rejects substituted/invalid
responses and clears fingerprints on failure, expiry, clock regression, cancellation
and page lifecycle changes. Clear/cancel restores keyboard focus; opening a Brief
or review never automatically requests this inventory. Existing pink/orange tokens,
session ownership and server grants remain in place.

Scope and verification, including the fixture isolation and mobile assertion
corrections, are recorded in `intent/0191/EVIDENCE.md`. User-facing behavior is
documented in `docs/REVIEW-WORKSPACE.md` and `docs/LIFECYCLE-SOURCE-COVERAGE.md`.
All 46 browser checks, 78 web tests, 439 repository controls and the full-check
components/final builds passed. Desktop/mobile screenshots were inspected;
responsive and automated accessibility checks passed without claiming qualified
manual acceptance.
No live grant/curation, protected artifact, dependency version, provider access,
spending, deployment, release or real-data deletion changed. All five R5 findings,
qualified independent protected review/human gates, actual lifecycle authority and
approved real-user journey acceptance remain open.

## Completed development increment: 0192 — Canonical Learn reader

The authenticated Next workspace now offers a read-only Learn reader for all eight
operational kit documents. It includes local section search, a document list,
persistent desktop outline, version/path/source fingerprints and exact Markdown.
The pink/orange visual system is retained. There are no remote source links,
images, reading-interest requests, analytics events or per-user progress storage.

The provider-free kit parser runs only during build preparation. A gitignored
intermediate is generated from the sole canonical kit; no editable copy or runtime
repository reader is introduced. Invalid UTF-8, empty/oversized or missing source,
version drift, changed fixed paths and ambiguous anchors stop generation. Kit
inputs participate in build-cache keys. Runtime start does not reread the kit.
The badge identifies checkout metadata, not an authenticated release tag.

Keyboard navigation focuses committed document/section headings; closing returns
focus to Open guide. Reading/search state clears on hiding, restoration, expiry
and clock regression. This cleanup is not secure erasure of delivered canon.
The actual browser regression found an intermittent pre-commit focus race, now
fixed using post-commit effects and covered by a component regression.

All 85 web tests and 47 real-service disposable browser checks pass. Desktop/mobile
screenshots were inspected, with responsive/200% text and automated accessibility
checks passing. Final `pnpm check` passed end to end, including 439 repository
controls and all builds. Details and earlier failed-run corrections are in
`intent/0192/EVIDENCE.md`.
User documentation is `docs/LEARN-READER.md`.

This is independent M5 reading/search groundwork, not complete intent/0004. Role
orientation ending in real actions, contextual glossary peeks, governed correction
submission, outcome instrumentation and qualified accessibility remain open.
No kit content, protected EXAM, signature, live authority/configuration, dependency
version, provider access, spending, deployment, release or real-data deletion changed.
All five R5 findings, Gate 2, live saving and approved real-user journey acceptance
remain open. A completed reading increment is not authority to enable them.

## Partial operational increment: 0193 — Persistent local sign-in bootstrap

After the user's explicit approval, an operations wrapper now starts the existing
identity composition against persistent PostgreSQL/production-mode Keycloak and
a separate Next renderer. All published services are loopback-only. Five canonical
migrations, four least-privilege roles, mandatory TLS, real account persistence,
discovery, durable PKCE login transaction and actual password form are verified.
Private credentials remain outside Git. Narrow 30-day real membership identifies
Idriss as org-admin/Product Lead/Product Designer, with session/preview/status only.

Browser-compatible certificate trust is verified; personal password setup remains pending;
completed authenticated UI acceptance has not been observed. See
`intent/0193/EVIDENCE.md` and `docs/LOCAL-WORKSPACE-SETUP.md`. The current local
credential-file boundary is not a claimed KMS/regulated deployment. The gateway
is foreground-owned, not an installed boot daemon. No existing preview or other
project's containers/volumes are removed. No machine-wide trust, runtime App permissions,
protected canon, signatures, spending or deletion authorization changed.
All five R5 findings, Gate 2, real saving and full first-journey acceptance stay open.

Verification: 443 repository controls, 109 API tests, kit/scope checks and all
type checks pass. Runtime App readback of the actual membership and unknown-user
denial pass at pushed implementation `4a39a93`; App/installation remain read-only.
This does not replace the pending intended-human browser/password acceptance.

Subsequent explicit approval installed the exact certificate in the user's login
keychain with SSL/localhost constraints. macOS verifies it, but both Chromium
browsers rejected that hostname-scoped trust entry. The user then approved a
separate localhost-only server leaf and SSL-only user trust. That replacement now
opens normally in both browsers; Sign in reaches real Keycloak. No certificate
warning was bypassed; the database certificate and write restrictions are unchanged.
See the 0193 evidence follow-up for the original failure and verified correction.

## Development increment: 0194 — Functionality-first local draft UX

Following the user's decision to defer further authentication work, the existing
Next root now offers an explicit no-sign-in UX preview. Its local draft backlog,
eight-field editor, review/correction view, title search, save/reopen and unsaved
navigation warnings make the authoring interaction testable without session expiry.
The pink/orange design is retained. This is not a second authoritative platform.

Only explicit **Save on this browser** writes temporary sample drafts. Local data
is unencrypted, profile/origin-specific and not backed up or tenant-isolated.
Validation preserves malformed/unrelated records; storage failures and detected
stale writes never report success. Removal targets one local record after confirmation.
See `docs/LOCAL-UX-PREVIEW.md` and the numbered 0194 artifacts for behavior and limits.

The actual HTTPS UI passed create → correct → local save → reload → backlog search
→ reopen with the corrected content. Unsaved guards/resume and responsive layout
were checked. Final test/build results are recorded in `intent/0194/EVIDENCE.md`.
User UX acceptance remains open.

Live authoring, session expiry, repository permissions and gate contracts are
unchanged. No provider grant, runtime GitHub write, model call, deployment, spending,
protected EXAM or signature changed. Real saving, Flight Board/Inbox, agent conversation,
J1–J6, the five R5 findings, Gate 2 and Phase 1 acceptance remain incomplete.

## Development increment: 0195 — Operating guide within the local draft flow

The local UX preview now offers Learn STEER from navigation and the Brief checklist.
It uses the same eight-document canonical reader, local search, exact source metadata
and section-focus behavior as the authenticated workspace. Returning to the originating
Brief/backlog retains the edit buffer without saving it. Reading interests are not stored.

The explicit static-kit entry has no fake identity or deadline. The authenticated
reader's session expiry, invalid/backwards clock and hide/reset rules remain tested.
No kit bytes or live identity contracts changed. The actual HTTPS browser passed
draft correction → guide search → section reading → exact unsaved correction return.
All 91 web tests, eight architecture checks, typecheck, production build and kit/scope
checks passed; see `intent/0195/EVIDENCE.md` for evidence and limits.

This advances guidance/navigation, not complete intent/0004, real GitHub saving,
actionable Inbox/Flight Board, model-backed conversation, Gate 2 or Phase 1 acceptance.
The standing implementation loop now explicitly follows the user's functionality/UX
priority, with further account setup deferred and authorization boundaries preserved.

## Development increment: 0196 — Human usability checks and safe confirmations

Actual UI QA reproduced a stale inline unsaved-discard warning that did not take
focus and allowed unrelated navigation. Discard/removal now use labelled native
modals with safe initial focus, two-way Tab wrapping, Escape cancellation and opener
restoration. The review/save toolbar stays visible during long-form scrolling;
decorative field numbers no longer pollute accessible input names.

The actual HTTPS browser passed cancellation, guide-return preservation, explicit
sample save/reload/search/reopen, and narrow-screen editor inspection. All 91 web
tests, eight architecture controls, typecheck and final build passed. See the
0196 evidence and `docs/UX-FUNCTIONALITY-REVIEW.md` for limits and a human test script.

This is preview usability verification, not completion of the agent-led interview,
real GitHub saving, actionable Flight Board/Inbox, accessibility acceptance or gates.
The user's own UX acceptance remains open. No live authority or kit content changed.

## Development increment: 0197 — Open intent instead of eight questions

The user rejected the questionnaire. New local intents now open a spacious free-text
composer, with no mandatory title or field-count checklist. Save derives a simple
label while preserving exact original text in version-2 local records. Version-1
Briefs still read without mutation; explicit save retains their structured details.
Review provides individual corrections without restoring an eight-input intake.

The actual HTTPS sample passed free-text → review → guide return → save → reload →
reopen. Narrow-screen composition was visually checked. Web tests 92/92, architecture
controls 8/8, typecheck, build and kit/scope checks passed; see 0197 evidence.

Device dictation can enter text, but live agent conversation, audio capture and
automatic Brief generation are not connected. Current user guidance now reflects
free expression and agent-led clarification as the intended experience. No protected
canon, EXAM, authorization, model usage, runtime write, deployment or spending changed.

## Development increment: 0198 — Authenticated agent-development integration

The actual signed-in workspace now has a free-text conversation component connected
to `intent.agent.develop` through the shared authenticated registry. The separate
local-preview wrapper is no longer the main-page path. Mastra and a local LiteLLM
adapter support focused questions or Brief/Spec candidates followed by a fresh-context
Test Agent Exam. Outputs remain unsigned, unexecuted and unsaved candidates.

Agents 9/9 and focused API/runtime/web/boundary checks 27/27 passed, alongside the
package checks and production build recorded in [0198 evidence](../intent/0198/EVIDENCE.md).
The HTTPS application is available. No live model calls or spending occurred.

**Live activation remains closed:** approved model budget, durable budget binding,
local LiteLLM configuration, an explicit drafting-tool grant and actual UI/model
evaluation are still needed. Durable conversation, streaming/voice, content-free
model spans, canonical evals and Git saving are not completed by this slice. See
[the actual-workflow guide](INTENT-AGENT-WORKFLOW.md) for the activation checklist.

## Development increment: 0199 — Existing-scope candidate retrieval and journey loop

The user added duplicate and included-scope checking to the required human journey,
then requested an implementation plan and continuation loop. The new
[intent journey plan](INTENT-JOURNEY-PLAN.md) is the current sequencing authority;
the existing heartbeat now follows it instead of the old local-preview priority.

`intent.overlap.check` reads permitted Brief/Spec projections, verifies exact bytes,
and returns explained lexical candidates with revision fingerprints. Missing sources,
limited/truncated search and stale catalog changes are explicit. It never reports
semantic completeness or clearance to create. Focused HTTP/overlap/boundary checks
pass 26/26; see [0199 evidence](../intent/0199/EVIDENCE.md).

The actual UI semantic review, explicit disposition, live drafting and durable bundle
save/reopen remain open. No model budget or new provider/write authority was granted.

## Development increment: 0200 — Existing-scope source review in the conversation

The actual signed-in free-text component now includes a permitted Brief/Spec scope
check. Results display source passages, exact revisions, gaps and search limits;
Spec matches link to the correct parent Brief fingerprint in the existing library.
No-match and failure states never infer newness. Changed input invalidates results.

Focused checks 23/23, web suite 100/100, registry suite, typechecks and production
build passed; see [0200 evidence](../intent/0200/EVIDENCE.md). This is tested UI wiring,
not real repository/grant configuration, semantic duplicate review or full intake
acceptance. No model calls, spend, runtime writes or gate permissions were enabled.

## Development increment: 0201 — Explicit direction with scope recheck

After reviewing scope, people can propose extending an existing intent, a linked
distinct intent or a distinct new intent, explaining why in their own words. The
component rereads authorized sources before confirming; changed fingerprints or
targets reject confirmation and preserve the explanation for retry. Proposals are
explicitly unsaved, non-authorizing and not yet consumed by drafting or saving.

Web suite 100/100 and registry suite pass, with contract and actual-component
coverage; see [0201 evidence](../intent/0201/EVIDENCE.md). Actual source configuration,
semantic assessment, durable state and server draft/save integration remain open.
No model spending, runtime writing or additional grants were activated.

## Development increment: 0202 — Reviewed direction feeds server drafting

The actual command now requires the confirmed human direction, independently reads
current scope before generation and rechecks it before releasing output. Missing
read grants, altered source/clarification and stale fingerprints cannot bypass the
preflight. Both isolated drafting roles receive the original text, exact explanation
and server-derived evidence as data. Actual UI submission requires review and
invalidates it after clarification; scope conflicts ask for re-review, not auto-retry.

Synthetic HTTP/registry/coordinator/React checks pass; see [0202 evidence](../intent/0202/EVIDENCE.md).
No live model, read-model grant, runtime write or gate was enabled. Semantic assessment,
durable budget/draft bindings, save-time atomic rechecks and real UI acceptance remain open.
