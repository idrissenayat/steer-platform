# Flight Deck — the STEER platform pod

This folder is the intent home of the pod building the STEER platform.
The platform is built using STEER itself: every feature enters as a brief,
carries an exam, and passes the gates. The pod's own metrics, recorded from
item one, are the framework's pilot evidence.

## Current delivery

The implementation sequence is in [the Phase 1 delivery plan](docs/PHASE-1-DELIVERY.md).
Workspace/web shell (0005), domain extraction (0006), stateless Hono
API/shared tool registry (0007), OIDC adapter/API composition (0008), and
PostgreSQL/Drizzle tenant foundations (0009), verified Git reads and ingestion
(0010/0011), native Node/package checks (0012), and a real local Keycloak
contract harness (0013), browser-session broker (0014) and encrypted durable
session storage (0015), explicit browser HTTP composition (0016) and real
Keycloak human-code contract verification (0017) and assembled encrypted-session
integration (0018), Chromium authentication verification (0019) and Git-backed
browser/bearer identity composition (0020) and request resource boundaries (0021) are
implemented development increments. The separate
runtime GitHub App has passed a live read-only artifact check; see
[provider evidence](docs/GITHUB-RUNTIME-APP.md).
Gate 2 remains open: the latest round-three R5 review returned three blockers
and two majors. Candidate implementation is not live-provider or release
authorization. Start the API with `pnpm dev:api`; it exposes OpenAPI and health
routes but rejects tool requests until trusted runtime identity settings are explicitly installed.

## The numbered implementation chain

| Item | Canonical artifacts | Platform implementation | Remaining evidence |
|---|---|---|---|
| 0001 · Flight Deck foundation | `intent/0001/README.md`, revised `BRIEF.md` and `SPEC.md`, App-authored v3.2 `EXAM.md`, Gate 1 `ARCHITECTURE.md`, and signed-snapshot `PLAN.md` | Phase 0 kit, fixture-backed UX/domain prototype, agent-first assurance and three bounded production-code increments | five R5 findings, protected incorporation and exact-revision reviews/rulings, Gate 2, remaining production integrations, walking skeleton, Gate 3 and pilot outcomes |
| 0002 · Instrumentation and baselines | `intent/0002/README.md`, `BRIEF.md` | versioned content-free event schema, adapters, privacy validation, and both baseline computations are implemented | Product Lead-approved production window and representative figures |
| 0003 · Full brief detail view | `intent/0003/README.md`, `BRIEF.md`, `SPEC.md`, `EXAM.md` | rendered, deep-linkable, revision-safe detail panel and all four actions are implemented | 0002 production baseline and manual accessibility record |
| 0004 · Learn STEER hub | `intent/0004/README.md`, `BRIEF.md`, `SPEC.md`, `EXAM.md` | source-faithful reader, search, glossary, role orientation, agent slices, and corpus build guard are implemented | 0002 production baseline and manual accessibility record |
| 0005 · Production workspace and web shell | `intent/0005/README.md`, `BRIEF.md`, `SPEC.md`, `EXAM.md`, `PLAN.md` | pnpm/Turborepo boundary and visually verified Next.js production shell are implemented without changing the prototype | formal gate records; full stack lock, workers and service composition |
| 0006 · Provider-free domain extraction | `intent/0006/README.md`, `BRIEF.md`, `SPEC.md`, `EXAM.md`, `PLAN.md` | the existing domain is moved—not copied—into `@steer/domain`; stricter optional/index checks and all consumers are migrated | formal gate records; worker, data and provider integration remain |
| 0007 · Shared tool registry and API foundation | `intent/0007/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | Hono, Zod contracts, tenant-scoped context query, generated OpenAPI and 15 focused tests | independent protected Exam, formal gates, actual identity/data/provider integration |
| 0008 · Normalized OIDC adapter | `intent/0008/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | signed access-token verification, current-grant/revocation checks and API composition; eleven new tests | independent protected Exam, formal gates, real Keycloak/browser login and trusted grant projection |
| 0009 · Tenant data foundation | `intent/0009/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | Drizzle migrations, two forced-RLS tables, app/projector privileges, safe tenant transactions; five unit and eight PostgreSQL checks | independent protected Exam, formal gates, Git ingestion/replay, trusted grant projection and production composition |
| 0010 · Revision-bound Git reads | `intent/0010/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | scoped read-only GitHub adapter, exact artifact integrity, current Git authorization; thirteen new tests and live runtime App read verification | independent protected Exam, formal gates and full ingestion/reconciliation composition |
| 0011 · Verified-artifact ingestion | `intent/0011/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | atomic idempotent ingestion, CAS, source-based repair; four unit and three PostgreSQL checks | independent protected Exam, formal gates, durable consumers and full-repository replay |
| 0012 · Native runtime and package seams | `intent/0012/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | domain native import fix, package-boundary tests, full repository verified on Node 24.20.0 | independent protected Exam, formal gates, full service/stack lock and live integration |
| 0013 · Real Keycloak contract | `intent/0013/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | six real-provider check groups for scoped TLS, agent claims/JWKS, revocation, tenant/hat/client/audience denial and shared API grants | human browser login, trusted real membership, persistent identity composition and formal gates |
| 0014 · Human sign-in/session contract | `intent/0014/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | server-side code/PKCE broker, opaque cookies, short-lived sessions and local logout; eleven new tests | HTTP/browser integration, refresh/provider logout, trusted real membership and formal gates; storage supplied by 0015 |
| 0015 · Durable encrypted sessions | `intent/0015/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | dedicated auth role/FORCE RLS, authenticated encryption, bounded TTL/capacity, cross-process atomic consumption and key rotation | HTTP/browser integration, approved runtime secret configuration, real membership, operational purge/rotation and formal gates |
| 0016 · Browser HTTP boundary | `intent/0016/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | fixed-origin login/callback/logout, cookie tool CSRF checks, safe redirects/errors, accurate OpenAPI; nine new tests | browser verification, approved secrets/database/membership, ingress limits and formal gates; provider flow verified in 0017 |
| 0017 · Real human-code provider contract | `intent/0017/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | actual Keycloak form/code exchange, explicit subject mapper, real token/session/grant/logout checks and provider rejection cases | browser-engine cookie/TLS behavior, combined durable storage, approved runtime membership/settings and formal gates |
| 0018 · Assembled identity/storage | `intent/0018/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | real provider code exchange into encrypted Postgres, callback race, separate app/store reconstruction, wrong-key denial and cross-instance logout | actual browser-engine/ingress behavior, authoritative membership, approved runtime settings and formal gates |
| 0019 · Chromium authentication | `intent/0019/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | real HTTPS browser forms, cross-site callback, cookie/CSRF/referrer checks, reconstruction and logout against Keycloak/Postgres | other browsers, production UI/ingress, authoritative membership, approved runtime settings and formal gates |
| 0020 · Git-backed identity composition | `intent/0020/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | fixed-source browser/bearer authority, synthetic Git commit revocation and fail-closed source/document checks through Chromium/Keycloak/Postgres | real approved membership source, ingress/runtime settings, production UI and formal gates |
| 0021 · Request resource boundary | `intent/0021/README.md`, `BRIEF.md`, `SPEC.md`, `PLAN.md`, development `ACCEPTANCE.md`, `EVIDENCE.md` | bounded admission/body reads and local HTTP parser/receive/socket limits; overload, slow-stream and raw-socket checks | fleet ingress/capacity, database deadlines, approved runtime settings and formal gates |

The unnumbered `intent/BRIEF.md`, `SPEC.md`, and `EXAM.md`, plus the
`intent/intent-detail-view*` files, remain compatibility paths for earlier
revisions. The numbered 0001 Brief and Spec match the revised supplied sources.
The numbered Exam preserves its supplied predecessor under `sources/` and is now
the protected agent-first Exam, initially authored by `steer-test-agent[bot]`
at `118302e080598a147294e32d40cf5296763c8cc4` and subsequently incorporated at
`cd913b96a14323ef318749e35a79e1741cf91c70`. Unsigned remediation candidates do
not replace it.

## Item: 0003 · Full brief detail view

| Artifact | Status | Next signature |
|---|---|---|
| intent/0003/BRIEF.md | candidate in the intent backlog | pull by Product Lead |
| intent/0003/SPEC.md | draft | Gate 1, after pull; accessibility flagged |
| intent/0003/EXAM.md | draft | Gate 2; section D approved before code (default-closed) |

Sequencing note: the instrumentation baseline item precedes this one per
the spec; the outcome contract's baseline must exist before this ships.

## Item: 0004 · Learn STEER hub

| Artifact | Status | Next signature |
|---|---|---|
| intent/0004/BRIEF.md | candidate in the intent backlog | pull by Product Lead |
| intent/0004/SPEC.md | draft | Gate 1; content governance and peek UX flagged |
| intent/0004/EXAM.md | draft | Gate 2; accessibility cases are default-closed |

Implementation is present from the requested candidate. Its outcome
comparison remains dependent on the 0002 first-login baseline.

## Historical Gate 1 preparation checklist

Gate 1 was signed for the exact snapshot recorded in
`intent/0001/signatures/gate-1.json`. This original checklist is retained as
context, not a request to repeat that signature.

1. Resolve the flagged concerns in SPEC.md with their policy owners
   (signature weight, single-host binding, notification design,
   assistant data handling).
2. Answer the brief's open questions or carry them forward explicitly.
3. Confirm the outcome contract is measurable on day one: gate-wait
   baseline captured, decision instrumentation defined.
4. Run the naming search; "Flight Deck" is a working title.

## Working rules for this pod

- Git is the sole system of record; the platform never stores state the
  chain does not hold.
- Organization, portfolio, product, pod, human hats, and registered agents are
  versioned declarations, not private platform state.
- WIP protects each human across every pod and hat they hold.
- The exam is write-protected from Builders (hook enforced).
- Accessibility, security, and privacy are default-closed domains.
- Default-closed domains receive independent agent review by default; commercial
  human specialists are routed only on deterministic escalation triggers.
- Changes to these operating files are eval-gated like any fleet config.
- Work is sized by exam-writability and brief shape, never by story points.
- Scope freezes at Gate 1; aging bands and P85 cycle time replace rollover and
  velocity forecasts.

## Framework documents

- `STEER-Methodology.docx` — why the system exists.
- `STEER-Framework.docx` — structure, lifecycle, gates, measurement, and the
  sizing/scoping rules that connect Frame to forecasting.
- `STEER-Operating-Model.docx` — the integrated v3.2 accountabilities,
  organization topology, agent-first assurance, signer policy, and first-run model.
- `STEER-Sizing-and-Scoping.docx` — Practice Note 1, with the complete guidance
  for exam-writability, splitting, aging bands, and percentile forecasting.
- `STEER-Providing-Intent.docx` — Practice Note 2, defining the interview-first,
  no-invention path from natural language to committed artifacts.
- `STEER-The-Three-Surfaces.docx` — Practice Note 3, defining the intent
  backlog, pull boundary, role home, and protected attention hierarchy.
- `intent/0001/ARCHITECTURE.md` — the Gate 1 production foundation, stable
  seams, phase boundaries, and walking-skeleton acceptance exam.
- `docs/architecture/STEER-platform-end-state-phased.png` — the visual
  projection of that phased architecture.
- `kit/learn-manifest.json` — the v3.2 human and agent corpus map used by the
  Learn hub, role slices, orientation paths, and build-time version guard.

## Implementation evidence

The active implementation and its intent-by-intent ledger are documented in
`docs/IMPLEMENTATION.md` and `docs/INTENT-COMPLETION.md`. The authority,
projection, and v3.2 synchronization rules for the full document set are in
`docs/DOCUMENTATION-MAP.md`. Run `pnpm check` to validate the Phase 0 kit,
scope policy, TypeScript, automated exam cases, and production build.
