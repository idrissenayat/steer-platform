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

## Current increment: 0007

Implemented and verified the shared tool boundary before adding stateful providers. The service
exposes liveness, an explicitly incomplete readiness response, generated
OpenAPI, and an authenticated organization-scoped context query. The default
server rejects authenticated operations until the real identity adapter is
configured. Tests supply verifier results only through the internal dependency
interface; there is no development-header or dummy-token bypass.

Verification: frozen install, root `pnpm check`, 15 new focused tests and
loopback HTTP smoke checks passed. Details and runtime limitations are in
`intent/0007/EVIDENCE.md`. No visible UI change is claimed for this backend slice.

Next increment: M2 identity adapter and local tenant-data integration. Remaining
M1 work includes full stack lock, provider-free package-boundary checks, and
local service composition; the shell alone does not complete P1-01.
