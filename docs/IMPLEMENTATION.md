# STEER platform implementation

This branch implements the Phase 0 kit and a validated UX/domain prototype
toward Phase 1 against a rebuildable fixture connector. The production Phase 1
foundation is defined in `intent/0001/ARCHITECTURE.md`; its complete walking
skeleton is not yet implemented. The Gate 1-bound route is preserved in
`intent/0001/PLAN.md`. The current delivery sequence and completion boundaries
are maintained in `docs/PHASE-1-DELIVERY.md`.

The first bounded production increment now exists under `intent/0005`: a
pnpm/Turborepo workspace and Next.js App Router shell. Root `pnpm check` covers
both it and the unchanged Vite prototype. This is repository-foundation
evidence only; no provider, database, workflow, or production feature has been
claimed.

Item `intent/0006` moves the existing domain modules into `@steer/domain` and
migrates every prototype/test consumer to package imports. The package has no
runtime dependency or vendor SDK, typechecks independently under the stricter
shared baseline, and remains covered by the original characterization suite.

Item `intent/0007` adds the Hono API and Zod tool registry: one validated,
organization-scoped identity-context query, shared internal/HTTP authorization,
generated OpenAPI, bounded JSON handling and safe errors. Default startup has
no mock identity: tool calls return 401 and readiness returns 503 until real
identity and projection integration exists. Fifteen focused development tests
pass and participate in root checks. This is not a completed OIDC adapter,
data service, MCP endpoint or Gate 2 approval.

Item `intent/0008` adds a normalized OIDC adapter with RS256 verification,
pinned issuer/JWKS/audience/client, bounded token lifetime and fresh
issuer/subject/org-bound grant lookup on every request. Revoked human and agent
identities deny without waiting for token expiry. Eleven new tests pass,
including cryptographic API integration. Actual Keycloak login and the trusted
grant projection are not connected; CLI startup remains deny-all.

Item `intent/0009` adds Drizzle schema/migrations, forced organization RLS and
separate runtime privileges for the ingestion log and projection records.
Tenant context is transaction-local and scrubbed around pool reuse. Five unit
tests and eight real PostgreSQL checks pass. This is local synthetic database
evidence, not a provider-connected read model or production migration.

Item `intent/0010` adds the read-only GitHub App adapter and Git-backed current
authorization resolver. Thirteen tests verify restricted token scope,
commit/tree/blob integrity, source encoding, path modes and freshness denial.
The adapter's development tests used isolated provider responses. The separate
runtime App is installed read-only on the STEER repository. Its dedicated key
is secured outside Git; signed App/installation readbacks and a revision-bound
artifact read passed against GitHub. See `docs/GITHUB-RUNTIME-APP.md` for exact
scope and evidence. Default API startup and browser login are not yet wired
to the live provider; the read-only smoke check is not end-to-end completion.

Item `intent/0011` adds atomic, idempotent ingestion and a single-artifact
reconciler. Four new unit tests and three new real PostgreSQL checks pass for
duplicates, CAS conflicts, stale delivery and source-based repair. Full-repo
replay, durable scheduling/webhooks and live provider composition remain open.

Item `intent/0012` corrects domain imports for native Node and adds structural
package-boundary/native-import checks. The complete repository suite and builds
pass under isolated Node 24.20.0; local `.node-version` records that version.
This closes the prior local runtime-verification gap, not the remaining
provider/gate integration requirements.

Item `intent/0013` verifies the selected Keycloak 26.7.3 service-account profile
against real local HTTPS/JWKS and the shared Hono boundary. Six integration
check groups pass with synthetic identities and scoped certificate trust;
`pnpm test:identity:integration` reruns the disposable harness. No production
HTTPS rule was relaxed. Human login and Git-backed real membership remain
unconnected; the CLI stays deny-all and readiness remains 503.

Item `intent/0014` adds the server-side browser sign-in adapter: confidential
authorization-code/S256 PKCE, browser-bound one-use transactions, ID/access
token pairing, opaque secure cookies, short-lived sessions, fresh grants and
local logout. Eleven synthetic cryptographic/concurrency tests pass. No HTTP
route or durable session store is enabled. Refresh and provider-wide logout
remain deferred; see the item's Evidence for the required route/storage controls.

Item `intent/0015` implements that storage contract in PostgreSQL: dedicated
pre-auth namespace/role, FORCE RLS, AES-256-GCM with explicit versioned keyring,
five-minute maximum TTL, bounded insert capacity, atomic one-use consumption,
cross-process persistence and scoped local logout. Unit and real disposable
PostgreSQL checks pass. Browser routes remain disabled; real runtime database,
key-provider configuration, trusted membership and human-code integration are
not supplied by this increment. No operational purge/deployment is authorized.

Item `intent/0016` adds explicitly composed Hono browser routes and cookie
authentication through the existing tool boundary. Fixed HTTPS origin,
same-origin POST/Fetch-Metadata checks, one-use callback handling, secure
separate cookies, fixed redirects and generic no-store/no-referrer responses
are covered by nine new tests using signed synthetic provider tokens. The
composed OpenAPI extends the registry descriptions without duplicating schemas.
The default CLI still exposes no auth routes. Real browser/Keycloak human-code
verification, trusted runtime wiring and ingress limits remain unfinished.

Item `intent/0017` verifies the actual Keycloak human form and authorization-code
exchange through that HTTP boundary using generated identities. The minimal
client needed an explicit access-token subject mapper; STEER's required-subject
validation was preserved. The provider harness now covers six agent and six
human-flow check groups. This is a scoped HTTPS form driver, not browser-engine
evidence. See `docs/KEYCLOAK-IDENTITY-PROFILE.md` for the required profile and
remaining combined-storage, browser, membership and runtime prerequisites.

Item `intent/0018` assembles the real Keycloak HTTP flow with encrypted PostgreSQL
sessions in a separate opt-in harness (`pnpm test:auth:integration`). Thirteen
provider/storage groups cover the existing real-provider checks plus ciphertext
inspection, independent app/store reconstruction and wrong-key denial. Concurrent
callbacks across two app instances produce one exchange; logout denies both
instances. Only test/dev dependencies were added. Browser-engine/real-ingress
behavior, authoritative membership and operational configuration remain open.

Item `intent/0019` exercises a real isolated Chromium engine against loopback
HTTPS STEER/Keycloak and encrypted PostgreSQL (`pnpm test:auth:browser`). Seven
browser groups cover the scoped local certificate exception/negative certificate,
native login/callback, secure host-only HttpOnly/Lax cookies, cross-site logout
denial, app/store reconstruction with fresh revocation, replay and native logout.
The first browser run caught a fixture CSP redirect restriction; the form page
now explicitly allows the configured IdP origin. No production Next.js screen,
public CA trust, other browser engine or real membership is claimed by this test.

## Implemented prototype and kit behavior

- deterministic artifact-chain projection and dropped-event reconciliation;
- role-aware decision inbox with conditional specialist seats and SLA state;
- Gate 1 intent/spec comparison, Gate 2 exam review, and Gate 3 evidence view;
- revision-safe sign and send-back actions that bind identity and sequence;
- continuous work-item thread from brief through evidence and signatures;
- guided non-engineer brief authoring with deterministic validation/revision;
- an interview-first originator experience with rendered draft correction,
  context-resolved system names, and no raw artifact exposure;
- a three-surface role home ordered as decision inbox, triggered candidates,
  and ambient flight, with a person-level WIP gate across pods and hats;
- a conversation-first setup agent that proposes organization, portfolio,
  product, pod, all explicit human hats, a tenant-scoped agent identity, Stack
  Pack, readiness findings, and the applicable signer constraint for one human
  correction-and-signature moment;
- versioned organization policy and declaration templates, default-closed
  inheritance enforcement, recorded accountability handover, and tenant-scope
  checks for agent identities and evidence;
- commercial and regulated minimum-distinct-signer policy, including the
  fresh-context Critic, zero-unresolved-findings, and separate-session Gate 3
  second-look requirements;
- a concrete TypeScript/React Stack Pack and a five-part repository-readiness
  scan whose findings draft on-ramp briefs;
- greenfield outcome-contract state and mission-fit-as-unscored behavior until
  a mission brief exists;
- an in-place rendered intent-detail panel with revision-safe actions,
  provenance evidence, clusters, history, and outcome instrumentation;
- one versioned, privacy-checked instrumentation contract for backlog actions,
  deliberate source exits, Learn navigation, first login, and first completed
  action, with deterministic baseline computation and minimum-sample refusal;
- a repository-sourced Learn STEER hub with version-aligned canon pages,
  section search, glossary peeks, stateless role orientations, and agent slices;
- a live scope check for one outcome, one exam, and one coherent shape, plus
  plan-sprawl alarms and split guidance;
- P85 cycle-time forecasting and aging-band domain functions;
- pilot telemetry for wait time, centralization, and human effort;
- Phase 0 templates, gate policy, guardrails, bands, metrics, culture, seams,
  and an EXAM-protection hook;
- webhook HMAC/replay controls, scope audit, log scrub, and ephemeral assistant
  retention control;
- automated structural accessibility and performance checks; and
- a self-hosted static container with security headers and health endpoint.

The source for this behavior is `STEER-Sizing-and-Scoping.docx` (Practice Note
1). Its rules are mirrored in `kit/policy/sizing.json` so the platform and the
adoption kit enforce the same operating model.

`STEER-Providing-Intent.docx` (Practice Note 2) defines the intent interaction
model. Its no-invention, ambiguity-surfacing, rendered-draft, correction, and
identity-binding rules are mirrored in `kit/policy/intent.json` and the guided
interview domain.

`STEER-The-Three-Surfaces.docx` (Practice Note 3) defines the intent/work-item
pull boundary and protected attention hierarchy. Its candidate controls,
measurable-today rule, decay record, WIP refusal, and notification boundaries
are mirrored in `kit/policy/surfaces.json` and the intent-backlog domain.

`STEER-Operating-Model.docx` now integrates the v3.2 agent-first assurance model. Its
organization topology, solo and agent-first commitments, repository model,
policy inheritance, person-level capacity, signer rules, Stack Packs,
readiness scan, greenfield state, handover, isolation, and first-run flow are
mirrored in `kit/policy/organization.json`, the organization domain, the setup
agent experience, domain-agent review routing, and the v3.2 Learn corpus.

All six root Word documents and their Learn projections are aligned to
Framework v3.2. `DOCUMENTATION-MAP.md` records the authority order, the v3.2
rule-to-implementation trace, and the synchronization procedure for future
doctrine changes.

## Current boundary

The supplied item chains are preserved under `intent/0001` through
`intent/0004`; the revised 0001 Brief and Spec replace their prior revisions
byte-for-byte. `kit/metrics/events.schema.json` is the operating event
contract for item 0002; `kit/metrics/baselines.json` deliberately records the
production baselines as pending instead of substituting fixture figures.

The browser preview uses the fixture connector and pilot identities. It proves
the interaction and domain contracts without requesting credentials or making
external writes. Production completion requires Gate 2 and Gate 3 records,
OIDC configuration, a live code-host/CI connector, triggered specialist manual
accessibility evidence, and pilot outcome data. See `INTENT-COMPLETION.md`.

Gate 1 is recorded at `intent/0001/signatures/gate-1.json` for the exact
`281c9736816ec22fa1209b060b58fa8164519f7c` artifact snapshot. It approves the
GitHub App, normalized-Keycloak OIDC, commercial provider-recorded approval,
regulated signed-log, self-hosted PostHog, and portable-container decisions.
It does not authorize spending: paid infrastructure requires a separate human
approval and may not exceed the stated pilot ceiling.

The first fresh-context Gate 2 Critic returned HOLD / SEND BACK. The authorized
Test Agent GitHub App has published a replacement canonical Exam at
`118302e080598a147294e32d40cf5296763c8cc4` that binds the accepted
Gate 1 snapshot, preserves the supplied Exam as historical source, incorporates
all original and walking-skeleton cases, freezes reproducibility requirements,
and adds complete tenancy, signature, outcome, and specialist matrices. The
actor-bound GitHub workflow, deny-by-default author policy, CODEOWNERS map, and
regression tests are operational on protected `main`. Live pull requests
against the exact numbered Exam verified that the human Builder is rejected,
the Test Agent App is accepted by CI, and one human CODEOWNER approval is still
required. This control evidence is not a Gate 2 signature. Seven domain-agent
review packets are bound under `intent/0001/reviews/domain`.

Current status supersedes that historical first-review snapshot: the canonical
Exam was subsequently incorporated at `cd913b96a14323ef318749e35a79e1741cf91c70`.
HR-01-R2 acceptance and ratification are recorded; neither signs Gate 2.
The latest round-three R5 preflight at
`intent/0001/reviews/domain/round-3/remediation/preflight-critic-r5.json`
returned SEND BACK with three blockers and two majors. The candidate package
was published at `640bd29`, but is not ready for protected incorporation.
The remaining corrections concern lifecycle authorization, human/provider
binding, migration authorization/replay, multi-line cost reconciliation and
Unicode phone normalization. These five corrections, protected incorporation,
exact-revision review and the applicable qualified human ruling remain before
a Gate 2 decision. Historical review passes do not supersede this send-back.

Item `intent/0020` composes the Git authorization resolver into both browser and
bearer authentication. Actual temporary Git commits drive revocation through the
Chromium/Keycloak/encrypted-Postgres harness. Source outages, moving heads,
integrity failures and missing/duplicate/cross-organization records deny without
stale fallback. The new factory cannot accept a substitute grant resolver.
This is synthetic membership evidence, not configuration of real access.

Item `intent/0021` adds per-instance admission, bounded body consumption and
explicit local HTTP parser/receive/socket limits. Actual work retains its
concurrency lease until it settles; overload and stalled streams fail safely.
Limits and production gaps are recorded in `docs/API-RESOURCE-LIMITS.md`. This
does not provide distributed abuse prevention or database execution deadlines.

Item `intent/0022` adds strict runtime database transport/role configuration,
bounded connections and queued acquisitions, and server-side query/lock/idle
transaction limits. Real PostgreSQL tests prove cancellation and recovery;
assembled browser/provider authentication now uses the bounded pool. See
`docs/DATABASE-RUNTIME-LIMITS.md` for the remaining network, total-transaction,
shutdown and production TLS boundaries.

Item `intent/0023` handles checked-out client errors, explicit graceful/forced pool
shutdown, and typed unknown business COMMIT outcomes. A real loopback fault relay
drops the acknowledgement of an actually committed synthetic row; no automatic
retry occurs. This is database lifecycle evidence, not complete service wiring
or proactive detection of every stalled network connection.

Item `intent/0024` composes the Git-backed identity API with managed session
resources and explicit request/resource shutdown state. A closed pool alone
cannot report a stopped service while requests remain active. The Chromium
integration uses this service without adding database imports to route/service
logic. Details: `docs/IDENTITY-SERVICE-LIFECYCLE.md`; bootstrap follows in 0025.

Item `intent/0025` adds actual runtime assembly from separate strict profile and
secret inputs. The composition root alone may import the data adapter and Zod;
routes/services retain their prior dependency restrictions. The bootstrap is
lazy and opens no listener or real provider connection automatically. A synthetic
PostgreSQL login transaction proves real storage wiring. Details and remaining
listener/secret-loading requirements: `docs/IDENTITY-RUNTIME-BOOTSTRAP.md`.

Item `intent/0026` replaces the Next.js foundation landing page with the requested
pink/orange native sign-in surface. It is disabled unless its public view profile
is explicit; no API or account access is enabled by those flags. Actual production
Next.js rendering now participates in the browser authentication harness, with
responsive/keyboard/automated accessibility checks and reviewed screenshots.
See `docs/NATIVE-SIGN-IN-UI.md`; full product UI and real listener remain separate.

Item `intent/0027` promotes native root/static and identity routing into shared
API production source. Fixed origins, credential-free renderer requests, bounded
responses/deadlines and existing admission controls replace the test-only proxy.
The actual Next.js browser suite now uses this gateway. It does not start a
public listener, load real secrets or complete lifecycle/ingress composition.
See `docs/IDENTITY-GATEWAY.md`.

Item `intent/0028` adds an explicit strict local profile/secret entry point that
composes the real identity runtime and gateway with an owned loopback HTTPS
listener. The browser flow uses that production-source listener, including
observed connection refusal after shutdown. Real credential loading and public
deployment remain disabled/separate. See `docs/LOCAL-IDENTITY-RUNTIME.md`.

Item `intent/0029` adds the first authenticated workspace session view, not full
product parity. A same-origin cookie query invokes the canonical session.context
tool; a strict credential-free projection reaches the private Next.js renderer.
Current account/organization/hats/expiry, refresh and local sign-out are real;
the three operating surfaces are explicitly not connected. Browser revocation,
source-failure, accessibility and visual checks are recorded. See
`docs/AUTHENTICATED-WORKSPACE.md`.

Item `intent/0030` adds encrypted secret-provider loading and a portable wrapped-
data-key interface, with file/digest/permission and authenticated-encryption
checks. Explicit local startup can consume a pinned encrypted credential bundle;
actual isolated TLS/Postgres verification proves it works after input-buffer
cleanup. No existing credential, KMS or public service was activated. See
`docs/ENCRYPTED-SECRETS.md`.

Item `intent/0031` connects an exact-revision artifact projection query through
the shared registry, rechecks current authorization after asynchronous I/O and
uses a curated read-only tenant adapter. Explicit runtime configuration adds a
separate bounded read pool. Synthetic Git ingestion through actual PostgreSQL
and the authenticated browser is verified; cached bytes are not Git authority.
See `docs/ARTIFACT-PROJECTION-READS.md`.

Item `intent/0032` adds revision-pinned, bounded explicit-manifest reconciliation,
honest partial failures and an opt-in one-shot projector runtime. Fresh agent
authority, overlap refusal and owned shutdown are tested. Two-artifact synthetic
Git/Postgres replay and repair feed the authenticated browser fixture without
rewriting history. This is not automatic whole-repository discovery or a durable
worker. See `docs/REPOSITORY-RECONCILIATION.md`.

Item `intent/0033` adds exact-revision GitHub tree inventory with explicit roots/
filenames, complete-response bounds and unsafe-file rejection. Inventory descriptors
feed reconciliation without revision substitution; runtime selection is opt-in
and mutually exclusive with paths. Actual synthetic Git discovery feeds the
Postgres/browser fixture. See `docs/REPOSITORY-INVENTORY.md` for limits.

Item `intent/0034` adds an official MCP SDK v2 stateless Streamable HTTP profile,
pinned to protocol 2026-07-28, serving the existing registry and safe tool results.
Fixed Git-backed OIDC authority and actual TLS/Keycloak/Git client verification
are implemented. Default CLI mounting remains disabled;
see `docs/MCP-TRANSPORT.md` and the component lock `docs/stack/mcp.json`.

Item `intent/0035` adds opt-in combined MCP runtime/gateway mounting, an explicit
separate client allowlist and shared-resource shutdown coordination. See
`docs/COMBINED-MCP-RUNTIME.md` for configuration and evidence boundaries.

Item `intent/0036` adds the signed architecture's worker package with pinned
Temporal SDKs, deterministic tenant/repository/item IDs, bounded durable timers,
fixed activity binding and minimal history receipts. Actual local-server testing
recreates worker instances and replays history without repeating acknowledged
activities. The activity backend is synthetic; actual projection composition
remains next. See `docs/TEMPORAL-WORKFLOWS.md`.

Item `intent/0037` composes actual Git/PostgreSQL projection work with Temporal
activities and shares authorized job lifecycle with the API runtime. Exact-byte
readback, duplicate-safe resume/replay, repair and committed revocation are
verified with disposable services and synthetic identity. See
`docs/WORKER-PROJECTION-RUNTIME.md` for limits.

Item `intent/0038` adds a lazy worker-service lifecycle and actual separate-
process SIGKILL/restart during a durable timer. The same run resumes without
duplicate ingestion; a fresh process observes Git revocation committed while
its predecessor was dead. Active-activity/fleet and server restore are separate
gaps. See `docs/WORKER-PROCESS-RECOVERY.md`.

Item `intent/0039` adds shared authorized reconciliation start/status tools and
a fixed-routing Temporal client adapter. Fresh grants, bounded scope/caps,
post-I/O status checks and explicit uncertain mutation receipts prevent caller
routing and false rollback claims. HTTP/MCP parity and real local Temporal
dispatch pass; default runtime activation remains disabled. See
`docs/AUTHORIZED-SCHEDULING.md` for composition and remaining cluster boundaries.

Item `intent/0040` binds the optional scheduler into the identity runtime through
an explicit matched profile/factory. Its managed adapter bounds actual operations
and closes only after request/operation drain. Real isolated Temporal connection
closure is verified without stopping the server or its other client. No live
cluster settings are activated. See `docs/MANAGED-SCHEDULER-RUNTIME.md`.

Item `intent/0041` adds a bounded revision-bound gate-observation workflow with
fixed source-reader binding, durable checkpoints and explicit superseded,
decision-recorded or exhausted outcomes. No outcome is approval. Actual Temporal
restart/replay tests use a synthetic observer; canonical Git/provider verification
and complete event cursors remain open. See `docs/GATE-WATCH-WORKFLOWS.md`.

Item `intent/0042` binds gate observation to current Git source with fresh agent
authority, exact artifact-set/blob checks, bounded inventory and matching record
provenance. Actual Git/Temporal record commit and revocation/recreation tests pass.
Record provenance is not signer/decision-policy verification; see
`docs/GIT-GATE-OBSERVATION.md` for that explicit boundary.

Item `intent/0043` adds strict internal gate-policy evaluation of normalized
facts, including complete human seats, session/chronology and independent domain
assurance. Every result still requires source verification. It is not a signing
tool or authenticated canonical verifier; see `docs/GATE-POLICY-EVALUATION.md`.

Item `intent/0044` adds a transactional projection-change feed with forced tenant
RLS, repository commit ordering, bounded reference-only pages and generation-bound
decimal cursors. Actual PostgreSQL tests prove later commits cannot overtake a
held stream position, rollback consumes no committed position, and missing events
force reset. No public streaming endpoint or canonical approval log is enabled;
see `docs/PROJECTION-CHANGE-FEED.md` for snapshot and authority boundaries.

Item `intent/0045` exposes the derived feed through the shared registry, HTTP and
MCP, with fixed scope, explicit grants, fresh pre/post authorization and strict
page/reset validation. The identity runtime explicitly opts in to the existing
read pool. Actual browser/Keycloak/Git/PostgreSQL paging and grant-revocation
checks pass; no initial snapshot or feed UI is claimed. See
`docs/AUTHORIZED-PROJECTION-FEED.md`.

Item `intent/0046` adds a complete bounded reference snapshot and its matching
change cursor in one PostgreSQL statement, with a shared authorized HTTP/MCP
query. Actual concurrency checks verify projection commits and checkpoint move
together; inventories above 1000 records fail instead of truncating. This is a
derived reference view, not full business/UI parity or current Git authority.
See `docs/PROJECTION-SNAPSHOT.md`.

Item `intent/0047` adds a portable bounded reference consumer with atomic page/
cursor publication, immutable views, explicit reset/failure clearing and truthful
reentrant shutdown. Actual MCP/Keycloak/Git/PostgreSQL verification clears its
cache after committed revocation and reloads after restored synthetic access.
No browser transport, timer, UI or durable client cache is enabled. See
`docs/PROJECTION-CONSUMER.md`.

Item `intent/0048` adds gateway-owned per-page CSP nonces for the already-dynamic
Next.js root. Actual Chromium verifies framework execution, nonce freshness and
blocked forged parser-inserted scripts/handlers. Existing forms, authentication,
revocation and accessibility checks pass. This is a script-execution prerequisite,
not full interactive work surfaces. See `docs/NONCE-SCRIPT-BOUNDARY.md`.

Item `intent/0049` connects a read-only reference panel to the shared consumer and
same-origin cookie-authenticated HTTP tools. Explicit repository selection never
grants access; failures, scope changes and display lifecycle clear old references.
Only keys/fingerprints are displayed, not invented intent states or approvals.
See `docs/BROWSER-REFERENCES.md` and the increment's verification evidence.

Item `intent/0050` adds a bounded source-faithful Brief document model. It preserves
all sections and source offsets, explicitly reports structural omissions/ambiguity,
and never interprets author/status metadata as verified authority. Actual kit and
canonical source tests accompany it. Authenticated Brief read tools and rendered
detail remain next; see `docs/BRIEF-DOCUMENT-MODEL.md`.

Item `intent/0051` exposes that source model through intent.brief.read, requiring
both explicit Brief and curated-content grants. It verifies selected revision/
fingerprint and source bytes, then rechecks both grants before returning the
same structural result through HTTP/MCP. No catalog, status inference or new live
profile is enabled. See `docs/AUTHENTICATED-BRIEF-READS.md`.

Item `intent/0052` adds a bounded curated Brief catalog on the same read-only
database pool. Current explicit grants and exact path/key mapping restrict
metadata to permitted Briefs; no content/status or unrelated inventory is exposed.
Real PostgreSQL and agent/browser discovery tests pass. No new privilege, migration
or live profile is introduced. See `docs/BRIEF-CATALOG.md`.

The foundation already includes the pnpm/Turborepo workspace, Next.js shell,
provider-free domain, stateless tool API, normalized OIDC/browser authentication,
read-only GitHub adapter, Postgres/Drizzle/RLS ingestion and encrypted sessions.
Still to be built or composed: business tools beyond session context and curated
artifact reads and bounded reconciliation scheduling, MCP OAuth onboarding,
large-repository inventory/partitioning and
source-removal/rollback policy beyond bounded discovery, Temporal gate/cursor
composition and active-activity/fleet/server recovery,
version-pinned Mastra adapter, LiteLLM gateway, tenant-scoped evidence storage,
production product analytics, an approved live secret-manager binding, runtime/ingress
configuration, full authenticated workspace UI and the thirteen-case architecture walking
skeleton. Existing increment evidence does not complete these remaining services.

Item `intent/0053` connects trusted runtime repository display context to a
read-only Brief library in the authenticated Next.js workspace. Canonical
portable contracts and bounded same-origin transport support discovery and
exact-reference selection. A rendered side panel keeps source text inert,
supports keyboard dismissal/focus return and clears content after failed access,
page hiding/navigation or display expiry. The manual reference inspector now
lives under Developer diagnostics. See `docs/AUTHENTICATED-BRIEF-LIBRARY.md`
and `intent/0053/EVIDENCE.md` for verification and limitations. This is not full
intent/0003 parity: deep links, judgment ordering, provenance/history, measured
source exits, lifecycle/actions and manual accessibility review remain open.

Item `intent/0054` adds exact-reference Brief locations and native browser history.
Back/Forward/reload discover current permitted references and read only the same
scope/path/revision/fingerprint. Invalid/foreign/stale links do not issue a detail
read or select a substitute. Closing returns to the root without following an
untrusted previous history entry. Reference metadata can persist in a user-copied
URL/history; source bodies and credentials are never stored there. See
`intent/0054/EVIDENCE.md` and `docs/AUTHENTICATED-BRIEF-LIBRARY.md`.

Item `intent/0055` adds conservative review ordering to the rendered Brief.
Whole parsed section groups move without changing source bytes or the selected
revision. Unknown content stays present; ambiguous/reference-bearing documents
retain their original order with an explanatory note. No semantic badge, gate
route, provenance or history is inferred from prose. See `intent/0055/EVIDENCE.md`
and the authenticated Brief library guide. Governed business actions and trusted
business-state/history prerequisites remain open, as do all five R5 findings.

Item `intent/0056` addresses the exact R5-005 Unicode-phone counterexample with a
portable Unicode 17 detector and a policy-bound offline graph correction. The
unchanged frozen oracle must pass before the additional phone checks; original
source/proof bytes remain intact. This is a candidate correction, not a new
sanitizer attestation or formal finding closure. Remaining R5-001–004 fixes,
independent review, protected incorporation and gates remain open. See
`intent/0056/EVIDENCE.md`; no production route or analytics sink is enabled.

Item `intent/0057` adds the R5-004 multi-line cost correction candidate. Every
ledger/usage/invoice line requires exactly one signed variance/successor pair;
all amount/time/reference checks precede the original complete cost verification
and final aggregate. Array ordering does not confer meaning or allow omissions.
No spending or production route is enabled. R5-004/005 have test-backed candidates;
all five findings remain formally open. R5-002/001/003 corrections and independent
complete-package review are next. See `intent/0057/EVIDENCE.md`.

Item `intent/0058` implements the full human-authority portion of R5-002 with a
no-default-time shared verifier. Provider proofs bind all authority fields except
the three circular digest/signature fields and must match an independently
selected anchor at recorded/evaluation time. Exact frozen counterexamples and all
17 prior authority cases are tested. This is not full R5-002 closure: other public
candidate oracles still need time-rule integration, followed by independent
complete-package review. See `intent/0058/EVIDENCE.md`; no live route is enabled.

Item `intent/0059` validates current and historical lifecycle events with the same
closed schema and timed provider-proof checks. The exact ignored-history-proof
counterexample is blocked; all 27 event types remain supported. This is zero-
effect validation, not lifecycle disposition authority or history-completeness
proof. Shared lifecycle/migration actions and graph composition are next. The
current per-finding status is in `docs/GATE-2-CORRECTIONS.md`; all five findings
remain formally open. See `intent/0059/EVIDENCE.md`.

Item `intent/0060` adds the shared protected-action successor: the Exam-candidate
commit and six lifecycle/migration actions traverse one deny-by-default verifier.
It binds an independently installed target/policy/scope and exact resource grants
to actor credentials, delegation, assignment, authority and signed replay/CAS,
using explicit times for all ten records. Candidate success has zero effects.
The full lifecycle/migration graph must still consume it and validate the actual
human/raw/plan evidence and exact inputs before effect-specific processing.
No production route or atomic execution is enabled. See `intent/0060/EVIDENCE.md`.

Item `intent/0061` composes the actual 0058/0059/0060 verifiers into a closed
lifecycle evidence graph. Every provider copy and final tombstone require their
own human and shared authorization. Exact inventory/hold state, copy receipts,
aggregate and tombstone proof are checked with explicit times; raw erasure must
finish within 60 seconds, not begin after that deadline. Tested two-provider
immediate/raw positives and replay return zero effects. This is not execution
or full future-retention coverage. See `intent/0061/EVIDENCE.md` for boundaries.

Item `intent/0062` composes migration plan/state, backup/rehearsal/rollback proofs
and actual shared authorization for expand, backfill and contract. The bounded
model compares supplied post-data against the approved transformation, preserves
six governance-source payloads byte-for-byte, and requires full human cleanup
evidence for contract. Provider snapshots, authoritative journal and final result
bind the same request and exact replay result. Tests cover all three phases,
replay, interruptions and rollback with zero execution effects. This is not a
live SQL runner or full compatibility/concurrency matrix. See `intent/0062/EVIDENCE.md`.

Item `intent/0063` composes the 0056 privacy and 0057 plural reconciliation
corrections with explicit 0058 time verification of every signed record, including
the nested spending-provider proof. Independent observation binds the exact input
and complete derived inventory. Historical records without issuance fields use
an explicit observed-as-of rule, not fabricated creation times. Current privacy
grants, signed event times, original Unicode detection and all-line lineage remain
mandatory. This offline audit does not authorize corpus use or spending. Other
cost/spend/recovery timing and independent/protected review remain open. See
`intent/0063/SPEC.md` and `intent/0063/EVIDENCE.md`.

Item `intent/0064` adds explicit-time audit composition for the remaining cost
modes and spending-decision evidence. Every authorization link/nested provider
proof, consumer, replay/head/reservation and cost/provider row is checked, with
independent exact-byte observation. Forecast/spend requires current authority;
invoice/aggregate remains a historical audit. Replay cannot bypass reservation
time checks. Success is VERIFIED with executionAuthorized false, never a payment
or executable authorization. The original arithmetic/lineage semantics remain
mandatory; full money runtime semantics and recovery/other public timing remain
open. See `intent/0064/SPEC.md` and `intent/0064/EVIDENCE.md`.

Item `intent/0065` composes all supplied recovery signatures with explicit 0058
times and a separate observer anchor. Exact original bytes, complete inventory,
native identity/journal times and an independently attested recovery interval
are checked before original recovery semantics. The one-hour RTO cannot be
inflated by a caller. Old source history is distinct from recovery duration;
strict encoded-byte validation preserves binary Git objects. Pre-ack outcomes
remain unknown and every result has zero effects/execution authority. The bounded
model is not a real restore service. See `intent/0065/SPEC.md` and `EVIDENCE.md`.

Item `intent/0066` covers the original public authorization oracle with all ten
signatures timed, current credential/assignment/authority/store bounds and exact
independent observation. It recomputes the immutable request digest before
replay, closing an old early-return gap. It deliberately returns zero effects
instead of the old model's hypothetical write counters. This is an audit, not a
Git capability or a replacement for 0060's shared contract. See
`intent/0066/SPEC.md` and `intent/0066/EVIDENCE.md`.

Item `intent/0067` adds explicit-time checks to all six accessibility signatures
and bounded chronology to every raw row, retaining the complete original matrix
and byte-digest validation. Independent provider proof binds the summary/batch
and their identity/qualification/assignment references. Full synthetic coverage
is explicitly not a human audit. Its public-oracle inventory maps all ten signed
source functions to real successor exports/tests and records preserved historical
helpers separately. This completes the named inventory, not independent or full
normative acceptance. See `intent/0067/SPEC.md` and `intent/0067/EVIDENCE.md`.

Item `intent/0068` corrects two source-policy mismatches in 0061: rebuildable
records select the earliest supersession/rebuild event, and provenance requires
retirement plus every verified derived-record deletion, not item closure. A
closed current provider-signed derived manifest is pinned by authority-signed
state and the full action input. The candidate policy digest changes; old inputs
are not silently upgraded. Tests exercise all 16 current class outcomes, complete
parent-capped dispositions/replay, compound selection, hold histories and up to
128 derived completions. This is not complete future-expiry disposition coverage.
Frozen policy/table files are preserved. See `intent/0068/SPEC.md` and `EVIDENCE.md`.

Item `intent/0069` adds exact BigInt nanosecond instants, formatting and retention
arithmetic. The shared signature verifier uses precise half-open key windows;
0061's boundary helper preserves fractions across calendar years and parent caps.
All affected candidate policies bind the explicit time contract. Whole-second
compatibility remains, and legacy business/event guards still reject fractional
graphs without rounding. This is not full graph-level nanosecond support or
permission to validate expired historical keys. See `intent/0069/SPEC.md`.

Item `intent/0070` adopts exact time through the human/event/shared-action/
lifecycle composition, using explicit in-memory successor schemas with source
and successor digests. Complete first/replay graphs pass at nanosecond precision;
one-nanosecond deadline/cap violations deny. Earliest credential expiry is selected
by instant, not lexical order. Frozen files/keys remain unchanged. This does not
enable fractional business evidence in all other audit/migration paths or close
full raw-grant/retention requirements. See `intent/0070/SPEC.md` and `EVIDENCE.md`.

Item `intent/0071` replaces blanket equal-time rejection with the signed policy's
ranked event order. Unranked ties remain denied. UUID identity is case-insensitive
for replay detection without rewriting signed bytes. All 200 ranked type/UUID
pairings and full equal-time hold composition are tested. Ordinary signatures,
provider proof and full action checks are not bypassed. See `intent/0071/SPEC.md`.

Item `intent/0072` expands the raw composed fixture to three distinct key tuples
across two providers, four complete actions and all six copy-envelope orders.
Every copy's human/shared proof omissions, transplants, partial receipts and
one-nanosecond deadline violation deny. This is synthetic coverage, not actual
erasure or a production rule to create more copies. At that increment, the raw
path still required post-terminal approval. The successor protocol specified in
`intent/0072/PLAN.md` is now implemented as offline candidates 0073/0074; formal
review and full recovery remain open.

Item `intent/0073` adds an offline pre-terminal raw grant verifier. One complete
human grant binds the exact prepared tuples and trusted lifecycle context before
the named terminal, without signing future state or receipts. Backdated validity,
late enrollment, incomplete proof and substituted bindings deny. Success remains
zero-effect and explicitly does not authorize execution. Current batch
consumption and lifecycle composition are separate from this helper and are
integrated in 0074. See `intent/0073/PLAN.md` for the original handoff.

Item `intent/0074` requires explicit raw-v2 in the actual lifecycle candidate.
One pre-terminal grant supplies all exact per-copy authorities; current inventory,
holds/references, complete shared actions and timely receipts remain mandatory.
Full original winning and current batch chains bind every request, preventing a
committed-status surrogate or substituted plan. Copy replay can finish a separate
first tombstone; mixed partial-copy retries deny. This is offline evidence, not
an atomic store or live erasure worker. Durable partial-copy recovery with fresh
current-state checks is extended by the bounded 0075 candidate.

Item `intent/0075` adds explicit raw-v3 continuation for a single independently
signed checkpoint. Original grant, requests and opening proofs stay unchanged;
fresh extending history and complete remaining inventory must match the exact
completed receipt partition. New holds/references deny continuation. A current
winning batch reservation and every per-copy proof remain mandatory; separate
tombstone approval also binds the checkpoint. Repeated checkpoints are extended
by 0076; actual durable recovery remains unimplemented. See `intent/0075/PLAN.md`.

Item `intent/0076` adds raw-v4 bounded checkpoint chains. Every step proves its
predecessor and winning reservation, preserves completed receipts and original
inputs, and rechecks fresh extending history/inventory/state. Receipts inside a
known hold interval deny even if the hold was later released. Final tombstone
approval binds the complete chain. This is offline evidence, not a real store or
restart. Terminal consumption and acknowledgment-loss evidence remain next under
`intent/0076/PLAN.md`; all five R5 findings remain open.

Item `intent/0077` adds an offline raw-v4 terminal-consumption wrapper. It seals
the exact original graph/grant/plan/chain/aggregate/tombstone and requires full
independent committed terminal and current store proofs. Repeated reads return
only REPLAY_NOOP, never new effect authority. Original signed bytes are preserved;
an ephemeral view changes only unsigned audit-clock inputs to re-run all current
authority/expiry checks. Expired originals still deny. This is not archival replay,
a real atomic store or live lost-acknowledgment recovery. See `intent/0077/EVIDENCE.md`
and `PLAN.md`. All five R5 findings and independent/protected review remain open.

Item `intent/0078` adds fact-only historical-event revalidation at future years.
It keeps the original event/provider signatures and frozen key windows, requires
trusted exact archive/current-registry selection and independent fresh revalidation
and retention proofs, and denies known current historical-key revocation. It is
not action authority or a completed future lifecycle disposition. The original
current-key exports still deny expired originals. See `intent/0078/PLAN.md` for
fresh human-authority and full lifecycle composition next; R5 remains open.

Item `intent/0079` adds trusted current-registry selection to the full human
authority verifier, preserving its original export and policy pin. All nine fresh
signed records and exact bindings remain required at an explicit trusted current
clock. Expired historical approvals, changed old key windows and request-selected
registries deny. Future tests exercise fresh synthetic authority, not new real human
signatures. Full lifecycle composition is next under `intent/0079/PLAN.md`; no gate
or runtime trust publication is claimed.

Item `intent/0080` composes full future-retention evidence for security-audit,
corpus-baseline, decision-proof and legal-signed-log classes through an explicit
current-v1 graph. Complete historical facts coexist with fresh current inventories,
state, human approvals, shared protected actions and exact selected-provider
resource/receipt keys. Copy aggregate and separate tombstone proof remain required.
Archive proof must precede state; current holds, expiry and unsupported releases
cannot be bypassed. This is offline full evidence, not live erasure. Mixed-era
history, referenced objects and other classes remain closed on this new path;
see `intent/0080/PLAN.md`. All five R5 findings remain open.

Item `intent/0081` adds current-v2 lifecycle history: an exact verified archive
prefix plus every current-key suffix event, with global ordering/identity and full
hold/release checks. Current event verification shares the original schema/body
while requiring trusted current registry/clock selection. Mixed runtime keys are
unique, and event/provider roles cannot alias one key. The four-class limit stays
explicit; full referenced-object evidence is next under `intent/0081/PLAN.md`.
This is not a live feed, key deployment, provider effect or independent gate ruling.

Item `intent/0082` introduces a non-erasure qualified-event human profile. A hold
release can truthfully declare an active hold and bind its predecessor without
carrying false no-hold, copy/erase or raw-deadline fields. All nine current human
proofs remain required through the shared verifier; selector inventory, independent
keys and 300-second freshness are explicit. The original disposition profile/pins
stay unchanged. Actual lifecycle-event binding is next under `intent/0082/PLAN.md`;
this is not a human signature or a completed hold mutation.

Item `intent/0083` binds that qualified profile to every current hold event under
an explicit runtime/current-v3 contract. Exact event, actor/hat, selector, prior
hold and before-commit reservation relationships are checked; decision identities
cannot be reused across holds and subsequent copy/tombstone approvals. The full
graph binds the qualified evidence bytes. Historical applications remain
restrictive facts; historical releases without qualified archival proof deny.
All checks pass, including 199 root controls and 88 prototype tests. These are
offline candidates, not live owner decisions or Gate 2 closure. Qualified archival
proof is next under `intent/0083/PLAN.md`, followed by reference evidence and the
remaining normative coverage.

Item `intent/0084` adds current-v4 with full original-era owner records verified
at their separately retained observation times, current revocation checks and
fresh independent archive retention. The exact qualified event/selector/hold
binding is shared across eras, and archived decisions remain unusable as current
copy/tombstone permission. Full checks pass with 207 root controls and 88 prototype
tests. The original-era limit, live archive integration and all five R5 findings
remain explicit. Reference revocation/retained verification is next under
`intent/0084/PLAN.md`; no human ruling, live effect or gate closure is claimed.

Item `intent/0085` adds a qualified-reference owner profile with exact referenced
record selection and bound event/reference-inventory/verification-bundle/tombstone
identifiers. Truthful hold/reference state is separate from erase authority; all
nine current proofs, key independence, freshness and profile isolation remain
mandatory. Full checks pass with 213 root controls and 88 prototype tests. Exact
reference contents, retained verification and full lifecycle admission are next
under `intent/0085/PLAN.md`, not implied by this profile's ALLOW. R5 remains open.

Item `intent/0086` verifies complete supplied reference/version manifests and
matching verification bytes under exact trusted content pins. Independent current
inventory, verification and retention attestations bind counts, content digests,
source observations and the selected archive. UTF-8 bounds and exact expiry apply.
Full checks pass with 220 root controls and 88 prototype tests. This proves the
offline content contract, not live discovery or actual reference removal. Qualified
revocation/event/completion and full lifecycle admission are next under
`intent/0086/PLAN.md`; all five formal R5 findings remain open.

Item `intent/0087` composes the full qualified reference owner with retained content
and the exact current event. Approval follows verified retention; the reservation
precedes commitment. Every exact reference then requires a current signed removal
receipt and independently completed cleared state. Full checks pass with 227 root
controls and 88 prototype tests. No removal is performed by the verifier, and no
erasure grant is emitted. Full lifecycle/history/copy/tombstone admission is next
under `intent/0087/PLAN.md`; all five formal R5 findings remain open.

Item `intent/0088` adds a separately selected reference-action profile to the same
shared authorization body. Copy resources explicitly bind objectSha256; tombstone
resources bind tombstoneRecordId and verificationBundleDigest. Exact target,
provider resources, credentials, delegation, assignment, authority and replay/CAS
remain mandatory; original seven-action output/pins stay unchanged. Full checks
pass with 232 root controls and 88 prototype tests. Full referenced-evidence
lifecycle admission is next under `intent/0088/PLAN.md`; R5 remains formally open.

Item `intent/0089` composes full referenced-evidence lifecycle under an explicitly
selected current-v5 runtime. Retained content, qualified revocation and exact
removal must match complete history/current state and every copy version/hash.
Qualified current/archival holds, exact three-year retention, separate complete
copy/tombstone humans and shared actions, selected-provider terminal receipts and
cross-decision identity guards remain required. The owner cannot claim a future
hold release. Missing reference evidence retains; partial or substituted proofs
block. No real execution or gate approval is claimed. See `intent/0089/EVIDENCE.md`
for verification and `intent/0089/PLAN.md` for remaining coverage.

Item `intent/0090` adds an explicit exact-time v2 migration profile through the
same complete bounded 0062 evidence body. Every preparation/approval/reservation,
rollback, post-state, journal/result and replay comparison now supports whole
seconds or exact nanoseconds without rounding. The original v1 stays unchanged.
All shared and contract-owner proofs, source-byte preservation and independent
approval pins remain required; outputs explicitly deny execution. Behavioral
compatibility/concurrency/checkpoint evidence remains open. See
`intent/0090/EVIDENCE.md` and `intent/0090/PLAN.md`.

Item `intent/0091` composes complete exact migration verification with a pinned
executable dual-column compatibility model for both declared version pairs.
Every row of both supplied states runs 24 old/new read/write orders and both
competing-snapshot winner orders, including stale rejection, exact/key-drift
replay and fresh retry. Stale mirrors and contract loss are rejected even when
the original exact transform passes. All 128 rows are exercised at the bound.
This is synchronous in-memory client behavior, not real application or database
concurrency. Outputs explicitly retain `liveCompatibilityVerified=false` and
zero execution. See `intent/0091/EVIDENCE.md` and `intent/0091/PLAN.md`.

Item `intent/0092` composes approved ordered migration chains. Separate staged
profiles let backfill keep its schema while expand/contract change it. Every
attempt invokes the complete signed graph and executable client model. Exact
predecessor bytes, observation order, complete disjoint batch coverage and immutable
request ownership are required. Interrupted/restored prefixes stay pending;
verified fresh retry can complete, and exact replay never advances twice. Even a
null-valued unchanged row cannot disappear from coverage. This is not durable
checkpointing or a live runner. See `intent/0092/EVIDENCE.md` and `PLAN.md`.

Item `intent/0093` verifies one selected migration checkpoint slot using complete
original/current chain evidence and twelve signed opening, checkpoint/retention,
terminal, transport and current readback records. Lost acknowledgment does not
waive terminal commit or fresh readback. Expired plan/human evidence is not revived;
only unsigned audit clocks change in a temporary view, with original signed bytes
preserved. Outputs deny execution and resume authority. This is synthetic source
evidence, not a real durable store or chain-wide latest-head resolver. See
`intent/0093/EVIDENCE.md` and `PLAN.md` for checks and remaining work.

Item `intent/0094` adds explicit read-only current observation of retained staged
graphs and chains. It preserves original graph/prefix bytes and evidence seals
while rebinding only unsigned human audit clocks in temporary verifier views.
Retained failed contracts and fresh retries can therefore be checked together;
expired native proof still denies. Contract authority/provider/idempotency/CAS
identities belong to one request, while changed original replay bytes remain
drift. The separate observation policy does not claim original-as-of verification,
checkpoint extension or resumed execution. See `intent/0094/EVIDENCE.md` and `PLAN.md`.

Item `intent/0095` composes successive checkpoints with the full current audit,
policy-bound source records, exact prior head/reservation linkage and a strict
immutable attempt-prefix extension. At least one new post-readback request is
required; replay alone cannot update progress. Retained failed contract clocks
remain unchanged. The original v1 slot profile is preserved through a shared
private verifier. This is effect-free offline verification, not authoritative
latest-head discovery, a durable runtime or resume authority. See
`intent/0095/EVIDENCE.md` and `PLAN.md` for checks and the remaining scope.

Item `intent/0096` checks a full checkpoint sequence against five query-bound
source records: request, canonical head, exact retained object, unchanged head
confirmation and independent audit. Stale sequences, changed source heads and
unknown commit outcomes deny. The result is explicitly evidence-only, as of the
confirmation instant, with no live store query or resume authority. Existing
checkpoint APIs are unchanged. See `intent/0096/EVIDENCE.md` and `PLAN.md` for
checks and the next finite normative-gap reconciliation before further changes.

Item `intent/0097` supplies a source-pinned finite gap inventory rather than another
decision verifier. It retains five current R5 findings and fourteen historical IDs,
maps sixteen lifecycle classes and fourteen candidate/test pointers, and preserves
3,600 migration coordinates plus fourteen additional cases and the correct eight
recovery-cut outcomes. Corrected exact-ID coverage is explicitly unreconciled.
Six dependency-ordered packages now constrain remaining assurance work, beginning
with GAP-01's actual corrected execution ledger. See `intent/0097/PLAN.md`;
neither this inventory nor its passing tests closes a gate or completes Phase 1.

Item `intent/0098` begins GAP-01 with an independently derived 4,036-ID catalog and
actual corrected execution hooks. The snapshot records 63 passing mapped cases,
zero failures and 3,973 IDs not yet mapped into this runner. This is not a missing
feature count. `pnpm r5:coverage:report` emits the evidence and scope limitations;
`pnpm r5:coverage:require-complete` correctly exits 2 while incomplete. Required
IDs never come from the available hook list. Existing wider tests and all formal
review obligations remain; see `intent/0098/PLAN.md` for the next mappings.

Item `intent/0099` adds 52 exact-ID recovery and human-authority executions. Every
recovery corruption and human case includes a complete positive control; the two
pre-ack recovery cuts correctly remain unknown. Both R5-002 examples demonstrate
legacy acceptance and the precise full-binding/native-time corrected denial. The
new snapshot has 115 passed, zero failed and 3,921 unmapped IDs. It seals the new
hook/fixture sources and leaves the 0098 historical report unchanged. GAP-01 and
all five findings remain open; see `intent/0099/PLAN.md` and `EVIDENCE.md`.

Item `intent/0100` maps 32 authorization, 20 spending and 34 cost cases through
complete timed audits. Reconciliation uses plural 0057/0063, preserving original
signed bytes; overflow observes exact primitive failures plus signed graph denial.
The 19 existing privacy graph IDs now include full 0063 observations and positive
controls, without double credit. The new snapshot records 201 passed, zero failed
and 3,835 unmapped. Original authorization is not the separate shared-action
contract, and one-line reconciliation does not resolve R5-004. See
`intent/0100/EVIDENCE.md` and `PLAN.md`; all formal findings remain open.

Item `intent/0101` maps 74 remaining classifier IDs and the R5-004 two-line cost
counterexample. Complete timed evidence verifies; either missing variance or
successor, including a single pair for two lines, denies without totals. All 32
array orderings preserve exact lineage and rounding. Non-phone classifiers are
unchanged components of the corrected graph, not newly fixed detector behavior;
classification is not corpus acceptance. The snapshot has 276 passed, zero failed
and 3,760 unmapped IDs. See `intent/0101/EVIDENCE.md` and `PLAN.md`. All five formal
findings remain open; actual counterexample execution is not independent closure.

Item `intent/0102` maps 17 exact private-domain signing requests with actual public
ordinary-record positive controls. Private requests fail without returning a
record, and ordinary signatures cannot verify under those domains. This is a
retained capability boundary, not cryptanalysis or live key custody. The snapshot
has 293 passed, zero failed and 3,743 unmapped IDs. All schema and accessibility
IDs stay unmapped pending source-version reconciliation and actual streamed-input
seals. See `intent/0102/EVIDENCE.md` and `PLAN.md`; formal findings remain open.

Item `intent/0103` records all 15 schema sources and maps three existing precision
successors plus eleven retained structural validators. Original fixtures, closed
object checks, all declared precise time fields and fractional policy numbers
are exercised. The obsolete migration schema remains unmapped, as do all full
accessibility cases. Shape checks do not validate copied signatures or whole
graphs. The snapshot has 307 passed, zero failed and 3,729 unmapped IDs. See
`intent/0103/SCHEMA-MAP.json`, `EVIDENCE.md` and `PLAN.md`; formal findings stay open.

Item `intent/0104` adds actual streamed accessibility ledger execution. Full profile
executes all 16 cases; the positive consumes 32,900 raw rows, and negatives bind
that passed execution from the same run. Length-framed consumed-prefix seals,
byte/row counts and closure state prevent metadata-only or cached-result credit.
Full profile records 323 passed and 3,713 uncovered; quick explicitly omits those
16 heavy executions and records 307 passed / 3,729 uncovered. Strict completion
fails early with explicit quick evidence while unmapped full-profile cases remain;
when none remain it must execute full before succeeding. Use
`pnpm r5:coverage:full-report` and `pnpm r5:coverage:test-full` for fresh complete
synthetic execution. This is not a manual audit or formal finding closure. See
`intent/0104/EVIDENCE.md` and `PLAN.md`.

Item `intent/0105` maps two omitted-action R5 reproductions through the existing
0060 verifier. All six exact lifecycle/migration actions execute complete positive
and replay controls, every signed-proof omission/corruption, re-signed hostile
semantics, resource substitutions and independently installed scope/target
transplants. The original manifest omission is reproduced separately. The 177
lifecycle and 179 migration observations count as two case IDs, not 356 cases.
Full profile now records 325 passed / 3,711 uncovered; quick records 309 passed /
3,727 uncovered. The two complete-graph reproductions remain unmapped; this work
does not authorize effects or close formal findings. See `intent/0105/EVIDENCE.md`
and `PLAN.md` for verification and the next complete-graph work.

Item `intent/0106` maps the full target-free migration counterexample through the
staged v3 graph, including actual transformed rows, six preserved governance byte
strings, backup/restore evidence, shared authorization and contract human scope.
All phases pass positive/replay/interruption/rollback controls; missing targets,
permissions and re-signed source/row/journal corruption deny. Its 135 observations
count as one R5 ID, not migration matrix coverage. Full profile now records
326 passed / 3,710 uncovered; quick 310 passed / 3,726 uncovered. The final R5
lifecycle graph reproduction remains unmapped. No database/store or migration
effect is executed. See `intent/0106/EVIDENCE.md` and `PLAN.md`.

Item `intent/0107` maps the final R5 surrogate-trigger reproduction through a full
same-class failed-run lifecycle graph. The original graph/event disagreement is
preserved; a valid closed event and full history reach the synthetic 90-day boundary
with both copy paths and a separate human/action/provider tombstone path. Missing
event/action proofs, drift, holds and invalid human/provider lineage deny. All nine
R5 reproductions are mapped, but the five formal findings stay open. Full profile
records 327 passed / 3,709 uncovered; quick 311 passed / 3,725 uncovered. Remaining
matrix/schema, live integration and independent/protected evidence are separate.
See `intent/0107/EVIDENCE.md` and `PLAN.md`. No real retention/deletion is claimed.

Item `intent/0108` maps 27 ordinary lifecycle negative IDs, each with a full
failed-run control before its distinct mutation. A chronological active hold
retains the record; conflicting evidence blocks. The source map distinguishes
re-signed semantic failures, inventory races, copy/receipt transplants and closed
registry injection. Three raw/reference negatives remain unmapped. Full profile
now records 354 passed / 3,682 uncovered; quick 338 passed / 3,698 uncovered.
All formal findings remain open. See `intent/0108/EVIDENCE.md`, `SOURCE-MAP.json`
and `PLAN.md`; no real retention, provider action or deletion is claimed.

Item `intent/0109` supplies the three remaining raw/reference lifecycle negative
mappings. Raw controls verify the preterminal grant, complete three-copy batch and
separate tombstone; reference controls use retained historical bytes, fresh synthetic
current-v5 proofs, exact removal evidence and the named tombstone. Each case runs
positive, replay and negative controls. Missing references retain; absent or malformed
raw grants block. The legacy malformed field is explicitly promoted into the actual
raw-grant schema, not credited through obsolete-field rejection. Full profile records
357 passed / 3,679 uncovered; quick 341 passed / 3,695 uncovered. All 30 lifecycle
negatives are mapped, but all five formal findings remain open. Class boundaries,
migration/schema, real integration and independent/protected review remain separate.
See `intent/0109/EVIDENCE.md`, `SOURCE-MAP.json` and `PLAN.md`.

Item `intent/0110` maps eight before/complete retention coordinates across failed
runs, raw analytics events, corpus-derived text and exports. Exact source trigger,
parent-cap and observation instants are preserved. Fresh before-expiry state yields
scheduled, without accepting premature receipt evidence; each hook also verifies
full completion/replay with both copies and the separate tombstone. Complete proof
steps fit the exact source +6 second observation, with unchanged original keys.
Full profile records 365 passed / 3,671 uncovered; quick 349 passed / 3,687 uncovered.
The 56 other boundary rows and all formal findings stay open. See
`intent/0110/EVIDENCE.md`, `SOURCE-MAP.json` and `PLAN.md`; no real deletion is claimed.

Item `intent/0111` adds ten before/complete coordinates for security audit, corpus
baseline, decision proof, legal signed log and referenced evidence. Existing
current-v4/v5 profiles retain original 2026 event bytes and exact original key
windows while using fresh synthetic archive/state/human/action/provider proofs.
Exact source minus-one/plus-six-second observations are preserved. Referenced
evidence additionally requires removal receipts and the named tombstone; missing
completion reference evidence retains safely. Full profile records 375 passed /
3,661 uncovered; quick 359 passed / 3,677 uncovered. Eighteen lifecycle boundaries
now map; forty-six and all formal findings remain open. See `intent/0111/EVIDENCE.md`,
`SOURCE-MAP.json` and `PLAN.md`; no real future retention/deletion is claimed.

Item `intent/0112` adds a separate read-only lifecycle readiness candidate. A closed
head-only envelope reuses verified event/history/inventory/state/retention checks
and adds pinned target/policy and known provider selectors. It reports waiting,
eligible-pending-disposition-evidence or conservative hold retention, always with
zero effects and false execution, quarantine, deletion and clearance flags. Complete
disposition remains a separate format requiring all human/action/provider/tombstone
proofs. Eighteen exact at/after coordinates now map; full profile records 393 passed /
3,643 uncovered, quick 377 passed / 3,659 uncovered. Thirty-six lifecycle coordinates
map and twenty-eight remain. This is an offline candidate, not a live API or mutation
capability. See `intent/0112/EVIDENCE.md`, `SOURCE-MAP.json` and `PLAN.md`; all formal
findings remain open and no actual quarantine or deletion is claimed.

Item `intent/0113` reconciles indefinite authoritative-artifact retention. All four
source labels share one commit-time observation, explicitly not four distinct expiry
scenarios. Valid available event/inventory/state evidence returns retained-immutable
with no future effect input. Held state or injected disposition records cannot turn
that into deletion; invalid proofs and invented expiry deny. Full profile records
397 passed / 3,639 uncovered; quick 381 passed / 3,655 uncovered. Forty lifecycle
source IDs map, with twenty-four uncovered. See `intent/0113/EVIDENCE.md`,
`SOURCE-MAP.json` and `PLAN.md`; no live immutable-storage enforcement or formal
finding closure is claimed.

Item `intent/0114` reconciles raw-corpus lifecycle observations with the signed
maximum sixty-second receipt deadline. Early-completed full graphs and committed
replays validate at the four exact source clocks. A receipt at exactly the deadline
passes in the completed audit; genuine signed +1ns/+1s late receipts deny. Earlier
observations reject unavailable future aggregate/tombstone evidence, separately from
that deadline comparison. Missing/expired grants and incomplete graphs deny, while
held/reference-active state conservatively retains. The complete verifier and source
pins are unchanged. See `intent/0114/EVIDENCE.md` and `SOURCE-MAP.json`; this proves
offline evidence behavior, not real erasure, operational quarantine or all normative
terminal/grant/crash requirements. All five formal findings remain open.

Item `intent/0115` adds a distinct head-only RC-REBUILDABLE immediate profile.
Available complete signed history without a supersession/rebuild event returns
waiting-for-trigger with null expiry; earliest observed trigger returns pending
disposition. Future events, incomplete/stale heads, unbound provider selectors and
format interchange deny. Held/reference-active state remains non-mutable. The
original complete and retention-readiness policy/observation behavior is preserved;
full +6s disposal/replay controls remain separate. Four source observations map,
leaving sixteen lifecycle coordinates. See `intent/0115/SOURCE-MAP.json` and
`EVIDENCE.md`; no live projection, instantaneous deletion, reference clearance,
quarantine or execution authority is claimed. All formal findings remain open.

Item `intent/0116` adds a release-only current-v6 full/readiness profile. The
seven-year clock requires a named environment and exact trusted retirement event,
release-rails record, provider record, actor and time, with a provider-bound
release-rails commit and both traffic-disabled/credentials-revoked conditions.
Wrong signed retirement semantics deny. Original history/key windows and fresh
qualified/current proof separation remain intact; other future classes are not
admitted. Four source observations map, leaving twelve lifecycle coordinates.
Readiness does not authorize deletion, and full completion still requires current
copy/action/provider/aggregate/tombstone proof. See `intent/0116/EVIDENCE.md` and
`SOURCE-MAP.json`; this is not a live traffic/credential check or actual retirement.
All five formal findings remain open.

Item `intent/0117` supplies a fact-only original-era derived-child disposition
verifier, a prerequisite to future corpus-provenance composition. It retrieves no
provider data: supplied aggregate receipt bytes must match the parent event digest
and a fully verified child graph including every copy and final tombstone. Wrong
parent/class/source/chronology, incomplete proof, borrowed receipts and cross-child
physical-object or one-use credential reuse deny. Success does not authorize action
or assert live deletion. Parent complete manifest/history and fresh future archive
verification remain required. This component adds no catalog credit; all five R5
findings and the twelve remaining lifecycle coordinates stay open. See
`intent/0117/PLAN.md` and `EVIDENCE.md` for the next composition and verification.

Item `intent/0118` adds a fact-only archive verifier for the exact retained 0117
child evidence. It revalidates complete original proofs at their trusted historical
observation and requires fresh independent current revalidation/retention witnesses.
Original key material/windows stay unchanged and any known original revocation,
including unused domains, blocks this conservative first profile. Fresh signatures
cannot make incomplete original child proofs or wrong receipt bytes valid. Archive
validity does not establish complete parent manifest/history or current parent
disposition authority. No current-v7 admission or catalog mapping is added yet;
see `intent/0118/PLAN.md` and `EVIDENCE.md`. All five formal findings remain open.

Item `intent/0119` connects qualified parent hold history, fresh complete manifest
and independent history-head assertions to exact archived child-event/receipt bytes.
Every child/event must map one-to-one; complete-empty mode cannot hide deletions or
missing evidence. The later retirement/final deletion yields a boundary candidate
only. The source policy requires qualified corpus-retirement authority, and the
existing owner profiles cover hold decisions, not retirement. Consequently
retirementAuthorityVerified stays false and retentionEligible is absent. Next is a
separate complete retirement-decision/archive profile before future lifecycle
admission; see `intent/0119/PLAN.md`. All five findings and mapped counts stay open
and unchanged. No live history completeness or actual deletion is claimed.

Item `intent/0120` provides the separate qualified-retirement profile, using all
nine human records and exact corpus/event/predecessor/policy-bound history-head
composition. Identity, qualification, assignment, provider proof, replay and CAS
must pass, with reservation before retirement commit. Existing hold/reference/
disposition contracts and mapped observations remain unchanged. A verified decision
at its explicit original/current observation is not later archival validity or
complete qualified prior history; those flags stay false. Next is an exact retained
retirement archive and parent/lifecycle integration under `intent/0120/PLAN.md`.
No new catalog credit or live retirement/deletion is claimed; all five findings
remain open.

Item `intent/0121` advances the first usable journey with a stateless authenticated
Brief-preview query. It reuses the domain template, binds the authenticated human,
reports missing facts and hashes exact content, with fresh grant checks before
and after computation. It saves/signs nothing, calls no model and grants no real
access. The production authoring UI, confirmation and Git write contracts remain
next. `docs/FIRST-USABLE-DELIVERY.md` contains the audited journey, effort ranges,
near-term preview demo and separate gate/provider waits. Existing archival and
other Phase 1 obligations remain due; no finding or signed scope is waived.

Item `intent/0122` connects 0121 to a production Next.js interview preview: one
question at a time, prior-answer correction, inert rendered content and exact
fingerprint checks. Editing discards stale previews; page hiding, navigation,
expiry and denied access clear unsaved private content. The same server-side
authorization applies and no browser grant is inferred. All 39 isolated Chromium/
Keycloak/encrypted-session/local-Git integration checks pass, including desktop,
mobile, keyboard and automated accessibility observations. This is deterministic
preview, not model-backed conversation, confirmation, Git saving or a gate approval.
See `intent/0122/EVIDENCE.md` and the first-journey plan for remaining requirements.

Item `intent/0123` adds exact human-confirmation/create/readback contracts to the
common registry. The coordinator re-renders confirmed bytes, binds target/base/key,
inspects prior operation state, checks fresh adapter authority and dispatches once.
Unknown post-dispatch outcomes require original-key readback, not a new write.
The writer and full source-verification adapter remain absent from runtime, so
real saves remain unavailable. Synthetic CAS/receipt tests do not prove GitHub
durability or Gate 2 acceptance. Canonical-path discovery and save UI remain next
integration work; see `intent/0123/PLAN.md` and `EVIDENCE.md`. All findings stay open.

Item `intent/0124` implements the uninstalled GitHub Brief storage primitive:
explicit narrow installation-token requests, exact-head two-file mutation, native
Git-backed retry/restart tests and exact tree/blob/marker readback. Lost responses,
bad ancestry, branch/protection rejection and resource-limit failures cannot become
success or automatic retries. The current history profile is deliberately bounded
to 100 linear commits. This is not the full authenticated `BriefWriter` or the
source-verified Gate 2 authority callback; runtime and the actual App stay read-only.
See `intent/0124/EVIDENCE.md` for verification and `intent/0124/PLAN.md` for follow-up.

Item `intent/0125` shares canonical Brief path validation between creation and
curated reading. Projection catalog filtering, HTTP/MCP and browser links now
recognize `items/NNNN-slug/BRIEF.md` alongside explicit legacy read forms. Curated
scope, grants, tenant isolation and exact revision/content checks are unchanged;
legacy paths do not become create targets. The browser harness uses a canonical
local Git fixture. Verification and remaining boundaries are in 0125/EVIDENCE.

Item `intent/0126` adds an uninstalled revision-bound human membership adapter.
It verifies fresh issuer/session/grants against exact Git authorization bytes and
expected head, caps validity and discards stale/late observations. Its result says
gate/write authority are not verified; it cannot replace the full trusted writer.
Existing login and provenance-only gate observation remain unchanged. See
`intent/0126/EVIDENCE.md` and `intent/0126/PLAN.md` for the remaining composition.

Item `intent/0127` retains internal issuer/credential/session context from actual
OIDC and browser verification. The public authenticator still returns only its
principal. Membership now compares an exact binding hash as well as establishment
time, preventing same-time session substitution. Signed-token/broker tests compose
these paths and verify public metadata exclusion. This is not a human gate proof;
the full source/provider verifier and request-bound writer remain unfinished.

Item `intent/0128` extends the existing read-only gate observer with internal
exact-source collection. Expected head/digest, original artifact bytes, immutable
snapshots, post-read expiry and legacy response compatibility are tested. The
bundle explicitly requires provider verification and grants no gate/write
authority. No HTTP/MCP collection endpoint or runtime writer is installed.

Item `intent/0129` adds a portable exact UTC parser and replaces millisecond
gate-policy comparisons. Sub-millisecond future/order/session errors now deny,
while genuinely ordered fractional timestamps preserve their sequence. All
normalized timestamp fields are validated without rounding; provider verification
and live write enablement remain separate unfinished work.

Item `intent/0130` adds an unconfigured read-only Ed25519 provider-attestation
verifier with strict source/identity/session pins and exact key/time checks.
Actual ephemeral cryptographic tests are distinct from provider retrieval,
trusted-key-source approval, qualified hats and full gate/write authority. The
existing provider-recorded Gate 1 is not converted or replaced by this primitive.

Item `intent/0131` composes the provider primitive with authenticated pinned Git
trust/proof reads. It verifies exact source bytes and current head/access, uses
no stale source cache and bounds owned work with single-flight/timeout/shutdown.
It does not authorize trust roots, convert existing provider approvals or produce
full human/qualified-hat/gate/write authority. No runtime binding is installed.

Item `intent/0132` composes the shared BriefWriter contract with the real GitHub
store, request-bound human identity and mandatory fresh full-authority callbacks.
It adds bounded operations, session/grant rechecks, status-only reads and uncertain
outcome recovery. The shared registry's confirmation/save/readback path is tested
with native disposable Git and synthetic provider/identity/authority dependencies.
The full verifier and runtime writer installation remain unfinished; no live save,
gate approval, UI completion or provider-permission change is claimed.

Item `intent/0133` corrects partial-clock-rollback acceptance in current membership
and gate-source reads. Gate collection now has a fifteen-second caller deadline
while retaining underlying-work ownership, denying late continuation and draining
on shutdown. Public shapes and no-gate/no-write semantics remain unchanged. This
is a prerequisite correction; full authority and runtime writer binding are due.

Item `intent/0134` prepares per-request writer factories through the shared registry,
HTTP/browser, Git-backed MCP and identity-service lifecycle. Allocation follows
current human authorization; cleanup is awaited. Actual verified cookie/bearer
context stays internal, and writer-enabled shutdown drains requests before shared
resources. This is opt-in composition code, not a configured runtime writer or
full authority verifier. Default save/status and live provider access stay closed.

Item `intent/0135` composes the real GitHub reader and current membership verifier
around the mandatory full gate callback inside a managed request writer factory.
Exact source/session checks and valid lifetime caps precede actual storage. HTTP
and official MCP integration saves confirmed bytes into disposable Git and recovers
lost acknowledgements without duplicate commits. Identity/provider/gate fixtures
are not production evidence; the full gate verifier and runtime binding remain due.

Item `intent/0136` adds explicit historical/current human-hat verification to the
signed provider-source reader. Exact Git bytes, attested historical digest and
nanosecond grant windows are checked, with current revocation and actual Git-history
tests. Identity/session evidence, specialist qualification, commercial provider
compatibility and full gate policy remain unfinished. No real writer is enabled.

Item `intent/0137` adds signed identity/session assertion verification and an explicit
Git-backed reader mode that joins it with the gate proof and both hat sources.
Two real test signatures, native Git and source/time/revocation negatives are
verified without accessing real credentials. Actual receipt issuance/attestor
binding, existing commercial provider compatibility and full qualified gate
composition remain unfinished; no production authority or frontend change occurs.

Item `intent/0138` joins scoped qualification assertions with provider/identity
proofs and both Git role sources. A derived specialist signature supplies only
verified required domains to the policy evaluator. Native Git and genuine synthetic
signatures cover current revocation, expiry and source integrity. Full gate-source
composition, real attestor bindings and existing commercial compatibility remain;
no professional designation, gate, live writer or frontend feature is enabled.

Item `intent/0139` adds complete canonical signer-set collection through the actual
gate, provider, identity and specialist readers. It matches the roster before signer
lookups and recollects exact record/artifact sources afterward, with one bounded
actor/expiry/ownership envelope. Native Git and real signatures cover partial and
forged rosters. Full policy sources and simultaneous current signer revalidation
remain due; no live approval, writer or frontend feature is installed.

Item `intent/0140` closes the reproduced expiry gap between individual signer
verification and final source recollection. Actual verified key, current-role and
qualification bounds now feed a shared completion-time check with exact UTC
comparisons. Historical login expiry remains a historical signing constraint, not
a requirement for a still-live login today. Bounds are immutable observations,
not source-freshness or write-authority leases. Full policy/source composition and
real approved bindings remain due; see `intent/0140/EVIDENCE.md`.

Item `intent/0141` composes pinned policy, Critic, build and domain/exception sources
with actual canonical signer collection for every prerequisite gate. The existing
policy evaluator consumes source-derived digests and facts, and any failed gate
blocks the aggregate. Strict development source profiles are not replacements for
existing review/approval formats. Their authenticity and governed selection remain
unverified here; no gate, runtime writer or UI is enabled. See `intent/0141/EVIDENCE.md`.

Item `intent/0142` adds explicit native Gate 2 domain-review profile support. Original
record bytes, findings, escalations and confidence are preserved; every evidence
reference must match a complete startup allowlist and actual original-revision Git
bytes. Native observations still require verified reviewer provenance and governed
source selection. No canonical report or approval is changed. See `intent/0142/EVIDENCE.md`.

Item `intent/0143` supports native exception Briefs by reconstructing every summary,
finding and escalation from complete pinned native reviews. Actual source digests
feed policy links; inconsistent consolidations reject. Medium-confidence native
readiness remains unchanged while the gate policy still blocks it. The actual
original records remain untouched and do not become authenticated reviews or
approvals. See `intent/0143/EVIDENCE.md` for verification and remaining boundaries.

Item `intent/0144` adds exact-source compatibility for the two native canonical
Critic HOLD layouts. Counter consistency, explicit reviewer/task bindings and
review chronology are checked; original claims and citations stay intact. Native
Git integration feeds failed review facts to the actual gate policy. Neither
historical tests nor local preflight are a passing gate report. See
`intent/0144/EVIDENCE.md`; reviewer authenticity, history and authority remain due.

Item `intent/0145` joins optional source-pinned runner trust/proof records to native
domain reviews. Real signature verification checks all report/identity/run bindings
and current key validity at final collection. Configured failures cannot fall back
to unsigned claims. This development receipt contract is not an installed provider
format or proof of truthful isolation; all gate/write flags stay closed. See
`intent/0145/EVIDENCE.md` for synthetic/native-Git verification and remaining work.

Item `intent/0146` validates bounded native Critic history, including all previously
resolved and newly introduced findings, against exact pinned predecessor bytes.
Configured history is collected from actual Git sources; missing records or
coherent-counter omissions reject. Original HOLDs and provenance/ancestry/closure
verification requirements remain. See `intent/0146/EVIDENCE.md`.

Item `intent/0147` adds a distinct native Critic runner receipt verifier and actual
source-pinned Git composition. It binds provider/task/configuration, exact report
and independent execution identities; domain and Critic runner keys share final
validity checks. Original HOLDs and unresolved provider/governance/isolation
requirements remain. See `intent/0147/EVIDENCE.md`.

Item `intent/0148` adds `intent.brief.destination`, a read-only organization-scoped
query over an explicitly configured candidate path set and the current Git branch
head. The optional identity-runtime `briefDestination: { paths: [...] }` binds to
its existing GitHub organization/repository/branch; it installs no grant or writer.
HTTP/MCP share authorization, revalidation and bounded observation contracts.
Projection references are never substituted for current Git head. No UI integration
or real configuration is claimed; see `intent/0148/SPEC.md` and `EVIDENCE.md`.

Item `intent/0149` consumes that query in the authenticated Brief authoring screen.
The read-only section uses a fixed HTTPS endpoint and a cancellable display owner;
it does not submit arbitrary targets, persist metadata, poll or enable a writer.
Observations have a 15-second display expiry and clear on timer/expiry/hiding/navigation; older requests
and timers cannot repopulate cleared or replaced details. Unavailable access stays
generic. The current signed-in page identity is presentation, not authorization.
Local route compilation and isolated controller/markup tests do not prove a real
configured end-to-end journey. See `intent/0149/EVIDENCE.md`.

Item `intent/0150` exercises isolated cookie/OIDC verification, native Git grants and
the actual destination display controller as one chain. Browser-only services with
a destination capability now drain admitted reads and final session revalidation
before closing session resources. Success, mid-read revocation and source failure
remain independently enforced. Synthetic provider HTTP and in-memory session stores
do not prove real Keycloak, durable runtime-profile or browser integration. See
`intent/0150/EVIDENCE.md`.

Item `intent/0151` adds an opt-in disposable PostgreSQL 16 integration for the actual
identity-runtime profile. Login transactions and encrypted sessions survive service
reconstruction; destination reads use the real App signer/Git reader against native
test commits. Scope, grant removal/revocation, callback replay and durable logout
are checked. The exact existing local image ID is verified before `--pull=never`
launch; no runtime fallback or database authority leaves the fixture. Run
`pnpm test:destination:integration` explicitly. Actual Keycloak/browser evidence is
still separate; see `intent/0151/EVIDENCE.md`.

## Local commands

```sh
pnpm install
pnpm check
pnpm domain-reviews:verify-target
pnpm domain-reviews:consolidate
pnpm dev --port 4175
pnpm dev:api
```

`pnpm check` validates the adoption kit and CI scopes, typechecks, runs the
gauntlet, and produces the production build. Domain review consolidation is a
separate gate command because it must fail until all seven independent review
records exist; an incomplete review set must not break ordinary development
checks or silently become an approval.
