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
