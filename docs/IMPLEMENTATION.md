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

The foundation already includes the pnpm/Turborepo workspace, Next.js shell,
provider-free domain, stateless tool API, normalized OIDC/browser authentication,
read-only GitHub adapter, Postgres/Drizzle/RLS ingestion and encrypted sessions.
Still to be built or composed: authenticated business/data tools beyond session
context, MCP v2 transport, full-repository projection replay, Temporal workers,
version-pinned Mastra adapter, LiteLLM gateway, tenant-scoped evidence storage,
production product analytics, a secret-manager seam, approved runtime/ingress
configuration, full authenticated workspace UI and the thirteen-case architecture walking
skeleton. Existing increment evidence does not complete these remaining services.

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
