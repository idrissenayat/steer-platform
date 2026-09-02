# Plan: Flight Deck Phase 1 production foundation

Derived from: `BRIEF.md`, `SPEC.md`, `EXAM.md`, and `ARCHITECTURE.md`
architecture revision 2.

Status: **planning draft; blocked on Gate 1 and Gate 2**

Planning mode: read-only. This file is not execution authorization. It turns the
Phase 1 architecture into reviewable implementation slices so work can begin
without a big-bang rewrite or an accidental provider lock-in after the required
human signatures exist.

## Phase 1 outcomes

Phase 1 has two distinct completion lines:

1. **Technical release candidate:** the integrated production foundation passes
   the original Phase 1 Exam and all thirteen architecture walking-skeleton
   cases, including specialist evidence.
2. **Outcome complete:** one pilot pod uses that release for at least ten real
   items and completes the Brief's 90-day measurement window without fixture
   evidence entering production baselines.

Neither line may be shortened to “the UI works.”

## Preconditions

- Gate 1 binds the Brief, Spec, and Architecture revision, including explicit
  rulings on code host, OIDC binding, signature form, analytics, deployment, and
  cost envelope.
- Gate 2 binds the Exam after fresh-context Critic findings are resolved.
- Each implementation slice below receives its own Brief, Spec, Exam, Plan,
  assignee, and authorized item identifier before code is changed for that slice.
- Production credentials are supplied only through the secret-manager seam;
  no secret is placed in a repository, fixture, build argument, or log.
- The current `pnpm check` baseline remains green before the monorepo migration.

## Planning assumptions, not signatures

- GitHub App is the first code-host implementation, behind the published code-
  host contract.
- Local integration uses standards-based OIDC, Postgres, Temporal, LiteLLM, and
  S3-compatible containers. The commercial identity and hosting providers can
  be selected without changing domain contracts.
- PostHog is the reference analytics binding unless Gate 1 chooses an existing
  customer system.
- Provider-recorded approvals are the commercial starting point. If the first
  pilot is regulated and requires a cryptographic signature mirror, that work
  moves into Phase 1 before the pilot; it is not silently deferred.
- The cotton-candy pink/orange experience remains the visual baseline, rebuilt
  as tokens and accessible components rather than copied as one-off CSS.

## Plan-sprawl check

- Expected files touched: more than 80 across applications, packages,
  migrations, infrastructure, tests, documentation, and workflows.
- Expected external systems touched: GitHub, OIDC, Postgres, Temporal, LiteLLM,
  object storage, analytics, and the readiness sandbox.
- Alarm raised at 20 files or 4 systems: **raised**.
- Split line: vertical capability and interface seam. This umbrella coordinates
  nine child items; it is never handed to one Builder as a single implementation
  task. A child item that crosses the same threshold must split again before its
  Gate 2.

## Dependency route

```text
P1-01 repository foundation
  └── P1-02 identity, tenancy, and data
        ├── P1-03 Git authority and projection
        └── P1-04 tool API, MCP, and orchestration
              └── P1-05 evidence and operational controls
P1-03 + P1-04 ───────────────────────────────────── P1-06 production web
P1-03 + P1-04 + P1-05 + P1-06 ─────────────────── P1-07 platform agent
P1-01 through P1-07 ─────────────────────────────── P1-08 walking skeleton
P1-08 ───────────────────────────────────────────── P1-09 pilot evidence
```

## Implementation route

### P1-01 — Repository foundation and stable contracts

**Coherent shape:** establish the production workspace without changing product
behavior.

Deliverables:

- Convert the root into a pnpm/Turborepo workspace with `apps/web`, `apps/api`,
  `apps/worker`, and the packages declared in the Architecture.
- Establish strict shared TypeScript, lint, formatting, test, build, package-
  boundary, and affected-package CI configuration.
- Add a machine-readable stack lock covering Node, package manager, containers,
  protocol modes, schema compatibility, and adapter contract versions.
- Move the kit and pure, provider-free domain logic into their owned packages
  with characterization tests proving behavior did not change.
- Add local integration composition and health checks for Postgres, Temporal,
  LiteLLM, an OIDC development provider, and S3-compatible storage.
- Prohibit vendor SDK imports from `packages/domain` and
  `packages/tool-registry` through an automated boundary test.

Exit evidence:

- A frozen install and one root command typecheck, test, and build every package.
- All service containers become healthy from a clean checkout.
- Existing domain tests pass from their new package locations.
- The current Vite application remains only long enough to establish visual and
  behavioral parity; it is not carried forward as a second production web app.

### P1-02 — Identity, tenancy, authorization, and derived data

**Coherent shape:** make organization isolation true before the first production
record exists.

Deliverables:

- Create Drizzle migrations for organization, portfolio, product, pod,
  identity, hat, agent, repository binding, ingestion event, projection cursor,
  item projection, decision projection, evidence reference, and audit mirror.
- Put `organization_id` on every tenant-owned table and enable RLS in the first
  migration, using transaction-local tenant context for pooled connections.
- Implement the OIDC adapter and normalized subject, organization, hat, and
  specialty claims; browsers may never assert their own roles.
- Implement revocable service identities for agents and enforce “agents never
  sign” at the authorization layer.
- Encode commercial and regulated distinct-signer and second-look rules before
  any signature command reaches a code-host adapter.

Exit evidence:

- Negative cross-tenant tests cover direct queries, pooled connection reuse,
  full-text search, pgvector retrieval, and agent identities.
- Migration up/down rehearsal succeeds against disposable data; production
  migrations remain forward-only.
- Authorization property tests cover every human hat, agent identity, gate,
  and default-closed rule.

### P1-03 — GitHub authority, ingestion, and deterministic projection

**Coherent shape:** establish Git as the only business authority and prove that
all operational views can be rebuilt.

Deliverables:

- Implement the GitHub App installation, repository discovery, least-privilege
  token exchange, webhook authentication/replay defense, and periodic
  reconciliation.
- Parse organization declarations and product item chains at exact revisions.
- Implement revision-bound, idempotent artifact creation, sign, decline, merge,
  and send-back writes through the code-host seam.
- Store append-only ingestion events and deterministic projections in Postgres;
  no private status or approval field may become authoritative.
- Expose rebuild, cursor recovery, dropped-event repair, and projection-
  comparison commands.

Exit evidence:

- Forged, replayed, stale-revision, wrong-tenant, and over-scoped operations are
  refused and leave no authoritative write.
- A five-percent dropped-webhook run heals through reconciliation.
- Wiping Postgres and replaying Git produces the same canonical projection and
  user-visible state.

### P1-04 — One tool API, MCP transport, and durable workflows

**Coherent shape:** give humans and agents one authorized action surface.

Deliverables:

- Define queries and commands once in the zod tool registry with schemas,
  tenant scope, required hat, idempotency, and audit metadata.
- Generate or bind Hono routes, OpenAPI, internal calls, and MCP v2 Streamable
  HTTP tools from the same registry; reserve stdio for local clients.
- Implement Temporal item workflows for gate waits, SLA clocks, expiry,
  reconciliation, and worker recovery using deterministic workflow identities.
- Keep business truth out of workflow state; add repair/start logic that derives
  desired workflow state from the Git projection.
- Add rate, request-size, timeout, cancellation, and structured-error policies.

Exit evidence:

- The web client, direct HTTP client, MCP client, and platform service identity
  receive the same authorization result for the same command.
- Restarting a worker during a gate wait resumes the same item and timer.
- Contract tests prove API and MCP schemas cannot drift from the registry.

### P1-05 — Evidence, secrets, readiness, analytics, and observability

**Coherent shape:** make every production claim inspectable without building the
Phase 2 verification engine.

Deliverables:

- Implement immutable tenant-scoped evidence objects with content hashes and
  Git-committable references; do not assemble Phase 2 evidence bundles yet.
- Implement secret references, rotation, short-lived workload credentials, and
  log redaction through the secret-manager seam.
- Run the five-part readiness scan in an ephemeral sandbox and route findings
  into ordinary on-ramp Briefs. Do not dispatch external Builders in Phase 1.
- Bind the existing content-free event contract to PostHog or the Gate 1
  analytics choice while preserving pending, greenfield, and insufficient-
  sample states.
- Add OpenTelemetry across requests, tools, workflows, model calls, Git
  projection lag, and evidence operations, with organization-safe attributes.
- Add the LiteLLM service binding, model configuration pin, budget scope, and
  configuration-only model swap test.

Exit evidence:

- Cross-tenant evidence, model-key, trace, analytics, and sandbox tests fail
  closed.
- Logs contain no token, secret, originator problem text, or artifact content.
- Fixture events cannot populate a production baseline.
- A readiness finding creates a draft on-ramp Brief through the standard tool.

### P1-06 — Accessible production web and design system

**Coherent shape:** rebuild the validated experience on the production web
foundation without carrying Vite or fixture behavior into production.

Deliverables:

- Create the Next.js App Router PWA with server/client boundaries, TanStack
  Query, and the typed API client.
- Encode the cotton-candy palette, spacing, typography, motion, state, and focus
  behavior as design tokens and accessible shared components.
- Add Storybook for every shared component and its empty, loading, error,
  permission-denied, stale, breached, and keyboard states.
- Port the decision inbox, intent backlog, Flight Board, item detail, Learn hub,
  and organization setup summary against production API contracts.
- Keep fixtures inside Storybook/testkit only; add a production-bundle check
  that fails on a fixture import.
- Remove the root Vite application and configuration once parity evidence is
  signed; Git history remains the reference instead of a permanent legacy app.

Exit evidence:

- Playwright covers the principal role flows at desktop and mobile widths.
- axe-core is green, contrast tokens meet WCAG 2.1 AA, and keyboard/focus
  behavior passes the automated portion of the Exam.
- The decision inbox meets the two-second p95 requirement with 50 decisions in
  the integration environment.

### P1-07 — Platform agent, model boundary, and first-run onboarding

**Coherent shape:** make setup and operation conversational while retaining
human authority.

Deliverables:

- Add the AI SDK conversation surface with streaming and a live rendered
  summary beside the conversation.
- Implement the platform-agent runtime behind the pinned Mastra adapter and
  retain a contract-tested direct Temporal activity fallback.
- Grant tools by service identity, organization, hat, and task; never give the
  runtime an unrestricted database or code-host client.
- Implement organization, portfolio, product, pod, hats, registered agent,
  Stack Pack, repositories, product brief, mission brief, and first intents as
  proposed changes requiring one human confirmation.
- Port the originator interview, no-invention rules, correction flow, ephemeral
  input retention, and twenty-prompt eval into the production path.
- Make every agent operation available through the same manual API path.

Exit evidence:

- The platform agent completes first run from conversation to committed
  declarations and artifacts with one human confirmation.
- Agent attempts to sign, cross tenants, retain source text, invent system
  names, or call an ungranted tool fail closed.
- Model and Mastra adapter swaps do not change domain or workflow contracts.

### P1-08 — Architecture walking skeleton and release hardening

**Coherent shape:** prove the technologies work together under the system's
actual authority, tenancy, and recovery rules.

Deliverables:

- Automate all thirteen walking-skeleton cases from `ARCHITECTURE.md` in a clean
  integration environment.
- Re-run every applicable case in `EXAM.md`, including generated/property,
  chaos, latency, security, privacy, and accessibility coverage.
- Complete threat model, data-flow map, recovery runbook, backup/restore
  rehearsal, dependency inventory, SBOM, vulnerability scan, and upgrade drill.
- Obtain the required human accessibility, security/privacy, Product Designer,
  Product Lead, and Tech Lead evidence against the exact release revision.
- Remove all production-path fixtures and close every unresolved Critic finding.

Exit evidence:

- All thirteen architecture cases and original automated Exam cases are green.
- Default-closed specialist evidence and Gate 3 signatures are bound to the
  release revision.
- The production containers start from a clean environment and the documented
  recovery procedure rebuilds operational state from Git.

### P1-09 — Pilot, measurement, and Phase 1 closure

**Coherent shape:** establish that the platform improves decisions rather than
merely operating correctly.

Deliverables:

- Onboard one approved pilot pod and capture the pre-platform baseline using the
  production event contract and approved measurement window.
- Complete at least ten real items without manual status fields, while keeping
  test, demo, and production evidence explicitly separated.
- Run the 90-day outcome window for gate wait, centralization, zero manual
  status updates, and human-hours guardrail.
- Record incidents, escapes, data-quality exceptions, and any contract or
  provider changes as new Briefs rather than silent patches.
- Publish the revision-bound Phase 1 evidence record and learning decision.

Exit evidence:

- Technical release evidence remains green through the pilot.
- The four outcome-contract measures have approved, reproducible calculations.
- Product Lead records the Phase 1 learning decision: continue, correct, or
  stop. A failed outcome does not get relabeled as technical success.

## Walking-skeleton trace

| Architecture case | Primary slice | Required proof |
|---|---|---|
| 1. Interview and render | P1-06, P1-07 | production conversation and rendered draft |
| 2. Commit through GitHub | P1-03, P1-07 | originator-bound commit at exact revision |
| 3. Project into three surfaces | P1-03, P1-06 | deterministic backlog, board, and inbox |
| 4. Revision-bound human signature | P1-02, P1-03 | code-host record and derived mirror |
| 5. Temporal restart and resume | P1-04 | same workflow identity and gate wait |
| 6. LiteLLM model swap | P1-05, P1-07 | configuration-only change and green eval |
| 7. MCP and UI authorization parity | P1-04 | identical registry decision |
| 8. Sandboxed readiness scan | P1-05 | finding becomes ordinary on-ramp Brief |
| 9. Evidence hash and retrieval | P1-03, P1-05 | immutable tenant-safe object reference |
| 10. Agent-first organization setup | P1-07 | one confirmed proposal creates the topology |
| 11. Cross-tenant refusal | P1-02 through P1-07 | negative matrix at every boundary |
| 12. Separate-session second look | P1-02, P1-03, P1-06 | refusal then valid new-session signature |
| 13. Destroy and rebuild | P1-03, P1-04, P1-08 | identical operational and rendered state |

## Verification route

1. Every child item defines its Exam before implementation and preserves the
   root `EXAM.md` from Builder edits.
2. Every pull request runs the root contract validator, dependency-boundary
   rules, typecheck, unit/property tests, contract tests, security checks, and
   affected application builds.
3. Integration changes run Docker-based adapter tests with isolated
   organizations and no production credentials.
4. User-surface changes run Playwright, axe-core, visual regression, responsive,
   keyboard, and focus suites against the production API path.
5. Runtime and provider changes run prompt/tool/model evals, migration rehearsal,
   workflow replay, and version-compatibility checks.
6. P1-08 runs the complete walking skeleton from a clean checkout and retains
   evidence by content hash.
7. Required humans sign accessibility, security/privacy, design, Gate 2, and
   Gate 3 evidence against exact revisions.
8. P1-09 separates technical release evidence from product-outcome evidence and
   refuses a completion claim until both lines are satisfied.

## Risk controls

- **Big-bang migration:** extract provider-free domain behavior first, then
  replace the web runtime after parity. Never run two production authorities.
- **Vendor lock-in:** vendor SDKs stay inside adapters; contract tests run
  against an in-memory fake and the selected binding.
- **Authority drift:** Git/code-host write succeeds before projection; retries
  use idempotency keys; reconciliation repairs projections only.
- **Tenant leakage:** organization scope is present in schema, workflow IDs,
  object paths, model keys, sandboxes, caches, traces, and every negative test.
- **Experimental agent runtime:** Mastra is pinned behind an adapter with a
  direct Temporal fallback and no Mastra-native domain records.
- **Fixture contamination:** fixtures live only in testkit and Storybook;
  production builds and baseline writers reject them.
- **Phase 2 creep:** external Builder dispatch, full evidence bundles, trust-tier
  movement, control bands, notifications, and portfolio/mission views stay out.
- **Accessibility debt:** component states are examined in Storybook before
  screens, and manual specialist evidence is required before Gate 3.
- **Upgrade churn:** foundational upgrades require the architecture contract
  suite, migration rehearsal, and eval gate—not only a dependency bot result.

## Rollback and recovery

- Git remains authoritative throughout migration, so a failed projection or
  application release cannot erase item or signature truth.
- Database changes use expand/migrate/contract sequencing. A deployment rolls
  back application containers while leaving additive migrations compatible;
  destructive schema cleanup occurs only in a later signed item.
- Web migration uses an external release flag until Next.js parity is signed.
  Rollback changes traffic, not authority, and never resurrects Vite as a second
  maintained product.
- A failed Mastra change switches the agent adapter to direct Temporal
  activities. A failed model binding switches LiteLLM configuration after its
  eval, not application code.
- A failed projector disables mutating UI actions, continues Git ingestion, and
  rebuilds from the last durable cursor. It never fabricates state from cache.
- Analytics failure marks measures unavailable or greenfield. It cannot fall
  back to fixture values.

## Claims and required evidence

| Claim | Evidence command or artifact | Expected result |
|---|---|---|
| Repository foundation is reproducible | frozen install, stack lock, root check, container health report | clean checkout builds and services become healthy |
| Domain is provider-independent | dependency-boundary test and adapter contract suite | no vendor SDK in domain/tool registry; fake and live binding agree |
| Tenancy fails closed | cross-tenant negative matrix | zero unauthorized reads, writes, retrievals, traces, or workflow access |
| Git is the only authority | wipe/replay comparison and storage crawl | identical state; no private status or signature |
| Humans and agents share one API | registry/OpenAPI/MCP/UI conformance suite | identical schema and authorization outcome |
| Work survives failure | Temporal restart and projection recovery evidence | same item resumes and state rebuilds |
| Evidence is durable and scoped | content-hash and object-policy tests | immutable reference; wrong tenant refused |
| Agent operation is bounded | prompt/tool/model eval plus forbidden-action cases | no signature, cross-tenant action, invention, or retained source text |
| Experience is accessible and responsive | Playwright, axe, contrast, manual specialist record | automated green and human record signed |
| Phase 1 is technically complete | P1-08 evidence index | original Exam and all thirteen architecture cases green |
| Phase 1 achieved its outcome | P1-09 production measurement record | ten real items and approved 90-day calculations |

## Stop conditions

Stop implementation and return to the owning gate if:

- a slice requires a second source of truth or vendor object in a domain
  contract;
- organization isolation cannot be expressed at a new data or execution
  boundary;
- a provider choice changes the artifact, identity, tool, or workflow contract;
- a Builder needs to change the signed Exam to make an implementation pass;
- a production baseline can be produced only from fixture data;
- a child item crosses the sprawl threshold without a defensible split; or
- a default-closed specialist finding remains unresolved.

## Next authorized action after Gate 2

Create and pull the P1-01 child Brief for the repository foundation and stable
contracts. Do not scaffold the new production applications from this umbrella
plan alone.
