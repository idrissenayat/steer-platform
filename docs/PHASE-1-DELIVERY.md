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
